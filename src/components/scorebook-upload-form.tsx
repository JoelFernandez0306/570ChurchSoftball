"use client";

import { useState, useRef } from "react";
import { saveScoreBookStatsAction, type ScoreBookPlayerStat } from "@/app/admin/(protected)/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameOption {
  id: string;
  label: string;
  awayTeam: string;
  homeTeam: string;
}

interface TeamOption {
  name: string;
  players: string[];
}

interface ExtractedPlayer {
  name: string;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  crossed_out: boolean;
}

interface ExtractedData {
  players: ExtractedPlayer[];
  notes?: {
    "2B"?: string[];
    "3B"?: string[];
    HR?: string[];
  };
}

interface Props {
  games: GameOption[];
  teams: TeamOption[];
  seasonType: string;
}

type Step = "upload" | "review" | "verify" | "done";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fuzzyMatch(extracted: string, roster: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "");
  const eParts = norm(extracted).split(" ").filter(Boolean);
  let best = "";
  let bestScore = 0;
  for (const name of roster) {
    const rParts = norm(name).split(" ").filter(Boolean);
    const common = eParts.filter((ep) => rParts.some((rp) => rp.startsWith(ep) || ep.startsWith(rp))).length;
    const score = common / Math.max(eParts.length, rParts.length);
    if (score > bestScore) { bestScore = score; best = name; }
  }
  return bestScore >= 0.4 ? best : "";
}

function resolveNoteCount(notesArr: string[], playerName: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").trim();
  const pNorm = norm(playerName);
  const pLast = pNorm.split(" ").pop() ?? "";
  let total = 0;
  for (const entry of notesArr) {
    const m = entry.match(/^(.+?)\s*(\d+)?\s*$/);
    if (!m) continue;
    const n = norm(m[1]);
    if (pNorm.includes(n) || (pLast.length > 2 && n.endsWith(pLast))) {
      total += parseInt(m[2] ?? "1", 10);
    }
  }
  return total;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScoreBookUploadForm({ games, teams, seasonType }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [teamName, setTeamName] = useState(teams[0]?.name ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  // per-player overrides keyed by index
  const [overrides, setOverrides] = useState<Record<number, Partial<ExtractedPlayer>>>({});
  // name map: index → verified roster name (or "SKIP")
  const [nameMap, setNameMap] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedTeam = teams.find((t) => t.name === teamName);
  const selectedGame = games.find((g) => g.id === gameId);

  // ── Effective player (base + overrides) ────────────────────────────────────

  function getPlayer(idx: number): ExtractedPlayer {
    const base = extracted!.players[idx];
    return { ...base, ...(overrides[idx] ?? {}) };
  }

  // ── Step 1: Upload + process ───────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleProcess() {
    if (!imageFile || !gameId || !teamName) {
      setError("Please select a game, team, and upload an image.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("teamName", teamName);
      const res = await fetch("/api/admin/process-scorebook", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Processing failed");
      if (!Array.isArray(data.players)) throw new Error("Unexpected response from Claude");

      // Pre-populate 2B/3B/HR per player from the notes section
      const notes = data.notes ?? {};
      const playersWithXBH = data.players.map((p: ExtractedPlayer) => ({
        ...p,
        doubles: resolveNoteCount(notes["2B"] ?? [], p.name),
        triples: resolveNoteCount(notes["3B"] ?? [], p.name),
        hr:      resolveNoteCount(notes.HR    ?? [], p.name),
      }));
      setExtracted({ ...data, players: playersWithXBH });

      // Pre-fill name map with fuzzy matches against this team's roster
      const roster = selectedTeam?.players ?? [];
      const initMap: Record<number, string> = {};
      playersWithXBH.forEach((p: ExtractedPlayer, i: number) => {
        initMap[i] = fuzzyMatch(p.name, roster);
      });
      setNameMap(initMap);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Review helpers ─────────────────────────────────────────────────

  function toggleCrossedOut(idx: number) {
    const cur = overrides[idx]?.crossed_out ?? extracted!.players[idx].crossed_out;
    setOverrides((prev) => ({ ...prev, [idx]: { ...prev[idx], crossed_out: !cur } }));
  }

  function setStat(idx: number, field: keyof ExtractedPlayer, value: number) {
    setOverrides((prev) => ({ ...prev, [idx]: { ...prev[idx], [field]: value } }));
  }

  // ── Step 4: Save ──────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const rows: ScoreBookPlayerStat[] = [];

      extracted!.players.forEach((_, idx) => {
        const p = getPlayer(idx);
        if (p.crossed_out) return;
        const verifiedName = nameMap[idx];
        if (!verifiedName || verifiedName === "SKIP") return;

        const doubles = p.doubles ?? 0;
        const triples = p.triples ?? 0;
        const hr      = p.hr      ?? 0;
        const singles = Math.max(0, p.h - doubles - triples - hr);

        rows.push({
          player_name: verifiedName,
          team_name:   teamName,
          ab: p.ab, r: p.r, h: p.h, rbi: p.rbi, bb: p.bb, so: p.so,
          singles, doubles, triples, hr,
        });
      });

      if (rows.length === 0) throw new Error("No valid player rows to save.");
      await saveScoreBookStatsAction(gameId, seasonType, rows);
      setSaved(true);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const STEPS: { key: Step; label: string }[] = [
    { key: "upload",  label: "1. Upload" },
    { key: "review",  label: "2. Review" },
    { key: "verify",  label: "3. Verify Names" },
    { key: "done",    label: "4. Done" },
  ];

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {STEPS.map(({ key, label }) => (
          <span key={key} style={{
            padding: "0.25rem 0.75rem", borderRadius: 999, fontSize: "0.8rem",
            fontWeight: step === key ? 700 : 400,
            background: step === key ? "var(--accent, #2563eb)" : "var(--surface-alt)",
            color: step === key ? "#fff" : "var(--ink-soft)",
          }}>{label}</span>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {/* ── STEP 1: Upload ── */}
      {step === "upload" && (
        <article className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Game</label>
            <select value={gameId} onChange={(e) => setGameId(e.target.value)} style={{ width: "100%", padding: "0.5rem" }}>
              {games.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Team (whose scorebook page is this?)</label>
            <select value={teamName} onChange={(e) => setTeamName(e.target.value)} style={{ width: "100%", padding: "0.5rem" }}>
              {teams.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Scorebook Photo</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} />
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "0.25rem" }}>
              JPG, PNG, or WEBP. Capture the full batting lineup section clearly.
            </p>
          </div>

          {imagePreview && (
            <img src={imagePreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 380, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }} />
          )}

          <button onClick={handleProcess} disabled={loading || !imageFile || !gameId || !teamName} style={{ alignSelf: "flex-start" }}>
            {loading ? "Analyzing with Claude…" : "Extract Stats →"}
          </button>
        </article>
      )}

      {/* ── STEP 2: Review ── */}
      {step === "review" && extracted && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p style={{ color: "var(--ink-soft)" }}>
            Claude extracted <strong>{teamName}</strong>&apos;s lineup. Toggle any rows that were misread, and edit individual stats if needed.
          </p>

          <article className="card">
            <h3 style={{ marginBottom: "0.75rem" }}>{teamName}</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player (as written)</th>
                    <th>AB</th><th>R</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {extracted.players.map((_, idx) => {
                    const p = getPlayer(idx);
                    return (
                      <tr key={idx} style={{ opacity: p.crossed_out ? 0.4 : 1 }}>
                        <td style={{ textDecoration: p.crossed_out ? "line-through" : "none", fontWeight: 500 }}>
                          {p.name}
                        </td>
                        {(["ab","r","h","doubles","triples","hr","rbi","bb","so"] as (keyof ExtractedPlayer)[]).map((f) => (
                          <td key={f}>
                            <input
                              type="number" min={0} value={p[f] as number}
                              onChange={(e) => setStat(idx, f, parseInt(e.target.value, 10) || 0)}
                              disabled={p.crossed_out}
                              style={{ width: 44, textAlign: "center", padding: "0.15rem" }}
                            />
                          </td>
                        ))}
                        <td>
                          <button onClick={() => toggleCrossedOut(idx)} style={{
                            padding: "0.2rem 0.6rem", fontSize: "0.75rem", borderRadius: 4,
                            background: p.crossed_out ? "#fee2e2" : "#f0fdf4",
                            color: p.crossed_out ? "#991b1b" : "#166534",
                            border: "1px solid currentColor",
                          }}>
                            {p.crossed_out ? "Crossed out ✕" : "Valid ✓"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {extracted.notes && Object.values(extracted.notes).some((v) => v && v.length > 0) && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                {Object.entries(extracted.notes).map(([type, names]) =>
                  names && (names as string[]).length > 0
                    ? <div key={type}><strong>{type}:</strong> {(names as string[]).join(", ")}</div>
                    : null
                )}
              </div>
            )}
          </article>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => setStep("upload")} className="ghost-button">← Back</button>
            <button onClick={() => setStep("verify")}>Verify Names →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Verify names ── */}
      {step === "verify" && extracted && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p style={{ color: "var(--ink-soft)" }}>
            Match each name to a player on <strong>{teamName}</strong>&apos;s roster. Pre-filled suggestions are based on fuzzy matching — confirm or correct each one.
          </p>

          <article className="card">
            <h3 style={{ marginBottom: "0.75rem" }}>{teamName}</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {extracted.players.map((_, idx) => {
                const p = getPlayer(idx);
                if (p.crossed_out) return null;
                const roster = selectedTeam?.players ?? [];
                return (
                  <div key={idx} style={{
                    display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1rem",
                    alignItems: "center", padding: "0.6rem 0",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                        AB {p.ab} · R {p.r} · H {p.h} · RBI {p.rbi} · BB {p.bb} · SO {p.so}
                      </div>
                    </div>
                    <select
                      value={nameMap[idx] ?? ""}
                      onChange={(e) => setNameMap((prev) => ({ ...prev, [idx]: e.target.value }))}
                      style={{ width: "100%", padding: "0.4rem" }}
                    >
                      <option value="">— Select player —</option>
                      <option value="SKIP">Skip (not on roster)</option>
                      <optgroup label={`${teamName} roster`}>
                        {roster.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                );
              })}
            </div>
          </article>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => setStep("review")} className="ghost-button">← Back</button>
            <button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Stats →"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === "done" && saved && (
        <article className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✅</div>
          <h3>Stats Saved</h3>
          <p style={{ color: "var(--ink-soft)" }}>
            <strong>{teamName}</strong> stats for <strong>{selectedGame?.label}</strong> have been saved and added to the season totals.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1.5rem" }}>
            <a href="/stats"><button>View Stats →</button></a>
            <button className="ghost-button" onClick={() => {
              setStep("upload"); setImageFile(null); setImagePreview(null);
              setExtracted(null); setNameMap({}); setOverrides({}); setSaved(false);
            }}>Upload Another Page</button>
          </div>
        </article>
      )}
    </div>
  );
}

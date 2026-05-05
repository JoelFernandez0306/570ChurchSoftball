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

interface RosterPlayer {
  name: string;
  team: string;
}

interface ExtractedPlayer {
  name: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  so: number;
  crossed_out: boolean;
}

interface ExtractedTeam {
  team_name: string;
  players: ExtractedPlayer[];
  notes?: {
    "2B"?: string[];
    "3B"?: string[];
    HR?: string[];
  };
}

interface Props {
  games: GameOption[];
  allPlayers: RosterPlayer[];
  seasonType: string;
}

type Step = "upload" | "review" | "verify" | "submit";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fuzzyMatch(extracted: string, roster: RosterPlayer[]): RosterPlayer | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "");
  const eParts = norm(extracted).split(" ").filter(Boolean);
  let best: RosterPlayer | null = null;
  let bestScore = 0;
  for (const p of roster) {
    const rParts = norm(p.name).split(" ").filter(Boolean);
    const common = eParts.filter((ep) => rParts.some((rp) => rp.startsWith(ep) || ep.startsWith(rp))).length;
    const score = common / Math.max(eParts.length, rParts.length);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 0.4 ? best : null;
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

// ── Main component ────────────────────────────────────────────────────────────

export function ScoreBookUploadForm({ games, allPlayers, seasonType }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedTeams, setExtractedTeams] = useState<ExtractedTeam[]>([]);
  // player-level overrides: key = "teamIdx-playerIdx", value = { crossed_out, stat overrides }
  const [playerOverrides, setPlayerOverrides] = useState<Record<string, Partial<ExtractedPlayer>>>({});
  // name map: "teamIdx-playerIdx" → verified player name (or "SKIP")
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Upload ──────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleProcess() {
    if (!imageFile || !gameId) { setError("Please select a game and upload an image."); return; }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      const res = await fetch("/api/admin/process-scorebook", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Processing failed");
      if (!data.teams || !Array.isArray(data.teams)) throw new Error("Unexpected response format");

      setExtractedTeams(data.teams);

      // Initialise name map with fuzzy-matched suggestions
      const initMap: Record<string, string> = {};
      data.teams.forEach((team: ExtractedTeam, ti: number) => {
        team.players.forEach((p: ExtractedPlayer, pi: number) => {
          const key = `${ti}-${pi}`;
          const match = fuzzyMatch(p.name, allPlayers);
          initMap[key] = match?.name ?? "";
        });
      });
      setNameMap(initMap);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Review helpers ──────────────────────────────────────────────────

  function getPlayer(ti: number, pi: number): ExtractedPlayer & { crossed_out: boolean } {
    const base = extractedTeams[ti].players[pi];
    const over = playerOverrides[`${ti}-${pi}`] ?? {};
    return { ...base, ...over };
  }

  function toggleCrossedOut(ti: number, pi: number) {
    const key = `${ti}-${pi}`;
    const cur = playerOverrides[key]?.crossed_out ?? extractedTeams[ti].players[pi].crossed_out;
    setPlayerOverrides((prev) => ({ ...prev, [key]: { ...prev[key], crossed_out: !cur } }));
  }

  function setStat(ti: number, pi: number, field: keyof ExtractedPlayer, value: number) {
    const key = `${ti}-${pi}`;
    setPlayerOverrides((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  // ── Step 3: Verify helpers ──────────────────────────────────────────────────

  // Collect all active (non-crossed-out) players needing verification
  function getActivePlayers() {
    const result: Array<{ ti: number; pi: number; player: ExtractedPlayer; teamName: string }> = [];
    extractedTeams.forEach((team, ti) => {
      team.players.forEach((_, pi) => {
        const p = getPlayer(ti, pi);
        if (!p.crossed_out) result.push({ ti, pi, player: p, teamName: team.team_name });
      });
    });
    return result;
  }

  // ── Step 4: Build final rows & save ────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const activePlayers = getActivePlayers();
      const rows: ScoreBookPlayerStat[] = [];

      for (const { ti, pi, player, teamName } of activePlayers) {
        const key = `${ti}-${pi}`;
        const verifiedName = nameMap[key];
        if (!verifiedName || verifiedName === "SKIP") continue;

        const team = extractedTeams[ti];
        const notes = team.notes ?? {};
        const doubles = resolveNoteCount(notes["2B"] ?? [], player.name);
        const triples = resolveNoteCount(notes["3B"] ?? [], player.name);
        const hr      = resolveNoteCount(notes.HR ?? [], player.name);
        const singles = Math.max(0, player.h - doubles - triples - hr);

        rows.push({
          player_name: verifiedName,
          team_name:   teamName.replace(/\.$/, "").trim(),
          ab:  player.ab,
          r:   player.r,
          h:   player.h,
          rbi: player.rbi,
          bb:  player.bb,
          so:  player.so,
          singles, doubles, triples, hr,
        });
      }

      if (rows.length === 0) throw new Error("No valid player rows to save.");
      await saveScoreBookStatsAction(gameId, seasonType, rows);
      setSaved(true);
      setStep("submit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedGame = games.find((g) => g.id === gameId);

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {(["upload", "review", "verify", "submit"] as Step[]).map((s, idx) => (
          <span key={s} style={{
            padding: "0.25rem 0.75rem",
            borderRadius: 999,
            fontSize: "0.8rem",
            fontWeight: step === s ? 700 : 400,
            background: step === s ? "var(--accent, #2563eb)" : "var(--surface-alt)",
            color: step === s ? "#fff" : "var(--ink-soft)",
          }}>
            {idx + 1}. {s === "upload" ? "Upload" : s === "review" ? "Review" : s === "verify" ? "Verify Names" : "Done"}
          </span>
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
            <label style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Scorebook Photo</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "block" }} />
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "0.25rem" }}>
              JPG, PNG, or WEBP. Take a clear, well-lit photo of the full lineup section.
            </p>
          </div>

          {imagePreview && (
            <img src={imagePreview} alt="Scorebook preview" style={{ maxWidth: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }} />
          )}

          <button
            onClick={handleProcess}
            disabled={loading || !imageFile || !gameId}
            style={{ alignSelf: "flex-start" }}
          >
            {loading ? "Analyzing with Claude…" : "Extract Stats →"}
          </button>
        </article>
      )}

      {/* ── STEP 2: Review extracted stats ── */}
      {step === "review" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p style={{ color: "var(--ink-soft)" }}>
            Claude extracted the stats below. <strong>Crossed-out rows</strong> are highlighted — toggle any that were misread.
            You can also edit individual stat values before continuing.
          </p>

          {extractedTeams.map((team, ti) => (
            <article key={ti} className="card">
              <h3 style={{ marginBottom: "0.75rem" }}>{team.team_name}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Player (as written)</th>
                      <th title="At Bats">AB</th>
                      <th title="Runs">R</th>
                      <th title="Hits">H</th>
                      <th title="RBI">RBI</th>
                      <th title="Walks">BB</th>
                      <th title="Strikeouts">SO</th>
                      <th>Crossed out?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.players.map((_, pi) => {
                      const p = getPlayer(ti, pi);
                      return (
                        <tr key={pi} style={{ opacity: p.crossed_out ? 0.4 : 1 }}>
                          <td style={{ textDecoration: p.crossed_out ? "line-through" : "none", fontWeight: 500 }}>
                            {p.name}
                          </td>
                          {(["ab","r","h","rbi","bb","so"] as (keyof ExtractedPlayer)[]).map((f) => (
                            <td key={f}>
                              <input
                                type="number"
                                min={0}
                                value={p[f] as number}
                                onChange={(e) => setStat(ti, pi, f, parseInt(e.target.value, 10) || 0)}
                                disabled={p.crossed_out}
                                style={{ width: 44, textAlign: "center", padding: "0.15rem" }}
                              />
                            </td>
                          ))}
                          <td>
                            <button
                              onClick={() => toggleCrossedOut(ti, pi)}
                              style={{
                                padding: "0.2rem 0.6rem",
                                fontSize: "0.75rem",
                                background: p.crossed_out ? "#fee2e2" : "#f0fdf4",
                                color: p.crossed_out ? "#991b1b" : "#166534",
                                border: "1px solid currentColor",
                                borderRadius: 4,
                              }}
                            >
                              {p.crossed_out ? "Crossed out ✕" : "Valid ✓"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {team.notes && Object.keys(team.notes).length > 0 && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                  {Object.entries(team.notes).map(([type, names]) =>
                    names && names.length > 0 ? <div key={type}><strong>{type}:</strong> {(names as string[]).join(", ")}</div> : null
                  )}
                </div>
              )}
            </article>
          ))}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => setStep("upload")} className="ghost-button">← Back</button>
            <button onClick={() => setStep("verify")}>Verify Names →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Verify names ── */}
      {step === "verify" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p style={{ color: "var(--ink-soft)" }}>
            Match each extracted name to a player on your roster. Names already matched by Claude are pre-filled — confirm or correct them.
            Choose <strong>Skip (not on roster)</strong> to exclude a player.
          </p>

          {extractedTeams.map((team, ti) => {
            const active = team.players
              .map((_, pi) => ({ pi, player: getPlayer(ti, pi) }))
              .filter(({ player }) => !player.crossed_out);
            if (active.length === 0) return null;
            return (
              <article key={ti} className="card">
                <h3 style={{ marginBottom: "0.75rem" }}>{team.team_name}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {active.map(({ pi, player }) => {
                    const key = `${ti}-${pi}`;
                    const teamRoster = allPlayers.filter((p) => p.team === team.team_name.replace(/\.$/, "").trim());
                    const rosterOptions = allPlayers; // allow cross-team for flexibility
                    return (
                      <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{player.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>as written in scorebook</div>
                        </div>
                        <div>
                          <select
                            value={nameMap[key] ?? ""}
                            onChange={(e) => setNameMap((prev) => ({ ...prev, [key]: e.target.value }))}
                            style={{ width: "100%", padding: "0.4rem" }}
                          >
                            <option value="">— Select player —</option>
                            <option value="SKIP">Skip (not on roster)</option>
                            <optgroup label="Roster">
                              {rosterOptions.map((p) => (
                                <option key={`${p.team}-${p.name}`} value={p.name}>
                                  {p.name} ({p.team})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => setStep("review")} className="ghost-button">← Back</button>
            <button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Stats →"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === "submit" && saved && (
        <article className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✅</div>
          <h3>Stats Saved</h3>
          <p style={{ color: "var(--ink-soft)" }}>
            Batting stats for <strong>{selectedGame?.label}</strong> have been saved and aggregated into the season totals.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1.5rem" }}>
            <a href="/stats" style={{ textDecoration: "none" }}>
              <button>View Stats →</button>
            </a>
            <button className="ghost-button" onClick={() => {
              setStep("upload");
              setImageFile(null);
              setImagePreview(null);
              setExtractedTeams([]);
              setNameMap({});
              setPlayerOverrides({});
              setSaved(false);
            }}>
              Upload Another
            </button>
          </div>
        </article>
      )}
    </div>
  );
}

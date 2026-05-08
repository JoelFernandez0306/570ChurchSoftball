"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGameStatsAction, type GameStatRow } from "@/app/admin/(protected)/actions";

interface GameGroup {
  gameId: string;
  source: "scorebook" | "gamechanger";
  gameDate: string | null;
  gameNumber: number | null;
  gameTime: string | null;
  rows: GameStatRow[];
}

interface Props {
  teamNames: string[];
  selectedTeamName: string;
  gameGroups: GameGroup[];
}

const STAT_COLS = ["gp","ab","r","h","doubles","triples","hr","rbi","bb","so"] as const;
const COL_LABEL: Record<string, string> = {
  gp: "GP", ab: "AB", r: "R", h: "H", doubles: "2B", triples: "3B", hr: "HR",
  rbi: "RBI", bb: "BB", so: "SO",
};

export function CorrectStatsForm({ teamNames, selectedTeamName, gameGroups }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Local editable copy of all groups
  const [groups, setGroups] = useState<GameGroup[]>(gameGroups);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset local state when server re-renders with new team
  const [lastTeam, setLastTeam] = useState(selectedTeamName);
  if (lastTeam !== selectedTeamName) {
    setGroups(gameGroups);
    setLastTeam(selectedTeamName);
    setSavedGameId(null);
    setError(null);
  }

  function handleTeamChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/admin/correct-stats?teamName=${encodeURIComponent(e.target.value)}`);
  }

  function setStat(gameId: string, playerIdx: number, field: keyof GameStatRow, value: number) {
    setGroups((prev) => prev.map((g) => {
      if (g.gameId !== gameId) return g;
      const rows = g.rows.map((r, i) => {
        if (i !== playerIdx) return r;
        const updated = { ...r, [field]: value };
        if (["h","doubles","triples","hr"].includes(field as string)) {
          updated.singles = Math.max(0, updated.h - updated.doubles - updated.triples - updated.hr);
        }
        return updated;
      });
      return { ...g, rows };
    }));
    setSavedGameId(null);
  }

  function handleSave(gameId: string, rows: GameStatRow[]) {
    setError(null);
    startTransition(async () => {
      try {
        await updateGameStatsAction(gameId, rows);
        setSavedGameId(gameId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <label style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Team</label>
        <select value={selectedTeamName} onChange={handleTeamChange} style={{ width: "100%", maxWidth: 400, padding: "0.5rem" }}>
          <option value="">— Select a team —</option>
          {teamNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "0.75rem 1rem", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {selectedTeamName && groups.length === 0 && (
        <p style={{ color: "var(--ink-soft)" }}>No stats found for {selectedTeamName}. Use Upload Scorebook to add them.</p>
      )}

      {groups.map(({ gameId, source, gameDate, gameNumber, gameTime, rows }, gi) => (
        <article className="card" key={gameId}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{
                  display: "inline-block", fontSize: "0.75rem", fontWeight: 700,
                  padding: "0.15rem 0.55rem", borderRadius: "999px",
                  background: source === "scorebook" ? "#dbeafe" : "#dcfce7",
                  color: source === "scorebook" ? "#1e40af" : "#166534",
                }}>
                  {source === "scorebook" ? "Paper Scorebook" : "GameChanger"}
                </span>
                {gameDate && (
                  <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                    {new Date(gameDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                {gameTime && (
                  <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                    · {new Date("1970-01-01T" + gameTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </span>
                )}
                {gameNumber && (
                  <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                    · Game {gameNumber}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)", fontFamily: "monospace" }}>
                {gameId}
              </span>
            </div>
            {savedGameId === gameId && (
              <span style={{ color: "#166534", fontSize: "0.85rem" }}>✓ Saved</span>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  {STAT_COLS.map((c) => <th key={c}>{COL_LABEL[c]}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, playerIdx) => (
                  <tr key={`${row.player_name}`}>
                    <td style={{ fontWeight: 500 }}>{row.player_name}</td>
                    {STAT_COLS.map((f) => (
                      <td key={f}>
                        <input
                          type="number" min={0} max={f === "gp" ? 1 : undefined}
                          value={(row[f as keyof GameStatRow] as number) ?? (f === "gp" ? 1 : 0)}
                          onChange={(e) => setStat(gameId, playerIdx, f as keyof GameStatRow, parseInt(e.target.value, 10) || 0)}
                          style={{ width: f === "gp" ? 40 : 48, textAlign: "center", padding: "0.15rem", background: f === "gp" ? "#fef9c3" : undefined }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <button onClick={() => handleSave(gameId, groups[gi].rows)} disabled={isPending}>
              {isPending ? "Saving…" : "Save Corrections →"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

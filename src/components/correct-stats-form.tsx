"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGameStatsAction, type GameStatRow } from "@/app/admin/(protected)/actions";

interface GameOption { id: string; label: string; }

interface Props {
  games: GameOption[];
  selectedGameId: string;
  existingRows: GameStatRow[];
  seasonType: string;
}

const STAT_COLS = ["ab","r","h","doubles","triples","hr","rbi","bb","so"] as const;
const COL_LABEL: Record<string, string> = {
  ab: "AB", r: "R", h: "H", doubles: "2B", triples: "3B", hr: "HR",
  rbi: "RBI", bb: "BB", so: "SO",
};

export function CorrectStatsForm({ games, selectedGameId, existingRows, seasonType }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<GameStatRow[]>(existingRows);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // When game changes, navigate to reload with new gameId
  function handleGameChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/admin/correct-stats?gameId=${e.target.value}`);
  }

  function setStat(idx: number, field: keyof GameStatRow, value: number) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };
      // Recompute singles whenever h/doubles/triples/hr changes
      if (["h","doubles","triples","hr"].includes(field as string)) {
        row.singles = Math.max(0, row.h - row.doubles - row.triples - row.hr);
      }
      next[idx] = row;
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    if (!selectedGameId || rows.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateGameStatsAction(selectedGameId, rows);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const byTeam = rows.reduce<Record<string, GameStatRow[]>>((acc, row) => {
    (acc[row.team_name] ??= []).push(row);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <label style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Game</label>
        <select value={selectedGameId} onChange={handleGameChange} style={{ width: "100%", maxWidth: 540, padding: "0.5rem" }}>
          <option value="">— Select a game —</option>
          {games.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "0.75rem 1rem", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "0.75rem 1rem", color: "#166534" }}>
          Stats saved and season totals updated.
        </div>
      )}

      {selectedGameId && rows.length === 0 && (
        <p style={{ color: "var(--ink-soft)" }}>No stats found for this game. Use Upload Scorebook to add them.</p>
      )}

      {Object.entries(byTeam).map(([teamName, teamRows]) => (
        <article className="card" key={teamName}>
          <h3 style={{ marginBottom: "0.75rem" }}>{teamName}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  {STAT_COLS.map((c) => <th key={c}>{COL_LABEL[c]}</th>)}
                </tr>
              </thead>
              <tbody>
                {teamRows.map((row) => {
                  const idx = rows.indexOf(row);
                  return (
                    <tr key={`${row.player_name}-${row.team_name}`}>
                      <td style={{ fontWeight: 500 }}>{row.player_name}</td>
                      {STAT_COLS.map((f) => (
                        <td key={f}>
                          <input
                            type="number" min={0}
                            value={(row[f as keyof GameStatRow] as number) ?? 0}
                            onChange={(e) => setStat(idx, f as keyof GameStatRow, parseInt(e.target.value, 10) || 0)}
                            style={{ width: 48, textAlign: "center", padding: "0.15rem" }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      ))}

      {selectedGameId && rows.length > 0 && (
        <div>
          <button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save Corrections →"}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface TeamOption {
  id: string;
  name: string;
}

export function QuickResultForm({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
  const [gameDate, setGameDate] = useState("");
  const [gameNumber, setGameNumber] = useState<1 | 2>(1);
  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [loserTeamId, setLoserTeamId] = useState("");
  const [tieGame, setTieGame] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function onWinnerChange(value: string) {
    setWinnerTeamId(value);
    if (value && value === loserTeamId) {
      setLoserTeamId("");
    }
  }

  function onLoserChange(value: string) {
    setLoserTeamId(value);
    if (value && value === winnerTeamId) {
      setWinnerTeamId("");
    }
  }

  function onTieChange(checked: boolean) {
    setTieGame(checked);
    if (checked) {
      setWinnerTeamId("");
      setLoserTeamId("");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!gameDate) {
      setStatus("Game date is required.");
      return;
    }

    if (!tieGame && (!winnerTeamId || !loserTeamId)) {
      setStatus("Choose winner and loser, or mark this as a tie game.");
      return;
    }

    if (!tieGame && winnerTeamId === loserTeamId) {
      setStatus("Winner and loser cannot be the same team.");
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameDate,
          gameNumber,
          tieGame,
          ...(tieGame
            ? {}
            : {
                winnerTeamId,
                loserTeamId,
              }),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setStatus(payload.error ?? "Could not save result.");
        return;
      }

      setStatus("Result saved.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="form-grid">
        <label>
          Game date
          <input
            type="date"
            value={gameDate}
            onChange={(event) => setGameDate(event.target.value)}
            required
          />
        </label>

        <label>
          Game slot
          <select
            value={String(gameNumber)}
            onChange={(event) => setGameNumber(Number(event.target.value) === 2 ? 2 : 1)}
          >
            <option value="1">Game 1</option>
            <option value="2">Game 2</option>
          </select>
        </label>

        <label>
          Winner team
          <select
            value={winnerTeamId}
            onChange={(event) => onWinnerChange(event.target.value)}
            required={!tieGame}
            disabled={tieGame}
          >
            <option value="">Select winner</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id} disabled={team.id === loserTeamId}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Loser team
          <select
            value={loserTeamId}
            onChange={(event) => onLoserChange(event.target.value)}
            required={!tieGame}
            disabled={tieGame}
          >
            <option value="">Select loser</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id} disabled={team.id === winnerTeamId}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ alignSelf: "end" }}>
          <span style={{ marginBottom: "0.25rem" }}>Result Type</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <input
              type="checkbox"
              checked={tieGame}
              onChange={(event) => onTieChange(event.target.checked)}
              style={{ width: "auto" }}
            />
            Tie game
          </span>
        </label>
      </div>

      <div>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Record Result"}
        </button>
      </div>

      {status ? (
        <p className={status.toLowerCase().includes("saved") ? "success-text" : "error-text"}>{status}</p>
      ) : null}
    </form>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface GameResultEditorProps {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  winnerTeamId: string | null;
  loserTeamId: string | null;
  isTie: boolean;
  isCancelled?: boolean;
}

export function GameResultEditor(props: GameResultEditorProps) {
  const router = useRouter();
  const [winnerTeamId, setWinnerTeamId] = useState(props.winnerTeamId ?? "");
  const [loserTeamId, setLoserTeamId] = useState(props.loserTeamId ?? "");
  const [tieGame, setTieGame] = useState(props.isTie);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onCancelWeather() {
    if (!confirm("Mark this game as cancelled (weather)? This will clear any recorded result.")) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: props.gameId, cancelled: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(payload.error ?? "Could not save."); return; }
      setStatus("Game marked as cancelled.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  const teamOptions = [
    { id: props.homeTeamId, name: props.homeTeamName },
    { id: props.awayTeamId, name: props.awayTeamName },
  ];

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
    setStatus(null);

    if (!tieGame && (!winnerTeamId || !loserTeamId)) {
      setStatus("Choose both winner and loser, or mark this as a tie game.");
      return;
    }

    if (!tieGame && winnerTeamId === loserTeamId) {
      setStatus("Winner and loser cannot be the same team.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: props.gameId,
          tieGame,
          ...(tieGame
            ? {}
            : {
                winnerTeamId,
                loserTeamId,
              }),
        }),
      });

      const payload = await response.json().catch(() => ({}));

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
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Winner
        <select
          name="winner_team_id"
          value={winnerTeamId}
          onChange={(event) => onWinnerChange(event.target.value)}
          disabled={tieGame}
        >
          <option value="">Not set</option>
          {teamOptions.map((team) => (
            <option key={team.id} value={team.id} disabled={!tieGame && team.id === loserTeamId}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Loser
        <select
          name="loser_team_id"
          value={loserTeamId}
          onChange={(event) => onLoserChange(event.target.value)}
          disabled={tieGame}
        >
          <option value="">Not set</option>
          {teamOptions.map((team) => (
            <option key={team.id} value={team.id} disabled={!tieGame && team.id === winnerTeamId}>
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

      <div style={{ alignSelf: "end" }}>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Result"}
        </button>
      </div>

      <div style={{ alignSelf: "end" }}>
        <button
          type="button"
          onClick={onCancelWeather}
          disabled={saving}
          style={{ background: "var(--surface-alt)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
        >
          ⛈ Weather Cancellation
        </button>
      </div>

      {status ? (
        <p className={status.toLowerCase().includes("saved") || status.toLowerCase().includes("cancelled") ? "success-text" : "error-text"}>{status}</p>
      ) : null}
    </form>
  );
}

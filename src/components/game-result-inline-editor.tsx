"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface GameResultInlineEditorProps {
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

export function GameResultInlineEditor(props: GameResultInlineEditorProps) {
  const router = useRouter();
  const hasExistingResult = props.isCancelled || props.isTie || (Boolean(props.winnerTeamId) && Boolean(props.loserTeamId));
  const [winnerTeamId, setWinnerTeamId] = useState(props.winnerTeamId ?? "");
  const [loserTeamId, setLoserTeamId] = useState(props.loserTeamId ?? "");
  const [tieGame, setTieGame] = useState(props.isTie);
  const [isEditing, setIsEditing] = useState(!hasExistingResult);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onWeatherCancel() {
    if (!confirm("Mark this game as cancelled (weather)?")) return;
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
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed.");
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
      setStatus("Choose winner and loser, or set tie.");
      return;
    }

    if (!tieGame && winnerTeamId === loserTeamId) {
      setStatus("Winner and loser cannot match.");
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

      setStatus("Saved.");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="result-inline-form" onSubmit={onSubmit}>
      {isEditing ? (
        <>
          {/* Row 1: dropdowns + tie */}
          <div className="result-inline-form-row">
            <select
              value={winnerTeamId}
              onChange={(event) => onWinnerChange(event.target.value)}
              disabled={tieGame}
            >
              <option value="">Winner</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id} disabled={team.id === loserTeamId}>
                  {team.name}
                </option>
              ))}
            </select>

            <select
              value={loserTeamId}
              onChange={(event) => onLoserChange(event.target.value)}
              disabled={tieGame}
            >
              <option value="">Loser</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id} disabled={team.id === winnerTeamId}>
                  {team.name}
                </option>
              ))}
            </select>

            <label className="result-inline-check">
              <input
                type="checkbox"
                checked={tieGame}
                onChange={(event) => onTieChange(event.target.checked)}
              />
              Tie
            </label>
          </div>

          {/* Row 2: action buttons always on their own line */}
          <div className="result-inline-form-row">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setWinnerTeamId(props.winnerTeamId ?? "");
                setLoserTeamId(props.loserTeamId ?? "");
                setTieGame(props.isTie);
                setStatus(null);
                setIsEditing(false);
              }}
            >
              Cancel
            </button>

            <button type="button" className="ghost-button" onClick={onWeatherCancel} disabled={saving}>
              ⛈ Weather
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            setStatus(null);
            setIsEditing(true);
          }}
        >
          Edit
        </button>
      )}

      {status ? (
        <span className={status.toLowerCase().includes("saved") ? "success-text" : "error-text"}>
          {status}
        </span>
      ) : null}
    </form>
  );
}

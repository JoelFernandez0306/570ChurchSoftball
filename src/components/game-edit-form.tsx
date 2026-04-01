"use client";

import { useState } from "react";
import type { CompetitionPhase } from "@/lib/types";

interface GameEditFormProps {
  gameId: string;
  gameDate: string;
  gameTime: string | null;
  location: string | null;
  gameNumber: number;
  gamePhase: CompetitionPhase;
  homeTeamId: string;
  awayTeamId: string;
  teams: { id: string; name: string }[];
  updateGameAction: (formData: FormData) => void | Promise<void>;
}

export function GameEditForm({
  gameId,
  gameDate,
  gameTime,
  location,
  gameNumber,
  gamePhase,
  homeTeamId,
  awayTeamId,
  teams,
  updateGameAction,
}: GameEditFormProps) {
  const [editing, setEditing] = useState(false);
  const [localHomeTeamId, setLocalHomeTeamId] = useState(homeTeamId);
  const [localAwayTeamId, setLocalAwayTeamId] = useState(awayTeamId);

  if (!editing) {
    return (
      <button type="button" className="secondary-button" onClick={() => setEditing(true)}>
        Edit
      </button>
    );
  }

  async function handleSubmit(formData: FormData) {
    await updateGameAction(formData);
    setEditing(false);
  }

  return (
    <form action={handleSubmit} className="form-grid" style={{ marginTop: "0.75rem" }}>
      <input type="hidden" name="game_id" value={gameId} />

      <label>
        Date
        <input name="game_date" type="date" defaultValue={gameDate} required />
      </label>

      <label>
        Time
        <input name="game_time" type="time" defaultValue={gameTime ?? ""} />
      </label>

      <label>
        Location
        <input name="location" defaultValue={location ?? ""} placeholder="570 Church Field" />
      </label>

      <label>
        Game slot
        <select name="game_number" defaultValue={String(gameNumber)} required>
          <option value="1">Game 1</option>
          <option value="2">Game 2</option>
        </select>
      </label>

      <label>
        Game phase
        <select name="game_phase" defaultValue={gamePhase} required>
          <option value="regular_season">Regular Season</option>
          <option value="playoffs">Playoffs</option>
        </select>
      </label>

      <label>
        Home team
        <select
          name="home_team_id"
          required
          value={localHomeTeamId}
          onChange={(e) => {
            setLocalHomeTeamId(e.target.value);
            if (e.target.value && e.target.value === localAwayTeamId) {
              setLocalAwayTeamId("");
            }
          }}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id} disabled={team.id === localAwayTeamId}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Away team
        <select
          name="away_team_id"
          required
          value={localAwayTeamId}
          onChange={(e) => {
            setLocalAwayTeamId(e.target.value);
            if (e.target.value && e.target.value === localHomeTeamId) {
              setLocalHomeTeamId("");
            }
          }}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id} disabled={team.id === localHomeTeamId}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <div style={{ alignSelf: "end", display: "flex", gap: "0.5rem" }}>
        <button type="submit">Save Changes</button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setLocalHomeTeamId(homeTeamId);
            setLocalAwayTeamId(awayTeamId);
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

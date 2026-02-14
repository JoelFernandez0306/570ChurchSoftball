"use client";

import { useEffect, useState } from "react";
import type { CompetitionPhase } from "@/lib/types";

const LAST_GAME_PHASE_STORAGE_KEY = "league.admin.schedule.lastGamePhase";

interface ScheduleBuilderFormProps {
  teams: { id: string; name: string }[];
  initialGamePhase?: CompetitionPhase;
  defaultGamePhase: CompetitionPhase;
  createGameAction: (formData: FormData) => void | Promise<void>;
}

export function ScheduleBuilderForm({
  teams,
  initialGamePhase,
  defaultGamePhase,
  createGameAction,
}: ScheduleBuilderFormProps) {
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [gamePhase, setGamePhase] = useState<CompetitionPhase>(defaultGamePhase);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (initialGamePhase) {
      setGamePhase(initialGamePhase);
      window.localStorage.setItem(LAST_GAME_PHASE_STORAGE_KEY, initialGamePhase);
      return;
    }

    const savedPhase = window.localStorage.getItem(LAST_GAME_PHASE_STORAGE_KEY);
    if (savedPhase === "playoffs" || savedPhase === "regular_season") {
      setGamePhase(savedPhase);
      return;
    }

    setGamePhase(defaultGamePhase);
  }, [initialGamePhase, defaultGamePhase]);

  function onHomeTeamChange(value: string) {
    setHomeTeamId(value);
    if (value && value === awayTeamId) {
      setAwayTeamId("");
    }
  }

  function onAwayTeamChange(value: string) {
    setAwayTeamId(value);
    if (value && value === homeTeamId) {
      setHomeTeamId("");
    }
  }

  async function submitAction(formData: FormData) {
    const submittedPhase = String(formData.get("game_phase") ?? "");
    const normalizedPhase =
      submittedPhase === "playoffs" ? "playoffs" : "regular_season";

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_GAME_PHASE_STORAGE_KEY, normalizedPhase);
    }

    setGamePhase(normalizedPhase);
    setHomeTeamId("");
    setAwayTeamId("");

    await createGameAction(formData);
  }

  return (
    <form action={submitAction} className="form-grid">
      <label>
        Date
        <input name="game_date" type="date" required />
      </label>

      <label>
        Time
        <input name="game_time" type="time" />
      </label>

      <label>
        Location
        <input name="location" placeholder="570 Church Field" />
      </label>

      <label>
        Game slot
        <select name="game_number" defaultValue="1" required>
          <option value="1">Game 1</option>
          <option value="2">Game 2</option>
        </select>
      </label>

      <label>
        Game phase
        <select
          name="game_phase"
          value={gamePhase}
          onChange={(event) => {
            const nextPhase =
              event.target.value === "playoffs" ? "playoffs" : "regular_season";
            setGamePhase(nextPhase);

            if (typeof window !== "undefined") {
              window.localStorage.setItem(LAST_GAME_PHASE_STORAGE_KEY, nextPhase);
            }
          }}
          required
        >
          <option value="regular_season">Regular Season</option>
          <option value="playoffs">Playoffs</option>
        </select>
      </label>

      <label>
        Home team
        <select
          name="home_team_id"
          required
          value={homeTeamId}
          onChange={(event) => onHomeTeamChange(event.target.value)}
        >
          <option value="" disabled>
            Select
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id} disabled={team.id === awayTeamId}>
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
          value={awayTeamId}
          onChange={(event) => onAwayTeamChange(event.target.value)}
        >
          <option value="" disabled>
            Select
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id} disabled={team.id === homeTeamId}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <div style={{ alignSelf: "end" }}>
        <button type="submit">Add Game Slot</button>
      </div>
    </form>
  );
}

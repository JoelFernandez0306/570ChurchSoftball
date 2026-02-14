"use client";

import { useEffect, useState } from "react";

const LAST_TEAM_STORAGE_KEY = "league.admin.roster.lastTeamId";

interface RosterBuilderFormProps {
  teams: { id: string; name: string }[];
  initialTeamId?: string;
  createPlayerAction: (formData: FormData) => void | Promise<void>;
}

export function RosterBuilderForm({
  teams,
  initialTeamId,
  createPlayerAction,
}: RosterBuilderFormProps) {
  const [teamId, setTeamId] = useState(initialTeamId ?? "");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (initialTeamId && teams.some((team) => team.id === initialTeamId)) {
      setTeamId(initialTeamId);
      window.localStorage.setItem(LAST_TEAM_STORAGE_KEY, initialTeamId);
      return;
    }

    const savedTeamId = window.localStorage.getItem(LAST_TEAM_STORAGE_KEY);
    if (savedTeamId && teams.some((team) => team.id === savedTeamId)) {
      setTeamId(savedTeamId);
    }
  }, [initialTeamId, teams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!teamId) {
      return;
    }

    if (!teams.some((team) => team.id === teamId)) {
      window.localStorage.removeItem(LAST_TEAM_STORAGE_KEY);
      setTeamId("");
    }
  }, [teamId, teams]);

  function onTeamChange(value: string) {
    setTeamId(value);
    if (typeof window === "undefined") {
      return;
    }

    if (value) {
      window.localStorage.setItem(LAST_TEAM_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(LAST_TEAM_STORAGE_KEY);
    }
  }

  async function submitAction(formData: FormData) {
    const submittedTeamId = String(formData.get("team_id") ?? "");

    if (typeof window !== "undefined") {
      if (submittedTeamId) {
        window.localStorage.setItem(LAST_TEAM_STORAGE_KEY, submittedTeamId);
      } else {
        window.localStorage.removeItem(LAST_TEAM_STORAGE_KEY);
      }
    }

    await createPlayerAction(formData);
  }

  return (
    <form action={submitAction} className="form-grid">
      <label>
        Team
        <select name="team_id" required value={teamId} onChange={(event) => onTeamChange(event.target.value)}>
          <option value="" disabled>
            Select team
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Full name
        <input name="full_name" placeholder="John Smith" required />
      </label>

      <label>
        Jersey # (optional)
        <input name="jersey_number" placeholder="12" />
      </label>

      <label>
        Role
        <select name="role" defaultValue="player">
          <option value="player">Player</option>
          <option value="coach">Coach</option>
        </select>
      </label>

      <div style={{ alignSelf: "end" }}>
        <button type="submit">Add To Roster</button>
      </div>
    </form>
  );
}

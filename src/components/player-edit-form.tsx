"use client";

import { useState } from "react";

interface PlayerEditFormProps {
  playerId: string;
  fullName: string;
  jerseyNumber: string | null;
  role: "player" | "coach";
  updatePlayerAction: (formData: FormData) => void | Promise<void>;
}

export function PlayerEditForm({
  playerId,
  fullName,
  jerseyNumber,
  role,
  updatePlayerAction,
}: PlayerEditFormProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" className="ghost-button" onClick={() => setEditing(true)}>
        Edit
      </button>
    );
  }

  async function handleSubmit(formData: FormData) {
    await updatePlayerAction(formData);
    setEditing(false);
  }

  return (
    <form action={handleSubmit} style={{ marginTop: "0.5rem" }}>
      <input type="hidden" name="player_id" value={playerId} />
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr auto auto" }}>
        <label>
          Full name
          <input name="full_name" defaultValue={fullName} required />
        </label>
        <label>
          Jersey #
          <input name="jersey_number" defaultValue={jerseyNumber ?? ""} placeholder="Optional" />
        </label>
        <label>
          Role
          <select name="role" defaultValue={role}>
            <option value="player">Player</option>
            <option value="coach">Coach</option>
          </select>
        </label>
        <div style={{ alignSelf: "end" }}>
          <button type="submit">Save</button>
        </div>
        <div style={{ alignSelf: "end" }}>
          <button type="button" className="secondary-button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

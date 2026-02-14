"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface SeasonManagerFormProps {
  activeSeasonName: string;
  currentSeasonGameCount: number;
}

export function SeasonManagerForm({
  activeSeasonName,
  currentSeasonGameCount,
}: SeasonManagerFormProps) {
  const router = useRouter();
  const [seasonName, setSeasonName] = useState(activeSeasonName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const nextSeason = seasonName.trim();
    if (!nextSeason) {
      setStatus("Season name is required.");
      return;
    }

    const changedSeason = nextSeason !== activeSeasonName;
    let confirmNewSeason = false;

    if (changedSeason && currentSeasonGameCount > 0) {
      const accepted = window.confirm(
        "Changing the season starts a new season. Standings and schedule will switch to the new season. Continue?",
      );

      if (!accepted) {
        return;
      }

      confirmNewSeason = true;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonName: nextSeason,
          confirmNewSeason,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(payload.error ?? "Failed to update season.");
        return;
      }

      setStatus(payload.message ?? "Season updated.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update season.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="form-grid">
        <label>
          Active season
          <input
            name="season_name"
            value={seasonName}
            onChange={(event) => setSeasonName(event.target.value)}
            placeholder="Summer Season 2026"
            required
          />
        </label>

        <div style={{ alignSelf: "end" }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Season"}
          </button>
        </div>
      </div>

      {currentSeasonGameCount > 0 ? (
        <p className="footer-note">
          Warning: changing season name starts a new season. Existing {activeSeasonName} games stay
          saved, and standings will be calculated for the new season only.
        </p>
      ) : null}

      {status ? (
        <p className={status.toLowerCase().includes("updated") ? "success-text" : "error-text"}>
          {status}
        </p>
      ) : null}
    </form>
  );
}

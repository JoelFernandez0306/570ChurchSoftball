"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface TieOverrideFormProps {
  teamId: string;
  currentPriority: number | null;
}

export function TieOverrideForm({ teamId, currentPriority }: TieOverrideFormProps) {
  const [priority, setPriority] = useState(currentPriority ? String(currentPriority) : "");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const numericPriority = priority.trim() ? Number(priority.trim()) : null;
      const response = await fetch("/api/admin/tie-override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          priority: Number.isFinite(numericPriority) ? numericPriority : null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Failed to save override");
        return;
      }

      setMessage("Saved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save override");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submitOverride} className="inline-list" style={{ alignItems: "center" }}>
      <input
        aria-label="Override priority"
        value={priority}
        onChange={(event) => setPriority(event.target.value)}
        placeholder="Priority"
        inputMode="numeric"
        style={{ width: 96 }}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        className="ghost-button"
        onClick={() => {
          setPriority("");
          void fetch("/api/admin/tie-override", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, priority: null }),
          }).then(() => router.refresh());
        }}
      >
        Clear
      </button>
      {message ? <span className="footer-note">{message}</span> : null}
    </form>
  );
}

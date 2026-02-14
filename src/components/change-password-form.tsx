"use client";

import { FormEvent, useState } from "react";
import { PasswordInput } from "@/components/password-input";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsError(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus("All password fields are required.");
      setIsError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus("New password and confirmation do not match.");
      setIsError(true);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(payload.error ?? "Failed to update password.");
        setIsError(true);
        return;
      }

      setStatus(payload.message ?? "Password updated successfully.");
      setIsError(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="form-grid">
        <label>
          Current password
          <PasswordInput
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>

        <label>
          New password
          <PasswordInput
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </label>

        <label>
          Confirm new password
          <PasswordInput
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
      </div>

      <div>
        <button type="submit" disabled={saving}>
          {saving ? "Updating..." : "Update Password"}
        </button>
      </div>

      {status ? <p className={isError ? "error-text" : "success-text"}>{status}</p> : null}
    </form>
  );
}

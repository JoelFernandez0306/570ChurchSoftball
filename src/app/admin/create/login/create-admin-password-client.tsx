"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type InviteAccessState = "checking" | "allowed" | "blocked";

export function CreateAdminPasswordClient() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<InviteAccessState>("checking");
  const [inviteContext, setInviteContext] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(
    () => accessState === "allowed" && !saving,
    [accessState, saving],
  );

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let cancelled = false;

    const assessAccess = async (userOverride?: { email?: string | null } | null) => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hasInviteFlag = query.get("invite") === "1" || hash.get("type") === "invite";
      setInviteContext(hasInviteFlag);

      const user =
        userOverride ??
        (await supabase.auth.getUser().then(({ data }) => data.user).catch(() => null));

      if (cancelled) {
        return;
      }

      if (hasInviteFlag && user) {
        setAccessState("allowed");
        setEmail(user.email ?? "");
        setStatusMessage(null);
        return;
      }

      if (hasInviteFlag) {
        setAccessState("checking");
        return;
      }

      setAccessState("blocked");
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void assessAccess(session?.user ?? null);
    });

    void assessAccess();

    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setAccessState((state) => (state === "checking" ? "blocked" : state));
      }
    }, 3000);

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setIsError(false);

    if (password.length < 8) {
      setStatusMessage("Password must be at least 8 characters.");
      setIsError(true);
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage("Password and confirm password do not match.");
      setIsError(true);
      return;
    }

    setSaving(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setStatusMessage(error.message);
        setIsError(true);
        return;
      }

      setStatusMessage("Password created. Redirecting to admin dashboard...");
      setIsError(false);
      setPassword("");
      setConfirmPassword("");
      router.push("/admin/dashboard");
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to create password.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="main-shell content-width" style={{ paddingTop: "1.5rem" }}>
      <section className="page-surface" style={{ maxWidth: 620, marginInline: "auto" }}>
        <div className="page-header">
          <div>
            <h2>Create Admin Password</h2>
            <p>Use your invite link to set your password and activate admin sign in.</p>
          </div>
        </div>

        {accessState === "checking" ? (
          <p className="footer-note">
            Validating invite session...
          </p>
        ) : null}

        {accessState === "blocked" ? (
          <div className="stack">
            <p className="error-text">
              This page is invite-only. Open it from your admin invite email.
            </p>
            {!inviteContext ? (
              <p className="footer-note">
                Invite link is missing or invalid. Request a new invite from an admin.
              </p>
            ) : (
              <p className="footer-note">
                Invite session was not detected. The invite link may be expired; request a new
                invite.
              </p>
            )}
            <p className="footer-note">
              Go to <Link href="/admin/login">Admin Login</Link>.
            </p>
          </div>
        ) : null}

        {accessState === "allowed" ? (
          <form className="stack" onSubmit={handleSubmit}>
            <label>
              Invited email
              <input type="email" value={email} readOnly />
            </label>

            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>

            <div>
              <button type="submit" disabled={!canSubmit}>
                {saving ? "Saving..." : "Create Password"}
              </button>
            </div>
          </form>
        ) : null}

        {statusMessage ? (
          <p className={isError ? "error-text" : "success-text"} style={{ marginTop: "0.75rem" }}>
            {statusMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}

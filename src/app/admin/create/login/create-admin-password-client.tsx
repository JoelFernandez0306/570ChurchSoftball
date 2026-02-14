"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type InviteAccessState = "checking" | "allowed" | "blocked";
const SUPABASE_AUTH_QUERY_PARAMS = ["code", "token_hash", "type", "access_token", "refresh_token"];

function normalizeOtpType(value: string | null): EmailOtpType | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (
    normalized === "signup" ||
    normalized === "recovery" ||
    normalized === "invite" ||
    normalized === "magiclink" ||
    normalized === "email_change" ||
    normalized === "email"
  ) {
    return normalized;
  }

  return null;
}

function removeAuthParamsFromCurrentUrl() {
  const currentUrl = new URL(window.location.href);
  for (const key of SUPABASE_AUTH_QUERY_PARAMS) {
    currentUrl.searchParams.delete(key);
  }

  const hash = currentUrl.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  for (const key of SUPABASE_AUTH_QUERY_PARAMS) {
    hashParams.delete(key);
  }
  const nextHash = hashParams.toString();
  currentUrl.hash = nextHash ? `#${nextHash}` : "";

  window.history.replaceState({}, "", currentUrl.toString());
}

export function CreateAdminPasswordClient() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<InviteAccessState>("checking");
  const [inviteContext, setInviteContext] = useState(false);
  const [expectedInviteEmail, setExpectedInviteEmail] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [mismatchMessage, setMismatchMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const canSubmit = useMemo(
    () => accessState === "allowed" && !saving,
    [accessState, saving],
  );

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let cancelled = false;
    let tokenHandled = false;

    const hydrateInviteSessionFromUrl = async () => {
      if (tokenHandled) {
        return;
      }

      tokenHandled = true;
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const inviteType = normalizeOtpType(query.get("type") ?? hash.get("type"));
      const code = query.get("code");
      const tokenHash = query.get("token_hash");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          removeAuthParamsFromCurrentUrl();
        }
        return;
      }

      if (tokenHash && inviteType) {
        const { error } = await supabase.auth.verifyOtp({
          type: inviteType,
          token_hash: tokenHash,
        });
        if (!error) {
          removeAuthParamsFromCurrentUrl();
        }
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          removeAuthParamsFromCurrentUrl();
        }
      }
    };

    const assessAccess = async (userOverride?: { email?: string | null } | null) => {
      await hydrateInviteSessionFromUrl();
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const invitedFromQuery = query.get("invited_email")?.trim().toLowerCase() ?? "";
      const invitedFromHash = hash.get("invited_email")?.trim().toLowerCase() ?? "";
      const invitedEmail = invitedFromQuery || invitedFromHash;
      const hasInviteFlag =
        query.get("invite") === "1" || hash.get("type") === "invite" || invitedEmail.length > 0;
      setInviteContext(hasInviteFlag);
      setExpectedInviteEmail(invitedEmail);

      const user =
        userOverride ??
        (await supabase.auth.getUser().then(({ data }) => data.user).catch(() => null));

      if (cancelled) {
        return;
      }

      const normalizedUserEmail = user?.email?.trim().toLowerCase() ?? "";
      setSessionEmail(normalizedUserEmail);

      if (hasInviteFlag && user) {
        if (invitedEmail && normalizedUserEmail !== invitedEmail) {
          setAccessState("blocked");
          setMismatchMessage(
            `This invite is for ${invitedEmail}, but you are signed in as ${normalizedUserEmail || "another account"}.`,
          );
          return;
        }

        setMismatchMessage(null);
        setAccessState("allowed");
        setEmail(invitedEmail || user.email || "");
        setStatusMessage(null);
        return;
      }

      if (hasInviteFlag) {
        setMismatchMessage(null);
        setAccessState("checking");
        return;
      }

      setMismatchMessage(null);
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

  async function handleSignOut() {
    setSigningOut(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setStatusMessage(error.message);
        setIsError(true);
        return;
      }

      setStatusMessage("Signed out. Open your invite email and click the invite link again.");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setAccessState("blocked");
      setMismatchMessage(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to sign out.");
      setIsError(true);
    } finally {
      setSigningOut(false);
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
            {mismatchMessage ? (
              <>
                <p className="error-text">{mismatchMessage}</p>
                <p className="footer-note">
                  Invited email: {expectedInviteEmail || "not provided"}
                  <br />
                  Current session: {sessionEmail || "none"}
                </p>
                <div>
                  <button type="button" onClick={handleSignOut} disabled={signingOut}>
                    {signingOut ? "Signing out..." : "Sign Out"}
                  </button>
                </div>
              </>
            ) : null}
            {!mismatchMessage && !inviteContext ? (
              <p className="footer-note">
                Invite link is missing or invalid. Request a new invite from an admin.
              </p>
            ) : null}
            {!mismatchMessage && inviteContext ? (
              <p className="footer-note">
                Invite session was not detected. The invite link may be expired; request a new
                invite.
              </p>
            ) : null}
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

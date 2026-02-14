"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

interface AdminLoginClientProps {
  errorParam: string | null;
}

export function AdminLoginClient({ errorParam }: AdminLoginClientProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [hasAdmins, setHasAdmins] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/api/admin/bootstrap-status")
      .then((response) => response.json())
      .then((payload) => {
        if (!mounted) return;
        setHasAdmins(Boolean(payload.hasAdmins));
      })
      .catch(() => {
        if (!mounted) return;
        setHasAdmins(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatusMessage(error.message);
        return;
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBootstrap() {
    setIsBootstrapping(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bootstrap", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        setStatusMessage(payload.error ?? "Failed to bootstrap first admin");
        return;
      }

      setStatusMessage(payload.message ?? "First admin created successfully.");
      setHasAdmins(true);
      router.push("/admin/dashboard");
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Bootstrap failed");
    } finally {
      setIsBootstrapping(false);
    }
  }

  return (
    <main className="main-shell content-width" style={{ paddingTop: "1.5rem" }}>
      <section className="page-surface" style={{ maxWidth: 560, marginInline: "auto" }}>
        <div className="page-header">
          <div>
            <h2>Admin Login</h2>
            <p>Sign in to manage teams, rules, schedules, standings, and SMS reporting.</p>
          </div>
        </div>

        {errorParam === "not-admin" ? (
          <p className="error-text" style={{ marginBottom: "0.75rem" }}>
            Your account is authenticated but not authorized as an admin.
          </p>
        ) : null}

        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {statusMessage ? (
          <p
            className={
              statusMessage.toLowerCase().includes("failed") || statusMessage.toLowerCase().includes("not")
                ? "error-text"
                : "success-text"
            }
            style={{ marginTop: "0.75rem" }}
          >
            {statusMessage}
          </p>
        ) : null}

        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>First-time setup</h3>
          <p>
            If no admins exist yet, sign in first, then bootstrap your account as the initial admin.
          </p>
          <button
            type="button"
            className="ghost-button"
            onClick={handleBootstrap}
            disabled={isBootstrapping || hasAdmins === true}
            style={{ marginTop: "0.65rem" }}
          >
            {isBootstrapping ? "Bootstrapping..." : "Bootstrap First Admin"}
          </button>
          {hasAdmins === true ? (
            <p className="footer-note">An admin already exists. Ask an admin to add your account.</p>
          ) : null}
        </div>

        <p className="footer-note" style={{ marginTop: "0.75rem" }}>
          Need public pages? Go back to <Link href="/">league home</Link>.
        </p>
      </section>
    </main>
  );
}

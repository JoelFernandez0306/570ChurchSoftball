"use client";

import { FormEvent, useState } from "react";
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

        <p className="footer-note" style={{ marginTop: "0.75rem" }}>
          Need public pages? Go back to <Link href="/">league home</Link>.
        </p>
      </section>
    </main>
  );
}

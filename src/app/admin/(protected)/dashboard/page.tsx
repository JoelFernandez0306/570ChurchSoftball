import Link from "next/link";
import { ChangePasswordForm } from "@/components/change-password-form";
import {
  formatCompetitionPhaseLabel,
  loadActiveCompetitionPhase,
  loadActiveSeasonName,
  loadGamesView,
  loadTeamsWithRoster,
  loadAllowedSmsNumbers,
  loadAdmins,
  loadGcOrgStatsUrl,
  loadGcOrgScoreboardWidgetId,
} from "@/lib/league-data";
import { loadStandings } from "@/lib/standings";
import {
  removeAdminAction,
  saveGcOrgStatsUrlAction,
  saveGcOrgScoreboardWidgetIdAction,
} from "@/app/admin/(protected)/actions";

export const dynamic = "force-dynamic";

type DashboardSearchParams = {
  invite_error?: string;
  invite_success?: string;
};

type AdminDashboardPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const inviteError =
    typeof resolvedSearchParams?.invite_error === "string"
      ? resolvedSearchParams.invite_error
      : "";
  const inviteSuccess = resolvedSearchParams?.invite_success === "1";

  const [teams, games, standings, smsNumbers, admins, activeSeasonName, activeCompetitionPhase, gcOrgStatsUrl, gcOrgScoreboardWidgetId] =
    await Promise.all([
    loadTeamsWithRoster(),
    loadGamesView(),
    loadStandings(),
    loadAllowedSmsNumbers(),
    loadAdmins(),
    loadActiveSeasonName(),
    loadActiveCompetitionPhase(),
    loadGcOrgStatsUrl(),
    loadGcOrgScoreboardWidgetId(),
    ]);

  const reported = games.filter((game) => game.winner_team_id || game.is_tie).length;

  return (
    <>
      <section className="page-surface">
        <div className="page-header">
          <div>
            <h2>Admin Dashboard</h2>
            <p>
              Manage league setup, report results, and maintain standings for {activeSeasonName} (
              {formatCompetitionPhaseLabel(activeCompetitionPhase)}).
            </p>
          </div>
        </div>

        <div className="card-grid">
          <article className="card">
            <h3>Teams</h3>
            <p>{teams.length} active teams configured.</p>
            <p className="footer-note">
              <Link href="/admin/teams">Manage teams and aliases</Link>
            </p>
          </article>

          <article className="card">
            <h3>Games</h3>
            <p>
              {games.length} scheduled, {reported} reported.
            </p>
            <p className="footer-note">
              <Link href="/admin/schedule">Manage schedule and results</Link>
            </p>
          </article>

          <article className="card">
            <h3>Standings</h3>
            <p>{standings.length} teams in standings table.</p>
            <p className="footer-note">
              <Link href="/admin/standings">Manage tie overrides</Link>
            </p>
          </article>

          <article className="card">
            <h3>SMS Reporters</h3>
            <p>{smsNumbers.filter((number) => number.active).length} allowed numbers.</p>
            <p className="footer-note">
              <Link href="/admin/sms">Manage Twilio reporting numbers</Link>
            </p>
          </article>
        </div>
      </section>

      <section className="page-surface">
        <div className="page-header">
          <div>
            <h3>Quick links</h3>
            <p>Fast paths for game-day updates.</p>
          </div>
        </div>

        <div className="inline-list">
          <Link className="button" href="/admin/quick-result">
            Quick Game Score Entry
          </Link>
          <Link className="button" href="/admin/schedule">
            Full Schedule Admin
          </Link>
          <Link className="button" href="/standings">
            View Public Standings
          </Link>
        </div>
      </section>

      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h3>GameChanger Integration</h3>
            <p>
              Connect your GameChanger Organization to power live scoreboards and player stats.
            </p>
          </div>
        </div>

        <div className="stack">
          <div>
            <h4 style={{ margin: "0 0 0.4rem" }}>Live Scoreboard</h4>
            <p style={{ margin: "0 0 0.6rem", color: "var(--ink-soft)", fontSize: "0.9rem" }}>
              Shown automatically on the home page on game days. Updates live as scorekeepers enter plays — no extra steps needed.
            </p>
            <form action={saveGcOrgScoreboardWidgetIdAction} className="form-grid">
              <label>
                Scoreboard Widget ID
                <input
                  name="gamechanger_org_scoreboard_widget_id"
                  type="text"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  defaultValue={gcOrgScoreboardWidgetId ?? ""}
                />
              </label>
              <div style={{ alignSelf: "end" }}>
                <button type="submit">Save</button>
              </div>
            </form>
            <p className="footer-note">
              From GameChanger: Organization &rarr; Tools &rarr; Create Scoreboard Widget &rarr; copy the <code>widgetId</code> value from the embed code (looks like <code>6afd8788-0c02-46a2-8859-...</code>).
            </p>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "0.25rem 0" }} />

          <div>
            <h4 style={{ margin: "0 0 0.4rem" }}>Player Stats Leaderboard</h4>
            <p style={{ margin: "0 0 0.6rem", color: "var(--ink-soft)", fontSize: "0.9rem" }}>
              Displayed on the public{" "}
              <a href="/stats" target="_blank" rel="noopener noreferrer">/stats</a>{" "}
              page. Updates automatically after every scored game.
            </p>
            <form action={saveGcOrgStatsUrlAction} className="form-grid">
              <label>
                Organization Stats URL
                <input
                  name="gamechanger_org_stats_url"
                  type="url"
                  placeholder="https://web.gc.com/organizations/..."
                  defaultValue={gcOrgStatsUrl ?? ""}
                />
              </label>
              <div style={{ alignSelf: "end" }}>
                <button type="submit">Save</button>
              </div>
            </form>
            <p className="footer-note">
              From GameChanger: Organization &rarr; Share with Fans &rarr; copy the Leaderboard URL.
            </p>
          </div>
        </div>
      </section>

      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h3>Admin Access</h3>
            <p>Add existing users or send invite emails for new admins.</p>
          </div>
        </div>

        <form action="/api/admin/invite" method="post" className="form-grid">
          <label>
            Admin email
            <input name="email" type="email" placeholder="admin@example.com" required />
          </label>

          <label>
            Display name (optional)
            <input name="full_name" placeholder="Commissioner Name" />
          </label>

          <div style={{ alignSelf: "end" }}>
            <button type="submit">Add / Invite Admin</button>
          </div>
        </form>

        <p className="footer-note">
          If the email is new, the system sends an invite email automatically.
        </p>
        {inviteSuccess ? (
          <p className="success-text">Admin invite sent successfully.</p>
        ) : null}
        {inviteError ? (
          <p className="error-text">{inviteError}</p>
        ) : null}

        <div className="stack">
          {admins.map((admin) => (
            <article className="card" key={admin.id}>
              <div className="page-header">
                <div>
                  <h4 style={{ margin: 0 }}>{admin.full_name ?? "League Admin"}</h4>
                  <p>User ID: {admin.user_id}</p>
                </div>
                <form action={removeAdminAction}>
                  <input type="hidden" name="admin_id" value={admin.id} />
                  <button type="submit" className="danger-button">
                    Remove
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h3>Security</h3>
            <p>Change your admin password.</p>
          </div>
        </div>
        <ChangePasswordForm />
      </section>
    </>
  );
}

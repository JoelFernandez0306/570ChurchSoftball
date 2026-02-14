import Link from "next/link";
import { ChangePasswordForm } from "@/components/change-password-form";
import {
  loadGamesView,
  loadTeamsWithRoster,
  loadAllowedSmsNumbers,
  loadAdmins,
} from "@/lib/league-data";
import { loadStandings } from "@/lib/standings";
import {
  addAdminByEmailAction,
  removeAdminAction,
} from "@/app/admin/(protected)/actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [teams, games, standings, smsNumbers, admins] = await Promise.all([
    loadTeamsWithRoster(),
    loadGamesView(),
    loadStandings(),
    loadAllowedSmsNumbers(),
    loadAdmins(),
  ]);

  const reported = games.filter((game) => game.winner_team_id || game.is_tie).length;

  return (
    <>
      <section className="page-surface">
        <div className="page-header">
          <div>
            <h2>Admin Dashboard</h2>
            <p>Manage league setup, report results, and maintain standings.</p>
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
            <h3>Admin Access</h3>
            <p>Add existing users or send invite emails for new admins.</p>
          </div>
        </div>

        <form action={addAdminByEmailAction} className="form-grid">
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

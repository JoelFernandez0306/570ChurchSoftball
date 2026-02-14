import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ScheduleTable } from "@/components/schedule-table";
import { StandingsTable } from "@/components/standings-table";
import {
  formatCompetitionPhaseLabel,
  loadActiveCompetitionPhase,
  loadActiveSeasonName,
  loadGamesView,
  loadTeamsWithRoster,
} from "@/lib/league-data";
import { loadStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [games, standings, teams, activeSeasonName, activeCompetitionPhase] = await Promise.all([
    loadGamesView(),
    loadStandings(),
    loadTeamsWithRoster(),
    loadActiveSeasonName(),
    loadActiveCompetitionPhase(),
  ]);

  const topThree = standings.slice(0, 3);
  const nextGames = games.filter((game) => !game.winner_team_id && !game.is_tie).slice(0, 8);

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface hero-grid">
          <div className="stack">
            <div className="page-header">
              <div>
                <h2>Season Headquarters</h2>
                <p>
                  Follow every matchup, roster move, and standings update in one place for{" "}
                  {activeSeasonName} ({formatCompetitionPhaseLabel(activeCompetitionPhase)}).
                </p>
              </div>
            </div>

            <div className="card-grid">
              <article className="card">
                <h3>Teams</h3>
                <p>{teams.length} churches competing this season.</p>
              </article>
              <article className="card">
                <h3>Games Scheduled</h3>
                <p>{games.length} total game slots (doubleheaders included).</p>
              </article>
              <article className="card">
                <h3>Results Reported</h3>
                <p>{games.filter((game) => game.winner_team_id || game.is_tie).length} final results posted.</p>
              </article>
            </div>
          </div>

          <aside className="card">
            <h3>Top of the Table</h3>
            {topThree.length === 0 ? (
              <p className="empty-state">Standings will appear after results are recorded.</p>
            ) : (
              <ol className="stack" style={{ margin: 0, paddingInlineStart: "1rem" }}>
                {topThree.map((row) => (
                  <li key={row.teamId}>
                    <strong>{row.teamName}</strong>
                    <div className="footer-note">
                      {row.wins}-{row.losses}-{row.ties} ({row.winPct.toFixed(3)})
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <p className="footer-note" style={{ marginTop: "0.9rem" }}>
              Full details on the <Link href="/standings">Standings page</Link>.
            </p>
          </aside>
        </section>

        <section className="page-surface">
          <div className="page-header">
            <div>
              <h3>Upcoming Schedule</h3>
              <p>Date, time, location, and result status.</p>
            </div>
            <Link className="button" href="/schedule">
              View All Games
            </Link>
          </div>
          <ScheduleTable games={nextGames.length > 0 ? nextGames : games.slice(0, 8)} />
        </section>

        <section className="page-surface">
          <div className="page-header">
            <div>
              <h3>Current Standings</h3>
              <p>Winning percentage, head-to-head, and tie overrides.</p>
            </div>
            <Link className="button" href="/standings">
              Full Standings
            </Link>
          </div>
          <StandingsTable rows={standings} />
        </section>
      </main>
    </>
  );
}

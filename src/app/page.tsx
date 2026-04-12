import Link from "next/link";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { SiteHeader } from "@/components/site-header";
import { ScheduleTable } from "@/components/schedule-table";
import { StandingsTable } from "@/components/standings-table";
import { GcScoreboardWidget } from "@/components/gc-scoreboard-widget";
import {
  formatCompetitionPhaseLabel,
  loadActiveCompetitionPhase,
  loadActiveSeasonName,
  loadGamesView,
  loadGcOrgScoreboardWidgetId,
  loadLeagueSettings,
} from "@/lib/league-data";
import { loadStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

function formatGameTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatGameDate(date: string): string {
  return format(parseISO(date + "T12:00:00"), "EEE, MMM d");
}

export default async function HomePage() {
  const [games, standings, activeSeasonName, activeCompetitionPhase, gcOrgScoreboardWidgetId, settings] =
    await Promise.all([
      loadGamesView(),
      loadStandings(),
      loadActiveSeasonName(),
      loadActiveCompetitionPhase(),
      loadGcOrgScoreboardWidgetId(),
      loadLeagueSettings(),
    ]);

  const today = formatInTimeZone(new Date(), settings.timezone, "yyyy-MM-dd");
  const isGameDay = games.some((g) => g.game_date === today);
  const hasScoreboardWidget = Boolean(gcOrgScoreboardWidgetId);

  const unplayed = games.filter((g) => !g.winner_team_id && !g.is_tie);
  const nextGameDate = unplayed.find((g) => g.game_date >= today)?.game_date ?? null;
  const nextGame = nextGameDate ? unplayed.find((g) => g.game_date === nextGameDate) ?? null : null;

  const topThree = standings.slice(0, 3);
  const nextGames = unplayed.slice(0, 8);

  const topOfTable = (
    <>
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
    </>
  );

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface stack">
          <div className="page-header">
            <div>
              <h2>Season Headquarters</h2>
              <p>
                Follow every matchup, roster move, and standings update in one place for{" "}
                {activeSeasonName} ({formatCompetitionPhaseLabel(activeCompetitionPhase)}).
              </p>
            </div>
          </div>

          {isGameDay && hasScoreboardWidget ? (
            <>
              {/* Game day — full-width live scoreboard */}
              <aside className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                  <h3 style={{ margin: 0 }}>Live Scoreboard</h3>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    fontSize: "0.78rem", fontWeight: 700, color: "#155c35",
                    background: "#cbeed7", borderRadius: "999px", padding: "0.2rem 0.6rem",
                  }}>
                    <span style={{ fontSize: "0.6rem" }}>●</span> Game Day
                  </span>
                </div>
                <GcScoreboardWidget widgetId={gcOrgScoreboardWidgetId!} />
              </aside>

              {/* Top of table below on game day */}
              <div className="card-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <aside className="card">
                  <h3>Top of the Table</h3>
                  {topOfTable}
                </aside>
              </div>
            </>
          ) : (
            /* Non-game day — 2-column grid */
            <div className="card-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <aside className="card">
                <h3>Live Scoreboard</h3>
                {isGameDay && !hasScoreboardWidget ? (
                  <p className="empty-state">
                    Games are on today! Scoreboard setup pending — check back soon.
                  </p>
                ) : nextGame ? (
                  <p className="empty-state">
                    No live game right now.{" "}
                    Next up:{" "}
                    <strong>{formatGameDate(nextGame.game_date)}</strong>
                    {nextGame.game_time ? <> at <strong>{formatGameTime(nextGame.game_time)}</strong></> : null}.
                  </p>
                ) : (
                  <p className="empty-state">No upcoming games scheduled.</p>
                )}
              </aside>

              <aside className="card">
                <h3>Top of the Table</h3>
                {topOfTable}
              </aside>
            </div>
          )}
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

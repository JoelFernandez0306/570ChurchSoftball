import { SiteHeader } from "@/components/site-header";
import { StandingsTable } from "@/components/standings-table";
import { loadStandings } from "@/lib/standings";
import {
  countGamesForScope,
  formatCompetitionPhaseLabel,
  loadActiveCompetitionPhase,
  loadActiveSeasonName,
} from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const [activeSeasonName, activeCompetitionPhase] = await Promise.all([
    loadActiveSeasonName(),
    loadActiveCompetitionPhase(),
  ]);
  const [regularSeasonStandings, playoffStandings, playoffGameCount] = await Promise.all([
    loadStandings(activeSeasonName, "regular_season"),
    loadStandings(activeSeasonName, "playoffs"),
    countGamesForScope(activeSeasonName, "playoffs"),
  ]);
  const showPlayoffStandings = playoffGameCount > 0 || activeCompetitionPhase === "playoffs";

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>Standings</h2>
              <p>
                Ranked by winning percentage, then head-to-head, then admin tie override for the
                regular season.
              </p>
            </div>
            <span className="token" style={{ whiteSpace: "nowrap" }}>
              {activeCompetitionPhase === "regular_season" ? "Active: " : ""}
              {activeSeasonName} (Regular Season)
            </span>
          </div>
          <StandingsTable rows={regularSeasonStandings} />
        </section>

        {showPlayoffStandings ? (
          <section className="page-surface">
            <div className="page-header">
              <div>
                <h2>Standings</h2>
                <p>Playoff standings for this same season.</p>
              </div>
              <span className="token" style={{ whiteSpace: "nowrap" }}>
                {activeCompetitionPhase === "playoffs" ? "Active: " : ""}
                {activeSeasonName} ({formatCompetitionPhaseLabel("playoffs")})
              </span>
            </div>
            <StandingsTable rows={playoffStandings} />
          </section>
        ) : null}
      </main>
    </>
  );
}

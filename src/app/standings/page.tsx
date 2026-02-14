import { SiteHeader } from "@/components/site-header";
import { SeasonPicker } from "@/components/season-picker";
import { StandingsTable } from "@/components/standings-table";
import { loadStandings } from "@/lib/standings";
import {
  formatCompetitionPhaseLabel,
  loadActiveCompetitionPhase,
  loadActiveSeasonName,
  loadSeasonHistoryOptions,
  resolveSeasonSelection,
} from "@/lib/league-data";

export const dynamic = "force-dynamic";

type StandingsPageProps = {
  searchParams: Promise<{ season?: string }>;
};

export default async function StandingsPage({ searchParams }: StandingsPageProps) {
  const params = await searchParams;
  const [activeSeasonName, activeCompetitionPhase, seasonOptions] = await Promise.all([
    loadActiveSeasonName(),
    loadActiveCompetitionPhase(),
    loadSeasonHistoryOptions(6),
  ]);
  const selectedSeasonName = resolveSeasonSelection(params.season, seasonOptions, activeSeasonName);
  const selectedSeasonLabel =
    seasonOptions.find((season) => season.seasonName === selectedSeasonName)?.label ??
    selectedSeasonName;
  const isViewingActiveSeason = selectedSeasonName === activeSeasonName;
  const [regularSeasonStandings, playoffStandings] = await Promise.all([
    loadStandings(selectedSeasonName, "regular_season"),
    loadStandings(selectedSeasonName, "playoffs"),
  ]);

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
            <div style={{ display: "grid", justifyItems: "end", gap: "0.35rem" }}>
              <SeasonPicker options={seasonOptions} selectedSeasonName={selectedSeasonName} />
              <span className="token" style={{ whiteSpace: "nowrap" }}>
                {isViewingActiveSeason && activeCompetitionPhase === "regular_season" ? "Active: " : ""}
                {selectedSeasonLabel} (Regular Season)
              </span>
            </div>
          </div>
          <StandingsTable rows={regularSeasonStandings} />
        </section>

        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>Standings</h2>
              <p>Playoff standings for this same season.</p>
            </div>
            <span className="token" style={{ whiteSpace: "nowrap" }}>
              {isViewingActiveSeason && activeCompetitionPhase === "playoffs" ? "Active: " : ""}
              {selectedSeasonLabel} ({formatCompetitionPhaseLabel("playoffs")})
            </span>
          </div>
          <StandingsTable rows={playoffStandings} />
        </section>
      </main>
    </>
  );
}

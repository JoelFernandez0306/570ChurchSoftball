import { SiteHeader } from "@/components/site-header";
import { ScheduleTable } from "@/components/schedule-table";
import { SeasonPicker } from "@/components/season-picker";
import { getAuthenticatedUser, isAdminUser } from "@/lib/auth";
import {
  loadActiveSeasonName,
  loadGamesView,
  loadSeasonHistoryOptions,
  resolveSeasonSelection,
} from "@/lib/league-data";

export const dynamic = "force-dynamic";

type SchedulePageProps = {
  searchParams: Promise<{ season?: string }>;
};

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = await searchParams;
  const [activeSeasonName, user, seasonOptions] = await Promise.all([
    loadActiveSeasonName(),
    getAuthenticatedUser(),
    loadSeasonHistoryOptions(6),
  ]);
  const selectedSeasonName = resolveSeasonSelection(params.season, seasonOptions, activeSeasonName);
  const selectedSeasonLabel =
    seasonOptions.find((season) => season.seasonName === selectedSeasonName)?.label ??
    selectedSeasonName;

  const [regularSeasonGames, playoffGames] = await Promise.all([
    loadGamesView(selectedSeasonName, "regular_season"),
    loadGamesView(selectedSeasonName, "playoffs"),
  ]);
  const games = [...regularSeasonGames, ...playoffGames].sort((a, b) => {
    const dateCompare = a.game_date.localeCompare(b.game_date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const timeA = a.game_time ?? "99:99:99";
    const timeB = b.game_time ?? "99:99:99";
    const timeCompare = timeA.localeCompare(timeB);
    if (timeCompare !== 0) {
      return timeCompare;
    }

    return a.game_number - b.game_number;
  });

  let canEditResults = false;
  if (user) {
    try {
      canEditResults = await isAdminUser(user.id);
    } catch {
      canEditResults = false;
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>League Schedule</h2>
              <p>
                Doubleheader schedule with game-level winner/loss updates for {selectedSeasonLabel},
                including Regular Season and Playoff games.
              </p>
            </div>
            <SeasonPicker options={seasonOptions} selectedSeasonName={selectedSeasonName} />
          </div>
          <ScheduleTable games={games} canEditResults={canEditResults} />
        </section>
      </main>
    </>
  );
}

import { SiteHeader } from "@/components/site-header";
import { ScheduleTable } from "@/components/schedule-table";
import { getAuthenticatedUser, isAdminUser } from "@/lib/auth";
import {
  loadActiveSeasonName,
  loadGamesView,
} from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [activeSeasonName, user] = await Promise.all([
    loadActiveSeasonName(),
    getAuthenticatedUser(),
  ]);
  const [regularSeasonGames, playoffGames] = await Promise.all([
    loadGamesView(activeSeasonName, "regular_season"),
    loadGamesView(activeSeasonName, "playoffs"),
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
                Doubleheader schedule with game-level winner/loss updates for {activeSeasonName},
                including Regular Season and Playoff games.
              </p>
            </div>
          </div>
          <ScheduleTable games={games} canEditResults={canEditResults} />
        </section>
      </main>
    </>
  );
}

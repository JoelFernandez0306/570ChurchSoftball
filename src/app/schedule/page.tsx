import { SiteHeader } from "@/components/site-header";
import { ScheduleTable } from "@/components/schedule-table";
import { getAuthenticatedUser, isAdminUser } from "@/lib/auth";
import { loadActiveSeasonName, loadGamesView } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [games, activeSeasonName, user] = await Promise.all([
    loadGamesView(),
    loadActiveSeasonName(),
    getAuthenticatedUser(),
  ]);

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
              <p>Doubleheader schedule with game-level winner/loss updates for {activeSeasonName}.</p>
            </div>
          </div>
          <ScheduleTable games={games} canEditResults={canEditResults} />
        </section>
      </main>
    </>
  );
}

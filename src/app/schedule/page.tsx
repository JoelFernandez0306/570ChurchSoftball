import { SiteHeader } from "@/components/site-header";
import { ScheduleTable } from "@/components/schedule-table";
import { loadGamesView } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const games = await loadGamesView();

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>League Schedule</h2>
              <p>Doubleheader schedule with game-level winner/loss updates.</p>
            </div>
          </div>
          <ScheduleTable games={games} />
        </section>
      </main>
    </>
  );
}

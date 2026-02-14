import { SiteHeader } from "@/components/site-header";
import { StandingsTable } from "@/components/standings-table";
import { loadStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const standings = await loadStandings();

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>Standings</h2>
              <p>Ranked by winning percentage, then head-to-head, then admin tie override.</p>
            </div>
          </div>
          <StandingsTable rows={standings} />
        </section>
      </main>
    </>
  );
}

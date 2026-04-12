import { SiteHeader } from "@/components/site-header";
import { loadGcOrgStatsUrl } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const statsUrl = await loadGcOrgStatsUrl();

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
    <section className="page-surface stack">
      <div className="page-header">
        <div>
          <h2>Player Stats</h2>
          <p>Season batting statistics for all players across all teams.</p>
        </div>
      </div>

      {statsUrl ? (
        <article className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚾</div>
          <h3 style={{ margin: "0 0 0.5rem" }}>Stats are live on GameChanger</h3>
          <p style={{ margin: "0 0 1.5rem", color: "var(--ink-soft)", maxWidth: "420px", marginInline: "auto" }}>
            View batting averages, home runs, RBIs, and more for every player across all teams.
            Stats update automatically after each scored game.
          </p>
          <a
            href={statsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button"
            style={{ fontSize: "1rem", padding: "0.7rem 1.5rem" }}
          >
            View Player Stats on GameChanger
          </a>
          <p className="footer-note" style={{ marginTop: "1.25rem" }}>
            Opens in GameChanger — free to view, no account required.
          </p>
        </article>
      ) : (
        <article className="card">
          <h3>Stats coming soon</h3>
          <p>
            Player stats will appear here once the league is set up on GameChanger. Check back
            after the first games are scored.
          </p>
        </article>
      )}
    </section>
      </main>
    </>
  );
}

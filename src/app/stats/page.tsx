import { loadGcOrgStatsUrl } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const statsUrl = await loadGcOrgStatsUrl();

  return (
    <section className="page-surface stack">
      <div className="page-header">
        <div>
          <h2>Player Stats</h2>
          <p>Season batting statistics for all players across all teams.</p>
        </div>
        {statsUrl ? (
          <a
            href={statsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button"
          >
            Open in GameChanger
          </a>
        ) : null}
      </div>

      {statsUrl ? (
        <iframe
          src={statsUrl}
          title="Player Stats — powered by GameChanger"
          width="100%"
          style={{ minHeight: "80vh", border: "none", borderRadius: "var(--radius, 6px)" }}
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
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
  );
}

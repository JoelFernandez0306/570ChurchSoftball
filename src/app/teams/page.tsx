import { SiteHeader } from "@/components/site-header";
import { loadTeamsWithRoster } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await loadTeamsWithRoster();

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>Teams & Rosters</h2>
              <p>Roster names, role, and optional jersey numbers.</p>
            </div>
          </div>

          <div className="card-grid">
            {teams.length === 0 ? (
              <p className="empty-state">No teams added yet.</p>
            ) : (
              teams.map((team) => (
                <article className="card" key={team.id}>
                  <h3>{team.name}</h3>
                  <p className="footer-note">Aliases: {team.aliases.map((alias) => alias.alias).join(", ") || "None"}</p>

                  {team.players.length === 0 ? (
                    <p className="empty-state" style={{ marginTop: "0.65rem" }}>
                      No players added.
                    </p>
                  ) : (
                    <ul className="stack" style={{ margin: "0.65rem 0 0", paddingInlineStart: "1rem" }}>
                      {team.players.map((player) => (
                        <li key={player.id}>
                          {player.full_name}
                          {player.jersey_number ? ` (#${player.jersey_number})` : ""}
                          {player.role === "coach" ? " - Coach" : " - Player"}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}

import {
  createAliasAction,
  createTeamAction,
  deleteAliasAction,
  deleteTeamAction,
} from "@/app/admin/(protected)/actions";
import { loadTeamsWithRoster } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const teams = await loadTeamsWithRoster();

  return (
    <>
      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h2>Teams</h2>
            <p>Create teams and aliases for SMS recognition.</p>
          </div>
        </div>

        <form action={createTeamAction} className="form-grid">
          <label>
            Team name
            <input name="name" placeholder="Saint Johns" required />
          </label>
          <label>
            Short name
            <input name="short_name" placeholder="St Johns" />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="submit">Add Team</button>
          </div>
        </form>
      </section>

      <section className="page-surface">
        <div className="page-header">
          <div>
            <h3>Team Directory</h3>
            <p>Aliases improve SMS matching like “St John” to “Saint Johns”.</p>
          </div>
        </div>

        <div className="stack">
          {teams.length === 0 ? (
            <p className="empty-state">No teams yet.</p>
          ) : (
            teams.map((team) => (
              <article className="card stack" key={team.id}>
                <div className="page-header">
                  <div>
                    <h4 style={{ margin: 0 }}>{team.name}</h4>
                    <p>Short name: {team.short_name ?? "None"}</p>
                  </div>
                  <form action={deleteTeamAction}>
                    <input type="hidden" name="team_id" value={team.id} />
                    <button type="submit" className="danger-button">
                      Delete Team
                    </button>
                  </form>
                </div>

                <form action={createAliasAction} className="form-grid">
                  <input type="hidden" name="team_id" value={team.id} />
                  <label>
                    New alias
                    <input name="alias" placeholder="St John" required />
                  </label>
                  <div style={{ alignSelf: "end" }}>
                    <button type="submit">Add Alias</button>
                  </div>
                </form>

                <ul className="inline-list">
                  {team.aliases.length === 0 ? (
                    <li className="token">No aliases added</li>
                  ) : (
                    team.aliases.map((alias) => (
                      <li className="token" key={alias.id}>
                        {alias.alias}
                        <form action={deleteAliasAction}>
                          <input type="hidden" name="alias_id" value={alias.id} />
                          <button type="submit" className="ghost-button">
                            Remove
                          </button>
                        </form>
                      </li>
                    ))
                  )}
                </ul>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

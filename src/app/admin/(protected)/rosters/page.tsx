import { createPlayerAction, deletePlayerAction } from "@/app/admin/(protected)/actions";
import { loadTeamsWithRoster } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function AdminRostersPage() {
  const teams = await loadTeamsWithRoster();

  return (
    <>
      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h2>Rosters</h2>
            <p>Add players or coaches by team. Jersey number is optional.</p>
          </div>
        </div>

        <form action={createPlayerAction} className="form-grid">
          <label>
            Team
            <select name="team_id" required defaultValue="">
              <option value="" disabled>
                Select team
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Full name
            <input name="full_name" placeholder="John Smith" required />
          </label>

          <label>
            Jersey # (optional)
            <input name="jersey_number" placeholder="12" />
          </label>

          <label>
            Role
            <select name="role" defaultValue="player">
              <option value="player">Player</option>
              <option value="coach">Coach</option>
            </select>
          </label>

          <div style={{ alignSelf: "end" }}>
            <button type="submit">Add To Roster</button>
          </div>
        </form>
      </section>

      <section className="page-surface">
        <div className="page-header">
          <div>
            <h3>Current Rosters</h3>
            <p>All active roster members by team.</p>
          </div>
        </div>

        <div className="card-grid">
          {teams.map((team) => (
            <article className="card" key={team.id}>
              <h4>{team.name}</h4>
              {team.players.length === 0 ? (
                <p className="empty-state">No players added.</p>
              ) : (
                <ul className="stack" style={{ margin: 0, paddingInlineStart: "1rem" }}>
                  {team.players.map((player) => (
                    <li key={player.id}>
                      {player.full_name}
                      {player.jersey_number ? ` (#${player.jersey_number})` : ""}
                      {player.role === "coach" ? " - Coach" : " - Player"}
                      <form action={deletePlayerAction} style={{ display: "inline", marginLeft: "0.45rem" }}>
                        <input type="hidden" name="player_id" value={player.id} />
                        <button type="submit" className="ghost-button">
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

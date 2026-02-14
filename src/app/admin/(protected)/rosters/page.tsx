import { createPlayerAction, deletePlayerAction } from "@/app/admin/(protected)/actions";
import { RosterBuilderForm } from "@/components/roster-builder-form";
import { loadTeamsWithRoster } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function AdminRostersPage({
  searchParams,
}: {
  searchParams: Promise<{ team_id?: string }>;
}) {
  const params = await searchParams;
  const teams = await loadTeamsWithRoster();
  const initialTeamId = typeof params.team_id === "string" ? params.team_id : "";

  return (
    <>
      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h2>Rosters</h2>
            <p>Add players or coaches by team. Jersey number is optional.</p>
          </div>
        </div>

        <RosterBuilderForm
          teams={teams.map((team) => ({ id: team.id, name: team.name }))}
          initialTeamId={initialTeamId}
          createPlayerAction={createPlayerAction}
        />
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

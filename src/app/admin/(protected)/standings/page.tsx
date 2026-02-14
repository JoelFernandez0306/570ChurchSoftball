import { StandingsTable } from "@/components/standings-table";
import { TieOverrideForm } from "@/components/tie-override-form";
import { loadStandings } from "@/lib/standings";
import { loadActiveSeasonName, loadTeams, loadTieOverrides } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function AdminStandingsPage() {
  const [standings, teams, overrides, activeSeasonName] = await Promise.all([
    loadStandings(),
    loadTeams(),
    loadTieOverrides(),
    loadActiveSeasonName(),
  ]);

  const overrideMap = new Map(overrides.map((override) => [override.team_id, override.priority]));

  return (
    <>
      <section className="page-surface">
        <div className="page-header">
          <div>
            <h2>Standings Admin</h2>
            <p>Standings auto-calculate after every game result for {activeSeasonName}.</p>
          </div>
        </div>
        <StandingsTable rows={standings} />
      </section>

      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h3>Tie Override Priorities</h3>
            <p>
              Use only when teams remain tied after winning percentage and head-to-head.
            </p>
          </div>
        </div>

        <div className="stack">
          {teams.map((team) => (
            <article className="card" key={team.id}>
              <div className="page-header">
                <div>
                  <h4 style={{ margin: 0 }}>{team.name}</h4>
                  <p>Current override: {overrideMap.get(team.id) ?? "None"}</p>
                </div>
              </div>
              <TieOverrideForm
                teamId={team.id}
                currentPriority={overrideMap.get(team.id) ?? null}
              />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

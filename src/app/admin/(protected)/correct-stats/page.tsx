import { loadTeams } from "@/lib/league-data";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { CorrectStatsForm } from "@/components/correct-stats-form";
import type { GameStatRow } from "@/app/admin/(protected)/actions";

export const dynamic = "force-dynamic";

export default async function CorrectStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ teamName?: string }>;
}) {
  const { teamName } = await searchParams;

  const teams = await loadTeams();
  const teamNames = teams.map((t) => t.name).sort();

  let gameGroups: { gameId: string; rows: GameStatRow[] }[] = [];

  if (teamName) {
    const supabase = getServiceSupabaseClient();
    const { data } = await supabase
      .schema("league")
      .from("player_game_stats")
      .select("game_id,player_name,team_name,season_type,ab,r,h,singles,doubles,triples,hr,rbi,bb,so")
      .eq("team_name", teamName)
      .order("player_name");

    // Group by game_id
    const byGame = new Map<string, GameStatRow[]>();
    for (const row of data ?? []) {
      const rows = byGame.get(row.game_id) ?? [];
      rows.push(row as GameStatRow);
      byGame.set(row.game_id, rows);
    }
    gameGroups = [...byGame.entries()].map(([gameId, rows]) => ({ gameId, rows }));
  }

  return (
    <section className="page-surface stack">
      <div className="page-header">
        <div>
          <h2>Correct Game Stats</h2>
          <p>Select a team to view and edit their per-game stats. Changes re-aggregate season totals automatically.</p>
        </div>
      </div>
      <CorrectStatsForm
        teamNames={teamNames}
        selectedTeamName={teamName ?? ""}
        gameGroups={gameGroups}
      />
    </section>
  );
}

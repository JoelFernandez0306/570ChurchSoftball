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

  let gameGroups: { gameId: string; source: "scorebook" | "gamechanger"; gameDate: string | null; gameNumber: number | null; rows: GameStatRow[] }[] = [];

  if (teamName) {
    const supabase = getServiceSupabaseClient();
    const { data } = await supabase
      .schema("league")
      .from("player_game_stats")
      .select("game_id,game_date,player_name,team_name,season_type,ab,r,h,singles,doubles,triples,hr,rbi,bb,so")
      .eq("team_name", teamName)
      .order("player_name");

    // Group by game_id
    const byGame = new Map<string, { date: string | null; rows: GameStatRow[] }>();
    for (const row of data ?? []) {
      const entry = byGame.get(row.game_id) ?? { date: row.game_date ?? null, rows: [] };
      entry.rows.push(row as GameStatRow);
      byGame.set(row.game_id, entry);
    }
    const gameIds = [...byGame.keys()];

    // Look up which game_ids exist in league.games — those are scorebook uploads
    const { data: leagueGames } = gameIds.length > 0
      ? await supabase.schema("league").from("games").select("id,game_date,game_number").in("id", gameIds)
      : { data: [] };
    const leagueGameMap = new Map((leagueGames ?? []).map((g) => [g.id, g]));

    gameGroups = [...byGame.entries()].map(([gameId, { date, rows }]) => {
      const lg = leagueGameMap.get(gameId);
      return {
        gameId,
        source: lg ? "scorebook" : "gamechanger",
        gameDate: lg?.game_date ?? date,
        gameNumber: lg?.game_number ?? null,
        rows,
      };
    });
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

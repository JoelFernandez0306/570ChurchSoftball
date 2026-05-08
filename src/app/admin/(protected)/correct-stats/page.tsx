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

  let gameGroups: { gameId: string; source: "scorebook" | "gamechanger"; gameDate: string | null; gameNumber: number | null; gameTime: string | null; rows: GameStatRow[] }[] = [];

  if (teamName) {
    const supabase = getServiceSupabaseClient();
    const { data } = await supabase
      .schema("league")
      .from("player_game_stats")
      .select("game_id,game_date,player_name,team_name,season_type,gp,ab,r,h,singles,doubles,triples,hr,rbi,bb,so")
      .eq("team_name", teamName)
      .order("player_name");

    // Group by game_id
    const byGame = new Map<string, { date: string | null; rows: GameStatRow[] }>();
    for (const row of data ?? []) {
      const entry = byGame.get(row.game_id) ?? { date: row.game_date ?? null, rows: [] as GameStatRow[] };
      entry.rows.push(row as GameStatRow);
      byGame.set(row.game_id, entry);
    }
    const gameIds = [...byGame.keys()];

    // Scorebook: game_id matches a league.games UUID
    const { data: leagueGames } = gameIds.length > 0
      ? await supabase.schema("league").from("games").select("id,game_date,game_number,game_time").in("id", gameIds)
      : { data: [] };
    const leagueGameMap = new Map((leagueGames ?? []).map((g) => [g.id, g]));

    // GameChanger: match to league.games via team names
    const gcGameIds = gameIds.filter(id => !leagueGameMap.has(id));
    const gcInfoMap = new Map<string, { gameDate: string; gameNumber: number | null; gameTime: string | null }>();

    if (gcGameIds.length > 0) {
      // Get every team_name involved in these GC games (both teams, not just the selected one)
      const { data: gcTeamRows } = await supabase.schema("league").from("player_game_stats")
        .select("game_id,team_name").in("game_id", gcGameIds);
      const gcGameTeams = new Map<string, Set<string>>();
      for (const row of gcTeamRows ?? []) {
        const s = gcGameTeams.get(row.game_id) ?? new Set<string>();
        s.add(row.team_name);
        gcGameTeams.set(row.game_id, s);
      }

      // Build team name → UUID map (case-insensitive)
      const { data: allTeams } = await supabase.schema("league").from("teams").select("id,name");
      const nameToId = new Map((allTeams ?? []).map(t => [t.name.toUpperCase(), t.id]));

      for (const [gameId, teamNameSet] of gcGameTeams) {
        const teamIds = [...teamNameSet].map(n => nameToId.get(n.toUpperCase())).filter(Boolean) as string[];
        if (teamIds.length < 2) continue;
        const { data: matched } = await supabase.schema("league").from("games")
          .select("game_date,game_number,game_time")
          .in("home_team_id", teamIds)
          .in("away_team_id", teamIds)
          .order("game_number");
        if (matched && matched.length > 0) {
          gcInfoMap.set(gameId, {
            gameDate: matched[0].game_date,
            gameNumber: matched.length === 1 ? matched[0].game_number : null,
            gameTime: matched.length === 1 ? matched[0].game_time : null,
          });
        }
      }
    }

    gameGroups = [...byGame.entries()].map(([gameId, { date, rows }]) => {
      const lg = leagueGameMap.get(gameId);
      const gc = gcInfoMap.get(gameId);
      return {
        gameId,
        source: lg ? "scorebook" : "gamechanger",
        gameDate: lg?.game_date ?? gc?.gameDate ?? date,
        gameNumber: lg?.game_number ?? gc?.gameNumber ?? null,
        gameTime: lg?.game_time ?? gc?.gameTime ?? null,
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

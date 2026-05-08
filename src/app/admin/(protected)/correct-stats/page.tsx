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

  let gameGroups: { gameId: string; source: "scorebook" | "gamechanger"; gameDate: string | null; gameNumber: number | null; gameTime: string | null; ambiguousLabel: string | null; rows: GameStatRow[] }[] = [];

  if (teamName) {
    const supabase = getServiceSupabaseClient();
    const { data } = await supabase
      .schema("league")
      .from("player_game_stats")
      .select("game_id,game_date,game_time,player_name,team_name,season_type,gp,ab,r,h,singles,doubles,triples,hr,rbi,bb,so")
      .eq("team_name", teamName)
      .order("player_name");

    // Group by game_id
    const byGame = new Map<string, { date: string | null; time: string | null; rows: GameStatRow[] }>();
    for (const row of data ?? []) {
      const entry = byGame.get(row.game_id) ?? { date: row.game_date ?? null, time: row.game_time ?? null, rows: [] as GameStatRow[] };
      entry.rows.push(row as GameStatRow);
      byGame.set(row.game_id, entry);
    }
    const gameIds = [...byGame.keys()];

    // Scorebook: game_id matches a league.games UUID
    const { data: leagueGames } = gameIds.length > 0
      ? await supabase.schema("league").from("games").select("id,game_date,game_number,game_time").in("id", gameIds)
      : { data: [] };
    const leagueGameMap = new Map((leagueGames ?? []).map((g) => [g.id, g]));

    // GameChanger: match to league.games using the selected team's ID + game date
    const gcGameIds = gameIds.filter(id => !leagueGameMap.has(id));

    type GcInfo = { gameDate: string; gameNumber: number | null; gameTime: string | null; ambiguousLabel: string | null };
    const gcInfoMap = new Map<string, GcInfo>();

    if (gcGameIds.length > 0) {
      // teamName comes from league.teams so we can look it up directly
      const { data: selectedTeamRow } = await supabase.schema("league").from("teams")
        .select("id").eq("name", teamName).single();
      const selectedTeamId = selectedTeamRow?.id ?? null;

      // For GC rows that have no game_date in the column yet, fall back to any
      // all-team name match just to get the date
      const gcDates = new Map<string, string>();
      for (const [gameId, { date }] of byGame) {
        if (!leagueGameMap.has(gameId) && date) gcDates.set(gameId, date);
      }

      // For games still missing a date, do a broad team-name lookup
      const needDate = gcGameIds.filter(id => !gcDates.has(id));
      if (needDate.length > 0) {
        const { data: gcTeamRows } = await supabase.schema("league").from("player_game_stats")
          .select("game_id,team_name").in("game_id", needDate);
        const { data: allTeams } = await supabase.schema("league").from("teams").select("id,name");
        const nameToId = new Map((allTeams ?? []).map(t => [t.name.toUpperCase(), t.id]));
        const gcGameTeams = new Map<string, string[]>();
        for (const row of gcTeamRows ?? []) {
          const arr = gcGameTeams.get(row.game_id) ?? [];
          const id = nameToId.get(row.team_name.toUpperCase());
          if (id && !arr.includes(id)) arr.push(id);
          gcGameTeams.set(row.game_id, arr);
        }
        for (const [gameId, tIds] of gcGameTeams) {
          if (tIds.length < 1) continue;
          const { data: any } = await supabase.schema("league").from("games")
            .select("game_date").or(`home_team_id.in.(${tIds.join(",")}),away_team_id.in.(${tIds.join(",")})`)
            .order("game_date").limit(1);
          if (any?.[0]?.game_date) gcDates.set(gameId, any[0].game_date);
        }
      }

      // Now use team ID + date to find the specific game(s) — G1 and/or G2
      function fmtTime(t: string | null) {
        if (!t) return "?";
        return new Date("1970-01-01T" + t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      }

      for (const gameId of gcGameIds) {
        const date = gcDates.get(gameId);
        if (!date || !selectedTeamId) continue;
        const { data: matched } = await supabase.schema("league").from("games")
          .select("game_date,game_number,game_time")
          .eq("game_date", date)
          .or(`home_team_id.eq.${selectedTeamId},away_team_id.eq.${selectedTeamId}`)
          .order("game_number");
        if (!matched || matched.length === 0) continue;
        gcInfoMap.set(gameId, {
          gameDate: matched[0].game_date,
          gameNumber: matched.length === 1 ? matched[0].game_number : null,
          gameTime: matched.length === 1 ? matched[0].game_time : null,
          ambiguousLabel: matched.length > 1
            ? matched.map(g => `Game ${g.game_number} (${fmtTime(g.game_time)})`).join(" or ")
            : null,
        });
      }
    }

    gameGroups = [...byGame.entries()].map(([gameId, { date, time, rows }]) => {
      const lg = leagueGameMap.get(gameId);
      const gc = gcInfoMap.get(gameId);
      return {
        gameId,
        source: lg ? "scorebook" : "gamechanger",
        gameDate: lg?.game_date ?? gc?.gameDate ?? date,
        gameNumber: lg?.game_number ?? gc?.gameNumber ?? null,
        gameTime: lg?.game_time ?? time ?? gc?.gameTime ?? null,
        ambiguousLabel: gc?.ambiguousLabel ?? null,
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

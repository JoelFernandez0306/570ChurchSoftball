import { loadGamesView, loadActiveCompetitionPhase } from "@/lib/league-data";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { CorrectStatsForm } from "@/components/correct-stats-form";
import type { GameStatRow } from "@/app/admin/(protected)/actions";

export const dynamic = "force-dynamic";

export default async function CorrectStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ gameId?: string }>;
}) {
  const { gameId } = await searchParams;

  const [games, phase] = await Promise.all([
    loadGamesView(),
    loadActiveCompetitionPhase(),
  ]);

  const seasonType = phase === "playoffs" ? "playoff" : "regular";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastGames = games
    .filter((g) => new Date(g.game_date) <= today)
    .map((g) => ({
      id: g.id,
      label: `${g.game_date} G${g.game_number ?? 1} — ${g.away_team_name} @ ${g.home_team_name}`,
    }));

  let existingRows: GameStatRow[] = [];
  if (gameId) {
    const supabase = getServiceSupabaseClient();
    const { data } = await supabase
      .schema("league")
      .from("player_game_stats")
      .select("player_name,team_name,season_type,ab,r,h,singles,doubles,triples,hr,rbi,bb,so")
      .eq("game_id", gameId)
      .order("team_name")
      .order("player_name");
    existingRows = (data ?? []) as GameStatRow[];
  }

  return (
    <section className="page-surface stack">
      <div className="page-header">
        <div>
          <h2>Correct Game Stats</h2>
          <p>Select a game to edit per-player stats. Changes re-aggregate season totals automatically.</p>
        </div>
      </div>
      <CorrectStatsForm
        games={pastGames}
        selectedGameId={gameId ?? ""}
        existingRows={existingRows}
        seasonType={seasonType}
      />
    </section>
  );
}

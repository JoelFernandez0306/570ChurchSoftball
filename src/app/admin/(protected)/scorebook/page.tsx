import { loadGamesView, loadTeamsWithRoster, loadActiveCompetitionPhase } from "@/lib/league-data";
import { ScoreBookUploadForm } from "@/components/scorebook-upload-form";

export const dynamic = "force-dynamic";

export default async function ScoreBookPage() {
  const [games, teamsWithRoster, phase] = await Promise.all([
    loadGamesView(),
    loadTeamsWithRoster(),
    loadActiveCompetitionPhase(),
  ]);

  const seasonType = phase === "playoffs" ? "playoff" : "regular";

  // Only show games that could plausibly need stats (past games)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastGames = games.filter((g) => new Date(g.game_date) <= today);

  const gameOptions = pastGames.map((g) => ({
    id: g.id,
    label: `${g.game_date} — ${g.away_team_name} @ ${g.home_team_name}`,
    awayTeam: g.away_team_name,
    homeTeam: g.home_team_name,
  }));

  const allPlayers = teamsWithRoster.flatMap((team) =>
    team.players.map((p) => ({ name: p.full_name, team: team.name }))
  );

  return (
    <section className="page-surface stack">
      <div className="page-header">
        <div>
          <h2>Upload Paper Scorebook</h2>
          <p>
            Upload a photo of a handwritten scorebook. Claude will extract the batting
            stats, flag any crossed-out entries, and walk you through verifying player names.
          </p>
        </div>
      </div>

      <ScoreBookUploadForm
        games={gameOptions}
        allPlayers={allPlayers}
        seasonType={seasonType}
      />
    </section>
  );
}

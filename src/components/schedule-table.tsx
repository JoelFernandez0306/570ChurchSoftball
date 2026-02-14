import { formatCompetitionPhaseLabel } from "@/lib/league-data";
import type { GameView } from "@/lib/league-data";
import { formatLeagueDateForDisplay, formatLeagueTimeForDisplay } from "@/lib/utils";
import { GameResultInlineEditor } from "@/components/game-result-inline-editor";

function resultBadge(game: GameView) {
  const seasonLabel = <span className="result-pill season">{game.season_name}</span>;
  const phaseLabel = (
    <span className="result-pill season">{formatCompetitionPhaseLabel(game.game_phase)}</span>
  );

  if (game.is_tie) {
    return (
      <div className="result-stack">
        <span className="badge badge-tie">Tie Game</span>
        {seasonLabel}
        {phaseLabel}
      </div>
    );
  }

  if (!game.winner_team_name || !game.loser_team_name) {
    return (
      <div className="result-stack">
        <span className="badge badge-pending">Pending</span>
        {seasonLabel}
        {phaseLabel}
      </div>
    );
  }

  return (
    <div className="result-stack">
      <span className="result-pill win">{game.winner_team_name} W</span>
      <span className="result-pill loss">{game.loser_team_name} L</span>
      {seasonLabel}
      {phaseLabel}
    </div>
  );
}

export function ScheduleTable({
  games,
  canEditResults = false,
}: {
  games: GameView[];
  canEditResults?: boolean;
}) {
  if (games.length === 0) {
    return <p className="empty-state">No games scheduled yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Location</th>
            <th>Game</th>
            <th>Matchup</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id}>
              <td>{formatLeagueDateForDisplay(game.game_date)}</td>
              <td>{formatLeagueTimeForDisplay(game.game_time)}</td>
              <td>{game.location ?? "TBD"}</td>
              <td>G{game.game_number}</td>
              <td>
                {game.home_team_name} vs {game.away_team_name}
              </td>
              <td>
                <div className="result-cell-stack">
                  {resultBadge(game)}
                  {canEditResults ? (
                    <GameResultInlineEditor
                      gameId={game.id}
                      homeTeamId={game.home_team_id}
                      awayTeamId={game.away_team_id}
                      homeTeamName={game.home_team_name}
                      awayTeamName={game.away_team_name}
                      winnerTeamId={game.winner_team_id}
                      loserTeamId={game.loser_team_id}
                      isTie={game.is_tie}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { ReactNode } from "react";
import { formatCompetitionPhaseLabel } from "@/lib/league-data";
import type { GameView } from "@/lib/league-data";
import { formatLeagueDateForDisplay, formatLeagueTimeForDisplay } from "@/lib/utils";
import { GameResultInlineEditor } from "@/components/game-result-inline-editor";

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
          {games.map((game) => {
            const seasonBadge = <span className="result-pill season">{game.season_name}</span>;
            const phaseBadge = <span className="result-pill season">{formatCompetitionPhaseLabel(game.game_phase)}</span>;

            // Row 1: result outcome
            let outcomeRow: ReactNode;
            if (game.cancelled) {
              outcomeRow = <span className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>⛈ Weather Cancellation</span>;
            } else if (game.is_tie) {
              outcomeRow = <span className="badge badge-tie">Tie Game</span>;
            } else if (game.winner_team_name && game.loser_team_name) {
              outcomeRow = (
                <>
                  <span className="result-pill win">{game.winner_team_name} W</span>
                  <span className="result-pill loss">{game.loser_team_name} L</span>
                </>
              );
            } else {
              outcomeRow = <span className="badge badge-pending">Pending</span>;
            }

            return (
              <tr key={game.id}>
                <td>{formatLeagueDateForDisplay(game.game_date)}</td>
                <td>{formatLeagueTimeForDisplay(game.game_time)}</td>
                <td>{game.location ?? "TBD"}</td>
                <td>G{game.game_number}</td>
                <td>{game.home_team_name} vs {game.away_team_name}</td>
                <td>
                  <div className="result-cell-stack">
                    {/* Row 1: winner / loser / outcome */}
                    <div className="result-stack">{outcomeRow}</div>
                    {/* Row 2: season · phase · edit */}
                    <div className="result-stack">
                      {seasonBadge}
                      {phaseBadge}
                      {canEditResults && (
                        <GameResultInlineEditor
                          gameId={game.id}
                          homeTeamId={game.home_team_id}
                          awayTeamId={game.away_team_id}
                          homeTeamName={game.home_team_name}
                          awayTeamName={game.away_team_name}
                          winnerTeamId={game.winner_team_id}
                          loserTeamId={game.loser_team_id}
                          isTie={game.is_tie}
                          isCancelled={game.cancelled ?? false}
                        />
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

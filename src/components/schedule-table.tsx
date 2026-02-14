import type { GameView } from "@/lib/league-data";
import { formatLeagueDateForDisplay, formatLeagueTimeForDisplay } from "@/lib/utils";

function resultBadge(game: GameView) {
  if (game.is_tie) {
    return <span className="badge badge-tie">Tie Game</span>;
  }

  if (!game.winner_team_name || !game.loser_team_name) {
    return <span className="badge badge-pending">Pending</span>;
  }

  return (
    <div className="result-stack">
      <span className="result-pill win">{game.winner_team_name} W</span>
      <span className="result-pill loss">{game.loser_team_name} L</span>
    </div>
  );
}

export function ScheduleTable({ games }: { games: GameView[] }) {
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
              <td>{resultBadge(game)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

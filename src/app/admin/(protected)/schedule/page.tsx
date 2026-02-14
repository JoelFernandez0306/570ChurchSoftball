import {
  createGameAction,
  deleteGameAction,
} from "@/app/admin/(protected)/actions";
import { GameResultEditor } from "@/components/game-result-editor";
import { SeasonManagerForm } from "@/components/season-manager-form";
import { loadActiveSeasonName, loadGamesView, loadTeams } from "@/lib/league-data";
import { formatLeagueDateForDisplay, formatLeagueTimeForDisplay } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const [activeSeasonName, games, teams] = await Promise.all([
    loadActiveSeasonName(),
    loadGamesView(),
    loadTeams(),
  ]);

  return (
    <>
      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h2>Schedule Builder</h2>
            <p>Create and manage game slots (doubleheaders supported).</p>
          </div>
        </div>

        <article className="card stack">
          <h3 style={{ margin: 0 }}>Active Season</h3>
          <p className="footer-note" style={{ marginTop: 0 }}>
            New games are added to this season, and standings are calculated from this season only.
          </p>
          <SeasonManagerForm
            activeSeasonName={activeSeasonName}
            currentSeasonGameCount={games.length}
          />
        </article>

        <form action={createGameAction} className="form-grid">
          <label>
            Date
            <input name="game_date" type="date" required />
          </label>

          <label>
            Time
            <input name="game_time" type="time" />
          </label>

          <label>
            Location
            <input name="location" placeholder="570 Church Field" />
          </label>

          <label>
            Game slot
            <select name="game_number" defaultValue="1" required>
              <option value="1">Game 1</option>
              <option value="2">Game 2</option>
            </select>
          </label>

          <label>
            Home team
            <select name="home_team_id" required defaultValue="">
              <option value="" disabled>
                Select
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Away team
            <select name="away_team_id" required defaultValue="">
              <option value="" disabled>
                Select
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ alignSelf: "end" }}>
            <button type="submit">Add Game Slot</button>
          </div>
        </form>
      </section>

      <section className="page-surface">
        <div className="page-header">
          <div>
            <h3>Game Admin</h3>
            <p>Record or correct outcomes for any game date.</p>
          </div>
        </div>

        {games.length === 0 ? (
          <p className="empty-state">No games scheduled.</p>
        ) : (
          <div className="stack">
            {games.map((game) => (
              <article className="card stack" key={game.id}>
                <div className="page-header">
                  <div>
                    <h4 style={{ margin: 0 }}>
                      {formatLeagueDateForDisplay(game.game_date)} G{game.game_number} - {game.home_team_name} vs {game.away_team_name}
                    </h4>
                    <p>
                      {formatLeagueTimeForDisplay(game.game_time)} at {game.location ?? "TBD"}
                    </p>
                  </div>
                  <form action={deleteGameAction}>
                    <input type="hidden" name="game_id" value={game.id} />
                    <button type="submit" className="danger-button">
                      Delete
                    </button>
                  </form>
                </div>

                <GameResultEditor
                  gameId={game.id}
                  homeTeamId={game.home_team_id}
                  awayTeamId={game.away_team_id}
                  homeTeamName={game.home_team_name}
                  awayTeamName={game.away_team_name}
                  winnerTeamId={game.winner_team_id}
                  loserTeamId={game.loser_team_id}
                  isTie={game.is_tie}
                />

                {game.is_tie ? (
                  <span className="badge badge-tie">Tie Game</span>
                ) : game.winner_team_name && game.loser_team_name ? (
                  <div className="inline-list">
                    <span className="result-pill win">{game.winner_team_name} W</span>
                    <span className="result-pill loss">{game.loser_team_name} L</span>
                  </div>
                ) : (
                  <p className="footer-note">No result recorded yet.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

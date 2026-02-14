import {
  createGameAction,
  deleteGameAction,
} from "@/app/admin/(protected)/actions";
import { GameResultEditor } from "@/components/game-result-editor";
import { ScheduleBuilderForm } from "@/components/schedule-builder-form";
import { SeasonManagerForm } from "@/components/season-manager-form";
import {
  countGamesForSeason,
  formatCompetitionPhaseLabel,
  loadActiveCompetitionPhase,
  loadActiveSeasonName,
  loadGamesView,
  loadTeams,
} from "@/lib/league-data";
import { formatLeagueDateForDisplay, formatLeagueTimeForDisplay } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ game_phase?: string }>;
}) {
  const params = await searchParams;
  const initialGamePhase =
    params.game_phase === "playoffs" ? "playoffs" : params.game_phase === "regular_season" ? "regular_season" : undefined;

  const [activeSeasonName, activeCompetitionPhase, teams] = await Promise.all([
    loadActiveSeasonName(),
    loadActiveCompetitionPhase(),
    loadTeams(),
  ]);
  const [regularSeasonGames, playoffGames] = await Promise.all([
    loadGamesView(activeSeasonName, "regular_season"),
    loadGamesView(activeSeasonName, "playoffs"),
  ]);
  const games = [...regularSeasonGames, ...playoffGames].sort((a, b) => {
    const dateCompare = a.game_date.localeCompare(b.game_date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const timeA = a.game_time ?? "99:99:99";
    const timeB = b.game_time ?? "99:99:99";
    const timeCompare = timeA.localeCompare(timeB);
    if (timeCompare !== 0) {
      return timeCompare;
    }

    return a.game_number - b.game_number;
  });
  const currentSeasonGameCount = await countGamesForSeason(activeSeasonName);

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
            New games are added to this season/phase scope, and standings are calculated from this
            scope only.
          </p>
          <SeasonManagerForm
            activeSeasonName={activeSeasonName}
            currentSeasonGameCount={currentSeasonGameCount}
          />
        </article>

        <p className="footer-note" style={{ marginTop: 0 }}>
          Current scope: {activeSeasonName} ({formatCompetitionPhaseLabel(activeCompetitionPhase)})
        </p>

        <ScheduleBuilderForm
          teams={teams.map((team) => ({ id: team.id, name: team.name }))}
          initialGamePhase={initialGamePhase}
          defaultGamePhase={activeCompetitionPhase}
          createGameAction={createGameAction}
        />
        <p className="footer-note" style={{ marginTop: 0 }}>
          The game phase selected above applies immediately to the new game slot. You do not need
          to save active season settings first.
        </p>
        <p className="footer-note" style={{ marginTop: 0 }}>
          Game list below shows both phases for {activeSeasonName}: Regular Season and Playoffs.
        </p>
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
                      {formatLeagueTimeForDisplay(game.game_time)} at {game.location ?? "TBD"} (
                      {formatCompetitionPhaseLabel(game.game_phase)})
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

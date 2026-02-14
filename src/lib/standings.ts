import { getServiceSupabaseClient } from "@/lib/supabase/service";
import {
  DEFAULT_COMPETITION_PHASE,
  loadActiveLeagueScope,
} from "@/lib/league-data";
import type { CompetitionPhase, StandingsRow, Team, TieOverride } from "@/lib/types";

interface GameResultRow {
  home_team_id: string;
  away_team_id: string;
  is_tie: boolean;
  winner_team_id: string | null;
  loser_team_id: string | null;
}

interface InternalStandingsRow extends StandingsRow {
  overridePriority: number | null;
}

function pct(wins: number, losses: number, ties = 0): number {
  const games = wins + losses + ties;
  return games === 0 ? 0 : (wins + ties * 0.5) / games;
}

function isApproxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.000001;
}

export function computeStandings(
  teams: Pick<Team, "id" | "name">[],
  games: GameResultRow[],
  tieOverrides: Pick<TieOverride, "team_id" | "priority" | "active">[],
): StandingsRow[] {
  const stats = new Map(
    teams.map((team) => [
      team.id,
      {
        teamName: team.name,
        wins: 0,
        losses: 0,
        ties: 0,
      },
    ]),
  );

  for (const game of games) {
    if (game.is_tie) {
      const home = stats.get(game.home_team_id);
      const away = stats.get(game.away_team_id);

      if (home) {
        home.ties += 1;
      }

      if (away) {
        away.ties += 1;
      }
      continue;
    }

    if (!game.winner_team_id || !game.loser_team_id) {
      continue;
    }

    const winner = stats.get(game.winner_team_id);
    const loser = stats.get(game.loser_team_id);

    if (winner) {
      winner.wins += 1;
    }

    if (loser) {
      loser.losses += 1;
    }
  }

  const headToHead = new Map<string, { wins: number; losses: number; ties: number }>();

  for (const game of games) {
    if (game.is_tie) {
      const key = `${game.home_team_id}|${game.away_team_id}`;
      const reverseKey = `${game.away_team_id}|${game.home_team_id}`;
      const homePair = headToHead.get(key) ?? { wins: 0, losses: 0, ties: 0 };
      homePair.ties += 1;
      headToHead.set(key, homePair);

      const awayPair = headToHead.get(reverseKey) ?? { wins: 0, losses: 0, ties: 0 };
      awayPair.ties += 1;
      headToHead.set(reverseKey, awayPair);
      continue;
    }

    if (!game.winner_team_id || !game.loser_team_id) {
      continue;
    }

    const key = `${game.winner_team_id}|${game.loser_team_id}`;
    const reverseKey = `${game.loser_team_id}|${game.winner_team_id}`;
    const winnerPair = headToHead.get(key) ?? { wins: 0, losses: 0, ties: 0 };
    winnerPair.wins += 1;
    headToHead.set(key, winnerPair);

    const loserPair = headToHead.get(reverseKey) ?? { wins: 0, losses: 0, ties: 0 };
    loserPair.losses += 1;
    headToHead.set(reverseKey, loserPair);
  }

  const overrideMap = new Map(
    tieOverrides.filter((override) => override.active).map((override) => [override.team_id, override.priority]),
  );

  const baseRows: InternalStandingsRow[] = Array.from(stats.entries()).map(([teamId, stat]) => ({
    teamId,
    teamName: stat.teamName,
    wins: stat.wins,
    losses: stat.losses,
    ties: stat.ties,
    winPct: pct(stat.wins, stat.losses, stat.ties),
    headToHeadPct: 0,
    rank: 0,
    overrideApplied: false,
    overridePriority: overrideMap.get(teamId) ?? null,
  }));

  baseRows.sort((a, b) => {
    if (!isApproxEqual(b.winPct, a.winPct)) {
      return b.winPct - a.winPct;
    }

    return a.teamName.localeCompare(b.teamName);
  });

  const finalRows: InternalStandingsRow[] = [];

  let index = 0;
  while (index < baseRows.length) {
    const group: InternalStandingsRow[] = [baseRows[index]];
    let cursor = index + 1;

    while (cursor < baseRows.length && isApproxEqual(baseRows[cursor].winPct, baseRows[index].winPct)) {
      group.push(baseRows[cursor]);
      cursor += 1;
    }

    if (group.length === 1) {
      finalRows.push(group[0]);
      index = cursor;
      continue;
    }

    for (const row of group) {
      let wins = 0;
      let losses = 0;
      let ties = 0;

      for (const other of group) {
        if (other.teamId === row.teamId) {
          continue;
        }

        const record = headToHead.get(`${row.teamId}|${other.teamId}`);
        if (record) {
          wins += record.wins;
          losses += record.losses;
          ties += record.ties;
        }
      }

      row.headToHeadPct = pct(wins, losses, ties);
      row.h2hTieGroupId = `h2h-${row.winPct.toFixed(6)}`;
    }

    group.sort((a, b) => {
      if (!isApproxEqual(b.headToHeadPct, a.headToHeadPct)) {
        return b.headToHeadPct - a.headToHeadPct;
      }

      return a.teamName.localeCompare(b.teamName);
    });

    let subIndex = 0;
    while (subIndex < group.length) {
      const subgroup = [group[subIndex]];
      let subCursor = subIndex + 1;

      while (
        subCursor < group.length &&
        isApproxEqual(group[subCursor].headToHeadPct, group[subIndex].headToHeadPct)
      ) {
        subgroup.push(group[subCursor]);
        subCursor += 1;
      }

      if (subgroup.length > 1) {
        subgroup.sort((a, b) => {
          const aPriority = a.overridePriority ?? Number.POSITIVE_INFINITY;
          const bPriority = b.overridePriority ?? Number.POSITIVE_INFINITY;

          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }

          return a.teamName.localeCompare(b.teamName);
        });

        const hasMeaningfulOverride = subgroup.some((row) => row.overridePriority !== null);
        if (hasMeaningfulOverride) {
          subgroup.forEach((row) => {
            if (row.overridePriority !== null) {
              row.overrideApplied = true;
            }
          });
        }
      }

      finalRows.push(...subgroup);
      subIndex = subCursor;
    }

    index = cursor;
  }

  let currentRank = 1;
  for (let i = 0; i < finalRows.length; i += 1) {
    if (i === 0) {
      finalRows[i].rank = 1;
      continue;
    }

    const previous = finalRows[i - 1];
    const current = finalRows[i];
    const prevPriority = previous.overridePriority ?? Number.POSITIVE_INFINITY;
    const currentPriority = current.overridePriority ?? Number.POSITIVE_INFINITY;

    const isTie =
      isApproxEqual(previous.winPct, current.winPct) &&
      isApproxEqual(previous.headToHeadPct, current.headToHeadPct) &&
      prevPriority === currentPriority;

    if (!isTie) {
      currentRank = i + 1;
    }

    current.rank = currentRank;
  }

  return finalRows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    wins: row.wins,
    losses: row.losses,
    ties: row.ties,
    winPct: row.winPct,
    rank: row.rank,
    headToHeadPct: row.headToHeadPct,
    h2hTieGroupId: row.h2hTieGroupId,
    overrideApplied: row.overrideApplied,
  }));
}

export async function loadStandings(
  seasonName?: string,
  competitionPhase?: CompetitionPhase,
): Promise<StandingsRow[]> {
  const supabase = getServiceSupabaseClient();
  const scope =
    seasonName && competitionPhase
      ? { seasonName, competitionPhase }
      : seasonName
        ? { seasonName, competitionPhase: DEFAULT_COMPETITION_PHASE as CompetitionPhase }
        : await loadActiveLeagueScope();

  const gamesResult = await supabase
    .schema("league")
    .from("games")
    .select("home_team_id,away_team_id,is_tie,winner_team_id,loser_team_id")
    .eq("season_name", scope.seasonName)
    .eq("game_phase", scope.competitionPhase);

  const fallbackGamesResult =
    gamesResult.error && gamesResult.error.message.includes("game_phase")
      ? await supabase
          .schema("league")
          .from("games")
          .select("home_team_id,away_team_id,is_tie,winner_team_id,loser_team_id")
          .eq("season_name", scope.seasonName)
      : null;

  const [teamsResult, overridesResult] = await Promise.all([
    supabase.schema("league").from("teams").select("id,name").order("name"),
    supabase
      .schema("league")
      .from("tie_overrides")
      .select("team_id,priority,active")
      .eq("active", true),
  ]);

  if (teamsResult.error) {
    throw new Error(`Failed to load teams: ${teamsResult.error.message}`);
  }

  const selectedGamesResult = fallbackGamesResult ?? gamesResult;

  if (selectedGamesResult.error) {
    throw new Error(`Failed to load games: ${selectedGamesResult.error.message}`);
  }

  if (overridesResult.error) {
    throw new Error(`Failed to load tie overrides: ${overridesResult.error.message}`);
  }

  return computeStandings(
    teamsResult.data ?? [],
    selectedGamesResult.data ?? [],
    overridesResult.data ?? [],
  );
}

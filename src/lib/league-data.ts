import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { formatInTimeZone } from "date-fns-tz";
import type { CompetitionPhase, Game, LeagueSettings, Player, Team, TeamAlias } from "@/lib/types";

export interface GameView extends Game {
  home_team_name: string;
  away_team_name: string;
  winner_team_name: string | null;
  loser_team_name: string | null;
}

export interface TeamWithRoster extends Team {
  players: Player[];
  aliases: TeamAlias[];
}

function fallbackSeasonName(timezone = "America/New_York"): string {
  const currentYear = formatInTimeZone(new Date(), timezone, "yyyy");
  return `Season ${currentYear}`;
}

export const DEFAULT_COMPETITION_PHASE: CompetitionPhase = "regular_season";

function normalizeCompetitionPhase(value: string | null | undefined): CompetitionPhase {
  return value === "playoffs" ? "playoffs" : DEFAULT_COMPETITION_PHASE;
}

export function formatCompetitionPhaseLabel(phase: CompetitionPhase): string {
  return phase === "playoffs" ? "Playoffs" : "Regular Season";
}

export async function loadLeagueSettings(): Promise<LeagueSettings> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .schema("league")
    .from("settings")
    .select(
      "id,league_name,season_year,timezone,active_season_name,active_competition_phase,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.message.includes("active_competition_phase")) {
    const legacyResult = await supabase
      .schema("league")
      .from("settings")
      .select("id,league_name,season_year,timezone,active_season_name,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacyResult.error) {
      throw new Error(`Failed to load settings: ${legacyResult.error.message}`);
    }

    if (!legacyResult.data) {
      throw new Error("League settings not found.");
    }

    return {
      ...(legacyResult.data as Omit<LeagueSettings, "active_competition_phase">),
      active_competition_phase: DEFAULT_COMPETITION_PHASE,
    };
  }

  if (error) {
    throw new Error(`Failed to load settings: ${error.message}`);
  }

  if (!data) {
    throw new Error("League settings not found.");
  }

  return {
    ...(data as Omit<LeagueSettings, "active_competition_phase">),
    active_competition_phase: normalizeCompetitionPhase(
      (data as { active_competition_phase?: string | null }).active_competition_phase,
    ),
  };
}

export async function loadActiveSeasonName(): Promise<string> {
  const settings = await loadLeagueSettings();
  const seasonName = settings.active_season_name?.trim();
  return seasonName || fallbackSeasonName(settings.timezone);
}

export async function loadActiveCompetitionPhase(): Promise<CompetitionPhase> {
  const settings = await loadLeagueSettings();
  return normalizeCompetitionPhase(settings.active_competition_phase);
}

export async function loadActiveLeagueScope(): Promise<{
  seasonName: string;
  competitionPhase: CompetitionPhase;
}> {
  const settings = await loadLeagueSettings();
  return {
    seasonName: settings.active_season_name?.trim() || fallbackSeasonName(settings.timezone),
    competitionPhase: normalizeCompetitionPhase(settings.active_competition_phase),
  };
}

export async function loadTeams(): Promise<Team[]> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .schema("league")
    .from("teams")
    .select("id,name,short_name,created_at")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load teams: ${error.message}`);
  }

  return data ?? [];
}

export async function loadTeamAliases(): Promise<TeamAlias[]> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .schema("league")
    .from("team_aliases")
    .select("id,team_id,alias,normalized_alias")
    .order("alias", { ascending: true });

  if (error) {
    throw new Error(`Failed to load aliases: ${error.message}`);
  }

  return data ?? [];
}

export async function loadPlayers(): Promise<Player[]> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .schema("league")
    .from("players")
    .select("id,team_id,full_name,jersey_number,role")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load players: ${error.message}`);
  }

  return data ?? [];
}

export async function loadTeamsWithRoster(): Promise<TeamWithRoster[]> {
  const [teams, players, aliases] = await Promise.all([
    loadTeams(),
    loadPlayers(),
    loadTeamAliases(),
  ]);

  return teams.map((team) => ({
    ...team,
    players: players.filter((player) => player.team_id === team.id),
    aliases: aliases.filter((alias) => alias.team_id === team.id),
  }));
}

export async function loadGames(
  seasonName?: string,
  competitionPhase?: CompetitionPhase,
): Promise<Game[]> {
  const supabase = getServiceSupabaseClient();
  const scope =
    seasonName && competitionPhase
      ? { seasonName, competitionPhase }
      : seasonName
        ? { seasonName, competitionPhase: DEFAULT_COMPETITION_PHASE }
        : await loadActiveLeagueScope();

  const primaryResult = await supabase
    .schema("league")
    .from("games")
    .select(
      "id,season_name,game_phase,game_date,game_time,location,game_number,home_team_id,away_team_id,is_tie,winner_team_id,loser_team_id,result_source,created_at,updated_at",
    )
    .eq("season_name", scope.seasonName)
    .eq("game_phase", scope.competitionPhase)
    .order("game_date", { ascending: true })
    .order("game_number", { ascending: true })
    .order("game_time", { ascending: true });

  if (primaryResult.error && primaryResult.error.message.includes("game_phase")) {
    const legacyResult = await supabase
      .schema("league")
      .from("games")
      .select(
        "id,season_name,game_date,game_time,location,game_number,home_team_id,away_team_id,is_tie,winner_team_id,loser_team_id,result_source,created_at,updated_at",
      )
      .eq("season_name", scope.seasonName)
      .order("game_date", { ascending: true })
      .order("game_number", { ascending: true })
      .order("game_time", { ascending: true });

    if (legacyResult.error) {
      throw new Error(`Failed to load games: ${legacyResult.error.message}`);
    }

    return (legacyResult.data ?? []).map((game) => ({
      ...(game as Omit<Game, "game_phase">),
      game_phase: DEFAULT_COMPETITION_PHASE,
    }));
  }

  if (primaryResult.error) {
    throw new Error(`Failed to load games: ${primaryResult.error.message}`);
  }

  return (primaryResult.data ?? []).map((game) => ({
    ...(game as Omit<Game, "game_phase">),
    game_phase: normalizeCompetitionPhase(
      (game as { game_phase?: string | null }).game_phase,
    ),
  }));
}

export async function loadGamesView(
  seasonName?: string,
  competitionPhase?: CompetitionPhase,
): Promise<GameView[]> {
  const [games, teams] = await Promise.all([loadGames(seasonName, competitionPhase), loadTeams()]);
  const teamMap = new Map(teams.map((team) => [team.id, team.name]));

  return games.map((game) => ({
    ...game,
    home_team_name: teamMap.get(game.home_team_id) ?? "Unknown Team",
    away_team_name: teamMap.get(game.away_team_id) ?? "Unknown Team",
    winner_team_name: game.winner_team_id ? (teamMap.get(game.winner_team_id) ?? null) : null,
    loser_team_name: game.loser_team_id ? (teamMap.get(game.loser_team_id) ?? null) : null,
  }));
}

export async function countGamesForSeason(seasonName: string): Promise<number> {
  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase
    .schema("league")
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("season_name", seasonName);

  if (error) {
    throw new Error(`Failed to count games for season: ${error.message}`);
  }

  return count ?? 0;
}

export async function countGamesForScope(
  seasonName: string,
  competitionPhase: CompetitionPhase,
): Promise<number> {
  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase
    .schema("league")
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("season_name", seasonName)
    .eq("game_phase", competitionPhase);

  if (error) {
    throw new Error(`Failed to count games for scope: ${error.message}`);
  }

  return count ?? 0;
}

export async function loadRulesContent(): Promise<string> {
  const record = await loadActiveRuleRecord();
  return record?.content ?? "Rules coming soon.";
}

export async function loadActiveRuleRecord(): Promise<
  { id: string; title: string; content: string } | null
> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .schema("league")
    .from("rules")
    .select("id,title,content")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load rules: ${error.message}`);
  }

  return data ?? null;
}

export async function loadAllowedSmsNumbers(): Promise<{ id: string; phone_number: string; label: string | null; active: boolean }[]> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .schema("league")
    .from("allowed_sms_numbers")
    .select("id,phone_number,label,active")
    .order("phone_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load SMS numbers: ${error.message}`);
  }

  return data ?? [];
}

export async function loadTieOverrides(): Promise<
  { id: string; team_id: string; priority: number; active: boolean; reason: string | null }[]
> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .schema("league")
    .from("tie_overrides")
    .select("id,team_id,priority,active,reason")
    .eq("active", true)
    .order("priority", { ascending: true });

  if (error) {
    throw new Error(`Failed to load tie overrides: ${error.message}`);
  }

  return data ?? [];
}

export async function loadAdmins(): Promise<
  { id: string; user_id: string; full_name: string | null; active: boolean; created_at: string }[]
> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .schema("league")
    .from("admins")
    .select("id,user_id,full_name,active,created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load admins: ${error.message}`);
  }

  return data ?? [];
}

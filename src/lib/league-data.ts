import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { formatInTimeZone } from "date-fns-tz";
import type {
  CompetitionPhase,
  Game,
  LeagueSettings,
  Player,
  SeasonHistoryOption,
  Team,
  TeamAlias,
} from "@/lib/types";

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

function seasonNameIncludesYear(seasonName: string): boolean {
  return /\b(19|20)\d{2}\b/.test(seasonName);
}

function formatSeasonLabelWithYear(seasonName: string, seasonYear: number): string {
  return seasonNameIncludesYear(seasonName)
    ? seasonName
    : `${seasonName} (${seasonYear})`;
}

function extractYearFromDateLike(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(19|20)\d{2}/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
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
      "id,league_name,season_year,timezone,active_season_name,active_competition_phase,gamechanger_org_stats_url,gamechanger_org_scoreboard_url,created_at,updated_at",
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
      ...(legacyResult.data as Omit<LeagueSettings, "active_competition_phase" | "gamechanger_org_stats_url" | "gamechanger_org_scoreboard_url">),
      active_competition_phase: DEFAULT_COMPETITION_PHASE,
      gamechanger_org_stats_url: null,
      gamechanger_org_scoreboard_url: null,
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

export async function loadLiveScoreboard(): Promise<{
  embedUrl: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
}> {
  const supabase = getServiceSupabaseClient();
  try {
    const { data, error } = await supabase
      .schema("league")
      .from("settings")
      .select("gamechanger_embed_url,gamechanger_home_team,gamechanger_away_team")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { embedUrl: null, homeTeam: null, awayTeam: null };

    return {
      embedUrl: (data as { gamechanger_embed_url?: string | null })?.gamechanger_embed_url ?? null,
      homeTeam: (data as { gamechanger_home_team?: string | null })?.gamechanger_home_team ?? null,
      awayTeam: (data as { gamechanger_away_team?: string | null })?.gamechanger_away_team ?? null,
    };
  } catch {
    return { embedUrl: null, homeTeam: null, awayTeam: null };
  }
}

export async function loadGcOrgStatsUrl(): Promise<string | null> {
  const supabase = getServiceSupabaseClient();
  try {
    const { data, error } = await supabase
      .schema("league")
      .from("settings")
      .select("gamechanger_org_stats_url")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return (data as { gamechanger_org_stats_url?: string | null })?.gamechanger_org_stats_url ?? null;
  } catch {
    return null;
  }
}

export async function loadGcOrgScoreboardUrl(): Promise<string | null> {
  const supabase = getServiceSupabaseClient();
  try {
    const { data, error } = await supabase
      .schema("league")
      .from("settings")
      .select("gamechanger_org_scoreboard_url")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return (data as { gamechanger_org_scoreboard_url?: string | null })?.gamechanger_org_scoreboard_url ?? null;
  } catch {
    return null;
  }
}

export async function loadGcOrgScoreboardWidgetId(): Promise<string | null> {
  // Widget ID is stored in the gamechanger_org_scoreboard_url column
  return loadGcOrgScoreboardUrl();
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

export function resolveSeasonSelection(
  requestedSeasonName: string | undefined,
  availableSeasons: SeasonHistoryOption[],
  activeSeasonName: string,
): string {
  const requested = requestedSeasonName?.trim();
  if (requested && availableSeasons.some((season) => season.seasonName === requested)) {
    return requested;
  }

  if (availableSeasons.some((season) => season.seasonName === activeSeasonName)) {
    return activeSeasonName;
  }

  return availableSeasons[0]?.seasonName ?? activeSeasonName;
}

export async function loadSeasonHistoryOptions(limit = 6): Promise<SeasonHistoryOption[]> {
  const supabase = getServiceSupabaseClient();
  const settings = await loadLeagueSettings();
  const activeSeasonName = settings.active_season_name?.trim() || fallbackSeasonName(settings.timezone);
  const activeSeasonYear =
    settings.season_year ||
    extractYearFromDateLike(settings.updated_at) ||
    Number(formatInTimeZone(new Date(), settings.timezone, "yyyy"));

  const { data, error } = await supabase
    .schema("league")
    .from("games")
    .select("season_name,game_date,created_at")
    .order("created_at", { ascending: false })
    .order("game_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load season history: ${error.message}`);
  }

  const bySeason = new Map<
    string,
    { seasonName: string; seasonYear: number; latestCreatedAt: number; isActive: boolean }
  >();

  for (const row of data ?? []) {
    const seasonName = row.season_name?.trim();
    if (!seasonName) {
      continue;
    }

    const createdAtMs = row.created_at ? Date.parse(row.created_at) : 0;
    const fallbackMs = row.game_date ? Date.parse(`${row.game_date}T00:00:00Z`) : 0;
    const latestCreatedAt = Number.isFinite(createdAtMs) && createdAtMs > 0 ? createdAtMs : fallbackMs;
    const seasonYear =
      extractYearFromDateLike(row.created_at) ??
      extractYearFromDateLike(row.game_date) ??
      activeSeasonYear;

    const existing = bySeason.get(seasonName);
    if (!existing) {
      bySeason.set(seasonName, {
        seasonName,
        seasonYear,
        latestCreatedAt,
        isActive: seasonName === activeSeasonName,
      });
      continue;
    }

    existing.seasonYear = Math.min(existing.seasonYear, seasonYear);
    existing.latestCreatedAt = Math.max(existing.latestCreatedAt, latestCreatedAt);
    if (seasonName === activeSeasonName) {
      existing.isActive = true;
    }
  }

  if (!bySeason.has(activeSeasonName)) {
    bySeason.set(activeSeasonName, {
      seasonName: activeSeasonName,
      seasonYear: activeSeasonYear,
      latestCreatedAt: Date.parse(settings.updated_at) || Date.now(),
      isActive: true,
    });
  }

  const sorted = Array.from(bySeason.values()).sort((a, b) => {
    if (b.seasonYear !== a.seasonYear) {
      return b.seasonYear - a.seasonYear;
    }

    if (b.latestCreatedAt !== a.latestCreatedAt) {
      return b.latestCreatedAt - a.latestCreatedAt;
    }

    return a.seasonName.localeCompare(b.seasonName);
  });

  const normalizedLimit = Math.max(1, limit);
  let limited = sorted.slice(0, normalizedLimit);
  if (!limited.some((season) => season.seasonName === activeSeasonName)) {
    const activeOption = sorted.find((season) => season.seasonName === activeSeasonName);
    if (activeOption) {
      limited = [...limited.slice(0, Math.max(0, normalizedLimit - 1)), activeOption];
    }
  }

  return limited.map((season) => ({
    seasonName: season.seasonName,
    seasonYear: season.seasonYear,
    label: formatSeasonLabelWithYear(season.seasonName, season.seasonYear),
    isActive: season.isActive,
  }));
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
      "id,season_name,game_phase,game_date,game_time,location,game_number,home_team_id,away_team_id,is_tie,cancelled,winner_team_id,loser_team_id,result_source,created_at,updated_at",
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
        "id,season_name,game_date,game_time,location,game_number,home_team_id,away_team_id,is_tie,cancelled,winner_team_id,loser_team_id,result_source,created_at,updated_at",
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

export interface BattingStatRow {
  player_name: string;
  team_name: string | null;
  season_type: string;
  gp: number;
  ab: number;
  r: number;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  avg: number | null;
  synced_at: string;
}

export async function loadBattingStats(): Promise<{ rows: BattingStatRow[]; syncedAt: string | null }> {
  const supabase = getServiceSupabaseClient();
  try {
    const { data, error } = await supabase
      .schema("league")
      .from("player_batting_stats")
      .select("player_name,team_name,season_type,gp,ab,r,h,singles,doubles,triples,hr,rbi,bb,so,avg,synced_at")
      .order("avg", { ascending: false, nullsFirst: false });

    if (error) return { rows: [], syncedAt: null };
    if (!data || data.length === 0) return { rows: [], syncedAt: null };

    const rows = data as BattingStatRow[];
    const syncedAt = rows[0]?.synced_at ?? null;
    return { rows, syncedAt };
  } catch {
    return { rows: [], syncedAt: null };
  }
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

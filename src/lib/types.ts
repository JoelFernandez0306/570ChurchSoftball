export type UUID = string;

export type GameSlot = 1 | 2;
export type ResultSource = "sms" | "manual";

export interface Team {
  id: UUID;
  name: string;
  short_name: string | null;
  created_at: string;
}

export interface TeamAlias {
  id: UUID;
  team_id: UUID;
  alias: string;
  normalized_alias: string;
}

export interface Player {
  id: UUID;
  team_id: UUID;
  full_name: string;
  jersey_number: string | null;
  role: "player" | "coach";
}

export interface Game {
  id: UUID;
  game_date: string;
  game_time: string | null;
  location: string | null;
  game_number: GameSlot;
  home_team_id: UUID;
  away_team_id: UUID;
  is_tie: boolean;
  winner_team_id: UUID | null;
  loser_team_id: UUID | null;
  result_source: ResultSource | null;
  created_at: string;
  updated_at: string;
}

export interface TieOverride {
  id: UUID;
  team_id: UUID;
  priority: number;
  active: boolean;
}

export interface StandingsRow {
  teamId: UUID;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  rank: number;
  headToHeadPct: number;
  h2hTieGroupId?: string;
  overrideApplied: boolean;
}

export interface SmsParseResult {
  date: string;
  slot: GameSlot;
  isTie: boolean;
  winnerAlias: string;
  loserAlias: string;
  confidence: "high" | "medium" | "low";
  errors: string[];
}

export interface ResolvedTeam {
  teamId: UUID | null;
  teamName: string | null;
  ambiguousOptions: string[];
}

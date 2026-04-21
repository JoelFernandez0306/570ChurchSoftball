-- Add season_type to distinguish regular season from playoff stats.
-- Update the unique constraint to include season_type so a player can have
-- separate rows for regular season and playoffs.

ALTER TABLE league.player_batting_stats
  ADD COLUMN IF NOT EXISTS season_type TEXT NOT NULL DEFAULT 'regular';

-- Drop old unique constraint and replace with one that includes season_type
ALTER TABLE league.player_batting_stats
  DROP CONSTRAINT IF EXISTS player_batting_stats_player_name_team_name_key;

ALTER TABLE league.player_batting_stats
  ADD CONSTRAINT player_batting_stats_player_name_team_name_season_type_key
  UNIQUE (player_name, team_name, season_type);

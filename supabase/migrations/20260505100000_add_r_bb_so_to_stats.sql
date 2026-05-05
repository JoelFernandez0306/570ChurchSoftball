-- Add R (runs), BB (walks), SO (strikeouts) from box score scraping.
-- These replace the advanced stats that required team-admin access.

ALTER TABLE league.player_game_stats
  ADD COLUMN IF NOT EXISTS r  INTEGER,
  ADD COLUMN IF NOT EXISTS bb INTEGER,
  ADD COLUMN IF NOT EXISTS so INTEGER;

ALTER TABLE league.player_batting_stats
  ADD COLUMN IF NOT EXISTS r  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bb INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS so INTEGER NOT NULL DEFAULT 0;

-- Clear previously scraped per-game data so everything is re-scraped
-- cleanly with the new box-score approach (old game-stats data was
-- incomplete — only IC games, missing r/bb/so).
TRUNCATE TABLE league.player_game_stats;

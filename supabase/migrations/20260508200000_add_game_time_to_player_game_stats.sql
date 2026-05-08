-- Add game_time to player_game_stats so GC-synced games can show
-- their scheduled start time (scraped from the box score page header).
ALTER TABLE league.player_game_stats ADD COLUMN IF NOT EXISTS game_time TIME;

-- Backfill scorebook rows from league.games
UPDATE league.player_game_stats pgs
SET game_time = g.game_time
FROM league.games g
WHERE g.id::text = pgs.game_id
  AND pgs.game_time IS NULL;

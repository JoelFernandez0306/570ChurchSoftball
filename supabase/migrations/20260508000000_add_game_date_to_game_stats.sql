-- Add game_date to player_game_stats so both GC and scorebook entries
-- can display the date on the Correct Stats admin page.
ALTER TABLE league.player_game_stats ADD COLUMN IF NOT EXISTS game_date DATE;

-- Backfill existing scorebook rows (their game_id is a league.games UUID)
UPDATE league.player_game_stats pgs
SET game_date = g.game_date
FROM league.games g
WHERE g.id::text = pgs.game_id
  AND pgs.game_date IS NULL;

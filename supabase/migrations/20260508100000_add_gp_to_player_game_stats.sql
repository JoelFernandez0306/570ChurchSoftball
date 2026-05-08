-- Add gp (games played flag) to player_game_stats.
-- 1 = include this game in season totals (default).
-- 0 = exclude this game from aggregation (used to neutralize duplicate entries
--     without deleting the underlying data).
ALTER TABLE league.player_game_stats ADD COLUMN IF NOT EXISTS gp INTEGER NOT NULL DEFAULT 1;

-- Add weather/cancellation support to games.
-- A cancelled game has cancelled=true with winner/loser/is_tie cleared.
ALTER TABLE league.games
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_games_cancelled ON league.games(cancelled);

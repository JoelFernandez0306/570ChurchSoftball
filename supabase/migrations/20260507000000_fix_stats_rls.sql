-- Fix overly-permissive grants on stats tables.
-- Original migrations used GRANT ALL TO anon, which lets any unauthenticated
-- request (with just the public anon key) write or delete stats.
-- Tighten to SELECT-only for anon/authenticated; service_role handles all writes.

-- player_batting_stats
REVOKE ALL ON TABLE league.player_batting_stats FROM anon, authenticated;
GRANT SELECT ON TABLE league.player_batting_stats TO anon, authenticated;
ALTER TABLE league.player_batting_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON league.player_batting_stats;
CREATE POLICY "Public read"
  ON league.player_batting_stats FOR SELECT
  USING (true);

-- player_game_stats
REVOKE ALL ON TABLE league.player_game_stats FROM anon, authenticated;
GRANT SELECT ON TABLE league.player_game_stats TO anon, authenticated;
ALTER TABLE league.player_game_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON league.player_game_stats;
CREATE POLICY "Public read"
  ON league.player_game_stats FOR SELECT
  USING (true);

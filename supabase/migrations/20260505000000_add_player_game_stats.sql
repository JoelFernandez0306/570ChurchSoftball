-- Per-game batting stats, keyed by game_id.
-- The sync script upserts one row per player per game here,
-- then re-aggregates into player_batting_stats. This lets the
-- nightly cron skip games it has already scraped.
CREATE TABLE IF NOT EXISTS league.player_game_stats (
  game_id       TEXT         NOT NULL,
  player_name   TEXT         NOT NULL,
  team_name     TEXT         NOT NULL,
  season_type   TEXT         NOT NULL DEFAULT 'regular',
  pa            INTEGER,
  ab            INTEGER,
  h             INTEGER,
  singles       INTEGER,
  doubles       INTEGER,
  triples       INTEGER,
  hr            INTEGER,
  rbi           INTEGER,
  qab           INTEGER,
  hhb           INTEGER,
  ld            INTEGER,
  fb            INTEGER,
  gb            INTEGER,
  babip         NUMERIC(6,4),
  ba_risp       NUMERIC(6,4),
  lob           INTEGER,
  two_out_rbi   INTEGER,
  xbh           INTEGER,
  tb            INTEGER,
  ps            INTEGER,
  ps_pa         NUMERIC(6,3),
  two_s3        INTEGER,
  six_plus      INTEGER,
  gidp          INTEGER,
  ci            INTEGER,
  scraped_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, player_name, team_name)
);

GRANT ALL ON TABLE league.player_game_stats TO postgres, anon, authenticated, service_role;

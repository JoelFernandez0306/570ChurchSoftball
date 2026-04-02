alter table league.settings
add column if not exists gamechanger_embed_url text;

alter table league.settings
add column if not exists gamechanger_home_team text;

alter table league.settings
add column if not exists gamechanger_away_team text;

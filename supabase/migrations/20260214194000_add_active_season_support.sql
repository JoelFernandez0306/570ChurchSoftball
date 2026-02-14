alter table league.settings
add column if not exists active_season_name text;

alter table league.settings
alter column active_season_name set default (
  'Season ' || extract(year from timezone('America/New_York', now()))::text
);

update league.settings
set active_season_name = coalesce(
  nullif(btrim(active_season_name), ''),
  'Season ' || season_year::text
);

alter table league.settings
alter column active_season_name set not null;

alter table league.games
add column if not exists season_name text;

update league.games g
set season_name = coalesce(
  nullif(btrim(g.season_name), ''),
  s.active_season_name
)
from league.settings s
where g.season_name is null or btrim(g.season_name) = '';

alter table league.games
alter column season_name set not null;

create or replace function league.default_game_season_name()
returns trigger
language plpgsql
as $$
begin
  if new.season_name is null or btrim(new.season_name) = '' then
    select active_season_name
      into new.season_name
      from league.settings
      order by updated_at desc
      limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists set_game_season_name on league.games;

create trigger set_game_season_name
before insert on league.games
for each row
execute function league.default_game_season_name();

drop index if exists league.idx_games_unique_slot;

create unique index if not exists idx_games_unique_slot
on league.games(season_name, game_date, game_number, home_team_id, away_team_id);

drop index if exists league.idx_games_date_team_slot;

create index if not exists idx_games_date_team_slot
on league.games(season_name, game_date, game_number, home_team_id, away_team_id);

create index if not exists idx_games_season_name
on league.games(season_name);

alter table league.settings
add column if not exists active_competition_phase text;

update league.settings
set active_competition_phase = 'regular_season'
where active_competition_phase is null
   or btrim(active_competition_phase) = ''
   or active_competition_phase not in ('regular_season', 'playoffs');

alter table league.settings
alter column active_competition_phase set default 'regular_season';

alter table league.settings
alter column active_competition_phase set not null;

alter table league.settings
drop constraint if exists chk_settings_active_competition_phase;

alter table league.settings
add constraint chk_settings_active_competition_phase
check (active_competition_phase in ('regular_season', 'playoffs'));

alter table league.games
add column if not exists game_phase text;

update league.games
set game_phase = 'regular_season'
where game_phase is null
   or btrim(game_phase) = ''
   or game_phase not in ('regular_season', 'playoffs');

alter table league.games
alter column game_phase set default 'regular_season';

alter table league.games
alter column game_phase set not null;

alter table league.games
drop constraint if exists chk_games_game_phase;

alter table league.games
add constraint chk_games_game_phase
check (game_phase in ('regular_season', 'playoffs'));

create or replace function league.default_game_season_name()
returns trigger
language plpgsql
as $$
declare
  settings_season text;
  settings_phase text;
begin
  if new.season_name is null
    or btrim(new.season_name) = ''
    or new.game_phase is null
    or btrim(new.game_phase) = '' then
    select active_season_name, active_competition_phase
      into settings_season, settings_phase
      from league.settings
      order by updated_at desc
      limit 1;
  end if;

  if new.season_name is null or btrim(new.season_name) = '' then
    new.season_name := settings_season;
  end if;

  if new.game_phase is null or btrim(new.game_phase) = '' then
    new.game_phase := coalesce(nullif(btrim(settings_phase), ''), 'regular_season');
  end if;

  if new.game_phase not in ('regular_season', 'playoffs') then
    new.game_phase := 'regular_season';
  end if;

  return new;
end;
$$;

drop index if exists league.idx_games_unique_slot;

create unique index if not exists idx_games_unique_slot
on league.games(season_name, game_phase, game_date, game_number, home_team_id, away_team_id);

drop index if exists league.idx_games_date_team_slot;

create index if not exists idx_games_date_team_slot
on league.games(season_name, game_phase, game_date, game_number, home_team_id, away_team_id);

drop index if exists league.idx_games_season_name;

create index if not exists idx_games_season_phase
on league.games(season_name, game_phase);

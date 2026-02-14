create extension if not exists pgcrypto;

DROP SCHEMA IF EXISTS league CASCADE;
CREATE SCHEMA league;

create table league.settings (
  id uuid primary key default gen_random_uuid(),
  league_name text not null default '570 Church Softball League',
  season_year int not null,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table league.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table league.allowed_sms_numbers (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  label text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table league.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table league.team_aliases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references league.teams(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, normalized_alias)
);

create index idx_team_aliases_normalized_alias on league.team_aliases(normalized_alias);

create table league.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references league.teams(id) on delete cascade,
  full_name text not null,
  jersey_number text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_players_team_id on league.players(team_id);

create table league.rules (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'League Rules',
  content text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table league.games (
  id uuid primary key default gen_random_uuid(),
  game_date date not null,
  game_time time,
  location text,
  game_number int not null check (game_number in (1,2)),
  home_team_id uuid not null references league.teams(id) on delete restrict,
  away_team_id uuid not null references league.teams(id) on delete restrict,
  winner_team_id uuid references league.teams(id) on delete set null,
  loser_team_id uuid references league.teams(id) on delete set null,
  result_source text check (result_source in ('sms','manual')),
  reported_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_teams_distinct check (home_team_id <> away_team_id),
  constraint chk_result_distinct check (
    winner_team_id is null
    or loser_team_id is null
    or winner_team_id <> loser_team_id
  )
);

create unique index idx_games_unique_slot on league.games(game_date, game_number, home_team_id, away_team_id);
create index idx_games_date_team_slot on league.games(game_date, game_number, home_team_id, away_team_id);
create index idx_games_winner_loser on league.games(winner_team_id, loser_team_id);

create table league.tie_overrides (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references league.teams(id) on delete cascade,
  priority int not null check (priority > 0),
  active boolean not null default true,
  reason text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tie_overrides_priority on league.tie_overrides(priority) where active = true;

create table league.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create or replace function league.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_settings_updated_at before update on league.settings
for each row execute function league.set_updated_at();
create trigger set_admins_updated_at before update on league.admins
for each row execute function league.set_updated_at();
create trigger set_allowed_sms_updated_at before update on league.allowed_sms_numbers
for each row execute function league.set_updated_at();
create trigger set_teams_updated_at before update on league.teams
for each row execute function league.set_updated_at();
create trigger set_team_aliases_updated_at before update on league.team_aliases
for each row execute function league.set_updated_at();
create trigger set_players_updated_at before update on league.players
for each row execute function league.set_updated_at();
create trigger set_rules_updated_at before update on league.rules
for each row execute function league.set_updated_at();
create trigger set_games_updated_at before update on league.games
for each row execute function league.set_updated_at();
create trigger set_tie_overrides_updated_at before update on league.tie_overrides
for each row execute function league.set_updated_at();

create or replace function league.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = league, public
as $$
  select exists (
    select 1
    from league.admins
    where user_id = uid
      and active = true
  );
$$;

grant usage on schema league to authenticated, anon, service_role;
grant select on league.settings, league.teams, league.team_aliases, league.players, league.rules, league.games to anon, authenticated;

grant all on all tables in schema league to service_role;
grant usage, select on all sequences in schema league to service_role;

alter table league.settings enable row level security;
alter table league.admins enable row level security;
alter table league.allowed_sms_numbers enable row level security;
alter table league.teams enable row level security;
alter table league.team_aliases enable row level security;
alter table league.players enable row level security;
alter table league.rules enable row level security;
alter table league.games enable row level security;
alter table league.tie_overrides enable row level security;
alter table league.audit_log enable row level security;

create policy public_read_settings on league.settings for select using (true);
create policy public_read_teams on league.teams for select using (true);
create policy public_read_aliases on league.team_aliases for select using (true);
create policy public_read_players on league.players for select using (true);
create policy public_read_rules on league.rules for select using (true);
create policy public_read_games on league.games for select using (true);
create policy public_read_tie_overrides on league.tie_overrides for select using (true);

create policy admin_read_admins on league.admins
for select to authenticated
using (league.is_admin() or user_id = auth.uid());

create policy admin_write_admins on league.admins
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

create policy admin_write_allowed_sms on league.allowed_sms_numbers
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

create policy admin_write_teams on league.teams
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

create policy admin_write_aliases on league.team_aliases
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

create policy admin_write_players on league.players
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

create policy admin_write_rules on league.rules
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

create policy admin_write_games on league.games
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

create policy admin_write_tie_overrides on league.tie_overrides
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

create policy admin_write_audit_log on league.audit_log
for all to authenticated
using (league.is_admin())
with check (league.is_admin());

insert into league.settings (league_name, season_year, timezone)
values ('570 Church Softball League', extract(year from timezone('America/New_York', now()))::int, 'America/New_York');

insert into league.rules (title, content, is_active)
values (
  'League Rules',
  E'# 570 Church Softball League Rules\n\n1. Sportsmanship and church fellowship come first.\n2. Each matchup day includes Game 1 and Game 2.\n3. Report winners/losses immediately after games.\n4. Admin decisions are final for tie overrides and corrections.',
  true
);

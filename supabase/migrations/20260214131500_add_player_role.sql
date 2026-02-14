alter table league.players
add column if not exists role text not null default 'player'
check (role in ('player', 'coach'));

update league.players
set role = 'player'
where role is null;

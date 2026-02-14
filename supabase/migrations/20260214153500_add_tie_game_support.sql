alter table league.games
add column if not exists is_tie boolean not null default false;

update league.games
set winner_team_id = null,
    loser_team_id = null,
    result_source = null,
    is_tie = false
where (winner_team_id is null and loser_team_id is not null)
   or (winner_team_id is not null and loser_team_id is null);

alter table league.games
drop constraint if exists chk_result_distinct;

alter table league.games
drop constraint if exists chk_game_result_state;

alter table league.games
add constraint chk_game_result_state check (
  (is_tie = true and winner_team_id is null and loser_team_id is null)
  or
  (
    is_tie = false
    and (
      (winner_team_id is null and loser_team_id is null)
      or
      (winner_team_id is not null and loser_team_id is not null and winner_team_id <> loser_team_id)
    )
  )
);

create index if not exists idx_games_is_tie on league.games(is_tie);

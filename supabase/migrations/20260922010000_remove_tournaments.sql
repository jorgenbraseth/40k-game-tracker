-- Removes the tournaments feature (issue #74/#75's tournaments half) entirely -- we might
-- reintroduce it later, but for now it's coming out: the tournaments table, its members/game-tag
-- join tables, every tournament-only RPC, and every function signature/policy that grew a
-- tournament-shaped parameter or clause alongside its ladder one. Ladders (the older, still-wanted
-- feature that tournaments was modeled on) are untouched.
--
-- breaking-change-ok: no native app build has ever shipped past this -- README's "What's actually
-- in place right now" says the Android wrapper (#125) is still unreleased scaffolding (no Play
-- Store listing yet) and iOS (#126) hasn't been started, so there's no installed client anywhere
-- that could still be calling create_tournament/set_game_tournaments/create_game's tournament
-- params, or reading a tournament-shaped row.

-- create_game reverts to ladder-only tagging (still an array -- issue #75's multi-ladder tagging
-- stays, only the tournament half goes).
drop function if exists create_game(int, uuid, uuid, text, uuid[], uuid[]);

create function create_game(
  p_points_limit int,
  p_force_disposition_id uuid default null,
  p_faction_id uuid default null,
  p_army_name text default null,
  p_ladder_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_game_id uuid;
  v_mission_pack_id uuid;
  v_attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (
    select 1 from unnest(p_ladder_ids) as lid
    where not exists (
      select 1 from ladder_members lm join ladders l on l.id = lm.ladder_id
      where lm.ladder_id = lid and lm.user_id = auth.uid() and l.archived_at is null
    )
  ) then
    raise exception 'not a member of one of those ladders';
  end if;

  select id into v_mission_pack_id from mission_packs where is_current = true order by valid_from desc limit 1;
  if v_mission_pack_id is null then
    raise exception 'no current mission pack configured';
  end if;

  loop
    v_code := generate_join_code();
    begin
      insert into games (join_code, status, mission_pack_id, points_limit, created_by)
      values (v_code, 'lobby', v_mission_pack_id, p_points_limit, auth.uid())
      returning id into v_game_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique join code, try again';
      end if;
    end;
  end loop;

  insert into game_ladders (game_id, ladder_id) select v_game_id, lid from unnest(p_ladder_ids) as lid;

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id)
  values (v_game_id, auth.uid(), 1, p_faction_id, p_army_name, p_force_disposition_id);

  insert into game_players (game_id, user_id, seat)
  values (v_game_id, null, 2);

  return v_game_id;
end;
$$;

grant execute on function create_game(int, uuid, uuid, text, uuid[]) to authenticated;

-- log_completed_game reverts the same way.
drop function if exists log_completed_game(int, timestamptz, int, int, uuid, uuid, text, uuid, uuid, uuid, text, uuid[], uuid[]);

create function log_completed_game(
  p_points_limit int,
  p_played_at timestamptz,
  p_my_vp int,
  p_opponent_vp int,
  p_my_faction_id uuid default null,
  p_my_force_disposition_id uuid default null,
  p_my_army_name text default null,
  p_opponent_represents_user_id uuid default null,
  p_opponent_faction_id uuid default null,
  p_opponent_force_disposition_id uuid default null,
  p_opponent_army_name text default null,
  p_ladder_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_game_id uuid;
  v_mission_pack_id uuid;
  v_seat1_id uuid;
  v_seat2_id uuid;
  v_outcome text;
  v_attempts int := 0;
  v_remaining int;
  v_round int;
  v_chunk int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_my_vp < 0 or p_my_vp > 90 or p_opponent_vp < 0 or p_opponent_vp > 90 then
    raise exception 'final score must be between 0 and 90';
  end if;

  if p_played_at > now() then
    raise exception 'played-on date cannot be in the future';
  end if;

  if exists (
    select 1 from unnest(p_ladder_ids) as lid
    where not exists (
      select 1 from ladder_members lm join ladders l on l.id = lm.ladder_id
      where lm.ladder_id = lid and lm.user_id = auth.uid() and l.archived_at is null
    )
  ) then
    raise exception 'not a member of one of those ladders';
  end if;

  if p_opponent_represents_user_id is not null and not exists (
    select 1 from unnest(p_ladder_ids) as lid
    join ladder_members lm on lm.ladder_id = lid
    where lm.user_id = p_opponent_represents_user_id
  ) then
    raise exception 'that player is not a member of any of the selected ladders';
  end if;

  select id into v_mission_pack_id from mission_packs where is_current = true order by valid_from desc limit 1;
  if v_mission_pack_id is null then
    raise exception 'no current mission pack configured';
  end if;

  v_outcome := case
    when p_my_vp > p_opponent_vp then 'seat_1'
    when p_opponent_vp > p_my_vp then 'seat_2'
    else 'draw'
  end;

  loop
    v_code := generate_join_code();
    begin
      insert into games (join_code, status, mission_pack_id, points_limit, created_by, outcome, ended_at, is_retroactive)
      values (v_code, 'complete', v_mission_pack_id, p_points_limit, auth.uid(), v_outcome, p_played_at, true)
      returning id into v_game_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique join code, try again';
      end if;
    end;
  end loop;

  insert into game_ladders (game_id, ladder_id) select v_game_id, lid from unnest(p_ladder_ids) as lid;

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id)
  values (v_game_id, auth.uid(), 1, p_my_faction_id, p_my_army_name, p_my_force_disposition_id)
  returning id into v_seat1_id;

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id, represents_user_id)
  values (v_game_id, null, 2, p_opponent_faction_id, p_opponent_army_name, p_opponent_force_disposition_id, p_opponent_represents_user_id)
  returning id into v_seat2_id;

  v_remaining := p_my_vp;
  v_round := 1;
  while v_remaining > 0 loop
    v_chunk := least(v_remaining, 15);
    insert into round_scores (game_id, game_player_id, battle_round, primary_vp, updated_by)
    values (v_game_id, v_seat1_id, v_round, v_chunk, auth.uid());
    v_remaining := v_remaining - v_chunk;
    v_round := v_round + 1;
  end loop;

  v_remaining := p_opponent_vp;
  v_round := 1;
  while v_remaining > 0 loop
    v_chunk := least(v_remaining, 15);
    insert into round_scores (game_id, game_player_id, battle_round, primary_vp, updated_by)
    values (v_game_id, v_seat2_id, v_round, v_chunk, auth.uid());
    v_remaining := v_remaining - v_chunk;
    v_round := v_round + 1;
  end loop;

  insert into game_player_verifications (game_player_id, game_id, verified_by)
  values (v_seat1_id, v_game_id, auth.uid());

  return v_game_id;
end;
$$;

grant execute on function log_completed_game(int, timestamptz, int, int, uuid, uuid, text, uuid, uuid, uuid, text, uuid[]) to authenticated;

-- Visibility policies revert to ladder-only (the tournament half of each "or" clause goes).
drop policy "grouping-tagged games are readable by any signed-in user" on games;
drop policy "grouping-tagged games' game_players are readable by any signed-in user" on game_players;
drop policy "grouping-tagged games' round_scores are readable by any signed-in user" on round_scores;
drop policy "grouping-tagged games' secondary_scores are readable by any signed-in user" on secondary_scores;

create policy "ladder-tagged games are readable by any signed-in user" on games
  for select to authenticated using (
    exists (select 1 from game_ladders where game_ladders.game_id = games.id)
  );

create policy "ladder-tagged games' game_players are readable by any signed-in user" on game_players
  for select to authenticated using (
    exists (select 1 from game_ladders where game_ladders.game_id = game_players.game_id)
  );

create policy "ladder-tagged games' round_scores are readable by any signed-in user" on round_scores
  for select to authenticated using (
    exists (select 1 from game_ladders where game_ladders.game_id = round_scores.game_id)
  );

create policy "ladder-tagged games' secondary_scores are readable by any signed-in user" on secondary_scores
  for select to authenticated using (
    exists (select 1 from game_ladders where game_ladders.game_id = secondary_scores.game_id)
  );

-- Tournament-only RPCs and tables.
drop function if exists set_game_tournaments(uuid, uuid[]);
drop function if exists join_tournament_by_code(uuid, text);
drop function if exists regenerate_tournament_invite_code(uuid);
drop function if exists get_tournament_invite_code(uuid);
drop function if exists create_tournament(text, date, date);

drop table if exists game_tournaments;
drop table if exists tournament_members;
drop table if exists tournaments;

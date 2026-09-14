-- A single player must be able to completely track a game alone -- both
-- sides' setup, and both sides' scores round by round -- with no second
-- account required. Sharing the join code stays possible, but joining is
-- now just how a second person gets added as another set of hands able
-- to adjust the numbers, not a precondition for using the app at all.
--
-- Score entry (round_scores/secondary_scores) already allowed either
-- participant to edit either seat -- that part needed no change. What
-- was missing: a game could not exist with only one real player, because
-- game_players.user_id was NOT NULL and create_game only ever inserted
-- the creator's own seat, so the waiting room had nothing to show or
-- start for seat 2 until someone joined.

alter table game_players alter column user_id drop not null;

-- create_game now always creates both seats: the creator's own (seat 1,
-- as before) and an unclaimed seat 2 (no user_id, blank setup) the
-- creator can fill in themselves from the waiting room -- same
-- PlayerSetupFields UI as their own seat, just targeting seat 2's id.
-- If a second player later joins by code, join_game_by_code (below)
-- claims this row instead of inserting a third one.
drop function if exists create_game(uuid, int, uuid, uuid, text);

create function create_game(
  p_deployment_id uuid,
  p_points_limit int,
  p_force_disposition_id uuid default null,
  p_faction_id uuid default null,
  p_army_name text default null
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

  select id into v_mission_pack_id from mission_packs where is_current = true order by valid_from desc limit 1;
  if v_mission_pack_id is null then
    raise exception 'no current mission pack configured';
  end if;

  loop
    v_code := generate_join_code();
    begin
      insert into games (join_code, status, mission_pack_id, deployment_id, points_limit, created_by)
      values (v_code, 'lobby', v_mission_pack_id, p_deployment_id, p_points_limit, auth.uid())
      returning id into v_game_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique join code, try again';
      end if;
    end;
  end loop;

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id)
  values (v_game_id, auth.uid(), 1, p_faction_id, p_army_name, p_force_disposition_id);

  insert into game_players (game_id, user_id, seat)
  values (v_game_id, null, 2);

  return v_game_id;
end;
$$;

-- join_game_by_code now claims the unclaimed seat 2 row create_game
-- always creates, instead of inserting a competing row (there'd be
-- nowhere left for it -- both seat numbers already exist). Falls back to
-- the old insert-at-free-seat behaviour for games created before this
-- migration, which only ever have the creator's single row.
drop function if exists join_game_by_code(text, uuid, uuid, text);

create function join_game_by_code(
  p_code text,
  p_force_disposition_id uuid default null,
  p_faction_id uuid default null,
  p_army_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_game games%rowtype;
  v_existing game_players%rowtype;
  v_unclaimed game_players%rowtype;
  v_claimed_seats int;
  v_seat int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_game from games where join_code = v_code for update;

  if not found then
    insert into join_attempts (user_id, code_attempted, success, reason)
    values (auth.uid(), v_code, false, 'not_found');
    return null;
  end if;

  select * into v_existing from game_players where game_id = v_game.id and user_id = auth.uid();
  if found then
    insert into join_attempts (user_id, code_attempted, success, reason)
    values (auth.uid(), v_code, true, 'already_joined');
    return v_game.id;
  end if;

  if v_game.status <> 'lobby' then
    insert into join_attempts (user_id, code_attempted, success, reason)
    values (auth.uid(), v_code, false, 'wrong_status');
    return null;
  end if;

  select count(*) into v_claimed_seats from game_players where game_id = v_game.id and user_id is not null;
  if v_claimed_seats >= 2 then
    insert into join_attempts (user_id, code_attempted, success, reason)
    values (auth.uid(), v_code, false, 'full');
    return null;
  end if;

  select * into v_unclaimed from game_players where game_id = v_game.id and user_id is null limit 1 for update;

  if found then
    -- Claim it, keeping whatever the creator already filled in as a
    -- starting point; only overwrite fields the joiner actually chose.
    update game_players
    set user_id = auth.uid(),
        force_disposition_id = coalesce(p_force_disposition_id, force_disposition_id),
        faction_id = coalesce(p_faction_id, faction_id),
        army_name = coalesce(p_army_name, army_name)
    where id = v_unclaimed.id;
  else
    select min(s) into v_seat
    from unnest(array[1, 2]) as s
    where s not in (select seat from game_players where game_id = v_game.id);

    insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id)
    values (v_game.id, auth.uid(), v_seat, p_faction_id, p_army_name, p_force_disposition_id);
  end if;

  insert into join_attempts (user_id, code_attempted, success, reason)
  values (auth.uid(), v_code, true, null);

  return v_game.id;
end;
$$;

grant execute on function create_game(uuid, int, uuid, uuid, text) to authenticated;
grant execute on function join_game_by_code(text, uuid, uuid, text) to authenticated;

-- Setup fields (faction/army/Force Disposition/role/ready) must now be
-- editable by any participant when the seat is unclaimed -- that's what
-- lets a solo player fill in "the opponent" themselves -- in addition to
-- each player always being able to edit their own claimed seat. Only the
-- join_game_by_code/resolve_game_mission RPCs (security definer) may
-- ever change who a seat belongs to or which mission it resolved to, so
-- this widened policy is paired with a column-scoped GRANT that excludes
-- user_id, mission_id, game_id and seat from what a client can write
-- directly -- widening the ROWS a participant may touch must not also
-- widen the COLUMNS they can change on them.
drop policy "players can update their own seat" on game_players;
create policy "players can update their own seat, or claim/fill an unclaimed one" on game_players
  for update to authenticated
  using (user_id = auth.uid() or (user_id is null and is_game_participant(game_id)))
  with check (user_id = auth.uid() or (user_id is null and is_game_participant(game_id)));

revoke update on game_players from authenticated;
grant update (faction_id, army_name, force_disposition_id, role, is_ready) on game_players to authenticated;

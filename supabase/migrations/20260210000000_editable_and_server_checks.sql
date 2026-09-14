-- Three changes, driven by one product rule: this is a bookkeeping app,
-- not a guided workflow -- a player must always be able to correct
-- something they entered wrong (wrong secondary tapped, wrong army
-- picked, wrong Force Disposition picked), and the server-side rules
-- must not silently go stale when a correction happens.

-- 1. resolve_game_mission used to only ever fill in a NULL mission_id, so
-- correcting a Force Disposition after both players had already picked
-- left the old, now-wrong mission in place. It's a pure function of both
-- players' current Force Dispositions, so it's safe (and correct) to
-- just always recompute and overwrite on every call.
drop function if exists resolve_game_mission(uuid);

create function resolve_game_mission(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission_pack_id uuid;
  v_p1 game_players%rowtype;
  v_p2 game_players%rowtype;
  v_mission_id uuid;
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  select mission_pack_id into v_mission_pack_id from games where id = p_game_id;

  select * into v_p1 from game_players where game_id = p_game_id and seat = 1;
  select * into v_p2 from game_players where game_id = p_game_id and seat = 2;

  if v_p1.id is null or v_p2.id is null
     or v_p1.force_disposition_id is null or v_p2.force_disposition_id is null then
    return;
  end if;

  select id into v_mission_id
  from missions
  where mission_pack_id = v_mission_pack_id
    and force_disposition_id = v_p1.force_disposition_id
    and opponent_force_disposition_id = v_p2.force_disposition_id
  limit 1;
  update game_players set mission_id = v_mission_id where id = v_p1.id and mission_id is distinct from v_mission_id;

  select id into v_mission_id
  from missions
  where mission_pack_id = v_mission_pack_id
    and force_disposition_id = v_p2.force_disposition_id
    and opponent_force_disposition_id = v_p1.force_disposition_id
  limit 1;
  update game_players set mission_id = v_mission_id where id = v_p2.id and mission_id is distinct from v_mission_id;
end;
$$;

grant execute on function resolve_game_mission(uuid) to authenticated;

-- 2. start_game: the client only checked "both ready, both roles, mission
-- resolved" in the UI before flipping games.status -- nothing stopped a
-- participant from starting a game directly via the update regardless.
-- Moves the precondition check server-side; the games UPDATE policy
-- (is_game_participant) still gates who may call this.
create function start_game(p_game_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ready_count int;
  v_role_count int;
  v_mission_count int;
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  select
    count(*) filter (where is_ready),
    count(*) filter (where role is not null),
    count(*) filter (where mission_id is not null)
  into v_ready_count, v_role_count, v_mission_count
  from game_players
  where game_id = p_game_id;

  if v_ready_count < 2 or v_role_count < 2 or v_mission_count < 2 then
    raise exception 'both players must be ready, have a role, and have a resolved mission before starting';
  end if;

  update games set status = 'active', started_at = now()
  where id = p_game_id and status = 'lobby';
end;
$$;

grant execute on function start_game(uuid) to authenticated;

-- 3. round_scores/secondary_scores insert/update policies checked
-- `is_game_participant(game_id)` but never that the supplied
-- game_player_id actually belongs to that game_id -- a participant of
-- game A could write a row with game_id = A (passing the check) but a
-- game_player_id borrowed from an unrelated game B, corrupting B's
-- totals/history if that id became known some other way.
create function game_player_belongs_to_game(p_game_player_id uuid, p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_players where id = p_game_player_id and game_id = p_game_id
  );
$$;

grant execute on function game_player_belongs_to_game(uuid, uuid) to authenticated;

drop policy "participants can insert round_scores in their games" on round_scores;
create policy "participants can insert round_scores in their games" on round_scores
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can update round_scores in their games" on round_scores;
create policy "participants can update round_scores in their games" on round_scores
  for update to authenticated
  using (is_game_participant(game_id))
  with check (
    is_game_participant(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can insert secondary_scores in their games" on secondary_scores;
create policy "participants can insert secondary_scores in their games" on secondary_scores
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can update secondary_scores in their games" on secondary_scores;
create policy "participants can update secondary_scores in their games" on secondary_scores
  for update to authenticated
  using (is_game_participant(game_id))
  with check (
    is_game_participant(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

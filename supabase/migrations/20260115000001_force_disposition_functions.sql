-- create_game/join_game_by_code no longer take a mission_id -- the
-- creator no longer picks a shared mission up front. Instead each seat
-- picks its own Force Disposition, and resolve_game_mission() (see
-- 20260115000000) fills in games.mission_id once both have chosen.

drop function if exists create_game(uuid, uuid, uuid, int, uuid, text);
drop function if exists join_game_by_code(text, uuid, text);

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

  return v_game_id;
end;
$$;

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
  v_taken_seats int;
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

  select count(*) into v_taken_seats from game_players where game_id = v_game.id;
  if v_taken_seats >= 2 then
    insert into join_attempts (user_id, code_attempted, success, reason)
    values (auth.uid(), v_code, false, 'full');
    return null;
  end if;

  select min(s) into v_seat
  from unnest(array[1, 2]) as s
  where s not in (select seat from game_players where game_id = v_game.id);

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id)
  values (v_game.id, auth.uid(), v_seat, p_faction_id, p_army_name, p_force_disposition_id);

  insert into join_attempts (user_id, code_attempted, success, reason)
  values (auth.uid(), v_code, true, null);

  return v_game.id;
end;
$$;

grant execute on function create_game(uuid, int, uuid, uuid, text) to authenticated;
grant execute on function join_game_by_code(text, uuid, uuid, text) to authenticated;

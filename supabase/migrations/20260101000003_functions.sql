-- Helper used by most RLS policies below.
create function is_game_participant(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_players
    where game_id = p_game_id and user_id = auth.uid()
  );
$$;

-- 6 chars, uppercase, excludes 0 O 1 I L -- read aloud across a table.
create function generate_join_code()
returns text
language plpgsql
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i int;
begin
  for i in 1..6 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end;
$$;

-- Creates a game in the lobby state, generates a unique join code, and
-- seats the calling user at seat 1. Runs as security definer so it can
-- insert games/game_players rows the caller couldn't insert directly.
create function create_game(
  p_mission_pack_id uuid,
  p_mission_id uuid,
  p_deployment_id uuid,
  p_points_limit int,
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
  v_attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  loop
    v_code := generate_join_code();
    begin
      insert into games (join_code, status, mission_pack_id, mission_id, deployment_id, points_limit, created_by)
      values (v_code, 'lobby', p_mission_pack_id, p_mission_id, p_deployment_id, p_points_limit, auth.uid())
      returning id into v_game_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique join code, try again';
      end if;
    end;
  end loop;

  insert into game_players (game_id, user_id, seat, faction_id, army_name)
  values (v_game_id, auth.uid(), 1, p_faction_id, p_army_name);

  return v_game_id;
end;
$$;

-- Joins an existing lobby game by its code, atomically claiming the free
-- seat. A player who hasn't joined yet can't SELECT the game under RLS, so
-- this has to run as security definer.
--
-- Failure paths (bad code, game not in lobby, game full) do NOT raise --
-- they log the attempt to join_attempts and return null, so the log entry
-- survives (a raised exception would roll back the whole transaction,
-- including the log row). The client treats a null return as "invalid
-- code". Re-joining a game you're already in is idempotent: it returns
-- the existing game_id instead of erroring.
create function join_game_by_code(
  p_code text,
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

  insert into game_players (game_id, user_id, seat, faction_id, army_name)
  values (v_game.id, auth.uid(), v_seat, p_faction_id, p_army_name);

  insert into join_attempts (user_id, code_attempted, success, reason)
  values (auth.uid(), v_code, true, null);

  return v_game.id;
end;
$$;

grant execute on function is_game_participant(uuid) to authenticated;
grant execute on function create_game(uuid, uuid, uuid, int, uuid, text) to authenticated;
grant execute on function join_game_by_code(text, uuid, text) to authenticated;

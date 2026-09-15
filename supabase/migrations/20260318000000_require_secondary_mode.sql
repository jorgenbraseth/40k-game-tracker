-- game_players.secondary_mode (Fixed vs Tactical, added in 20260313000000_secondary_mode.sql) was
-- optional forever -- a seat could start and play a whole game without ever declaring one, at
-- which point SecondaryScores just showed every line for a split card, "(fixed)"/"(tactical)"
-- label and all. That's an awkward default to fall into by inaction rather than a real choice, so
-- it's now required before a game can start, same as faction/Force Disposition/role/turn order --
-- WaitingRoom's canStart already checked those client-side, this closes the same gap server-side
-- start_game already covers for the others.
drop function if exists start_game(uuid);

create function start_game(p_game_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_faction_count int;
  v_role_count int;
  v_turn_order_count int;
  v_mission_count int;
  v_secondary_mode_count int;
  v_layout_variant text;
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  select
    count(*) filter (where faction_id is not null),
    count(*) filter (where role is not null),
    count(*) filter (where turn_order is not null),
    count(*) filter (where mission_id is not null),
    count(*) filter (where secondary_mode is not null)
  into v_faction_count, v_role_count, v_turn_order_count, v_mission_count, v_secondary_mode_count
  from game_players
  where game_id = p_game_id;

  select layout_variant into v_layout_variant from games where id = p_game_id;

  if v_mission_count < 2 or v_faction_count < 2 or v_role_count < 2 or v_turn_order_count < 2
     or v_secondary_mode_count < 2 or v_layout_variant is null then
    raise exception
      'both players need a Force Disposition, faction, role, turn order, and Fixed/Tactical secondaries, and the game needs a chosen layout, before starting';
  end if;

  update games set status = 'active', started_at = now()
  where id = p_game_id and status = 'lobby';
end;
$$;

grant execute on function start_game(uuid) to authenticated;

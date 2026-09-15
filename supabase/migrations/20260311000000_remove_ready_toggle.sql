-- "Ready" was a separate manual toggle sitting on top of already having
-- filled in every required field for a seat -- redundant once starting
-- a game itself checks that those fields are actually filled in.
-- Removed: starting a game now just requires every setup field except
-- army name (which stays genuinely optional, flavour text with no
-- gameplay effect) to be set for both seats -- Force Disposition
-- (implied by both missions having resolved), faction, role, and turn
-- order, plus a chosen terrain layout. Checked the same place
-- "both ready" used to be checked: server-side, in start_game.
alter table game_players drop column is_ready;

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
  v_layout_variant text;
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  select
    count(*) filter (where faction_id is not null),
    count(*) filter (where role is not null),
    count(*) filter (where turn_order is not null),
    count(*) filter (where mission_id is not null)
  into v_faction_count, v_role_count, v_turn_order_count, v_mission_count
  from game_players
  where game_id = p_game_id;

  select layout_variant into v_layout_variant from games where id = p_game_id;

  if v_mission_count < 2 or v_faction_count < 2 or v_role_count < 2 or v_turn_order_count < 2
     or v_layout_variant is null then
    raise exception
      'both players need a Force Disposition, faction, role, and turn order, and the game needs a chosen layout, before starting';
  end if;

  update games set status = 'active', started_at = now()
  where id = p_game_id and status = 'lobby';
end;
$$;

grant execute on function start_game(uuid) to authenticated;

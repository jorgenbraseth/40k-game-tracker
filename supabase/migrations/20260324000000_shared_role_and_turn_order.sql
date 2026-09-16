-- Role (Attacker/Defender) and turn order ("who went first") are each a single decision between
-- the two seats, not an independent choice per player (see GameConfigPicker's own doc comment) --
-- like an actual roll-off at the table, whoever calls it should be able to set both seats at
-- once, not have the other player also go pick the complement on their own device before the
-- game can start. setMirroredField (games.ts) already tried to do this client-side, but could
-- only ever write the *other* seat when that seat was unclaimed or belonged to the caller
-- themselves -- "players can update their own seat, or claim/fill an unclaimed one" (RLS) blocks
-- a client-side update of a real second player's already-claimed seat, so picking a role/turn
-- order for a seat someone else had joined silently left their side unset until they went and
-- picked it themselves too.
--
-- These two RPCs set BOTH seats atomically, security definer so they can write to a seat the
-- caller doesn't own, gated only by is_game_participant -- same trust model this app already uses
-- for round_scores/secondary_scores ("either player may enter either seat's score, players agree
-- at the table"). A null id clears both seats back to undecided.
create function set_role(p_game_id uuid, p_attacker_game_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  if p_attacker_game_player_id is not null and not game_player_belongs_to_game(p_attacker_game_player_id, p_game_id) then
    raise exception 'that seat is not in this game';
  end if;

  update game_players
  set role = case
    when p_attacker_game_player_id is null then null
    when id = p_attacker_game_player_id then 'attacker'
    else 'defender'
  end
  where game_id = p_game_id;
end;
$$;

grant execute on function set_role(uuid, uuid) to authenticated;

create function set_turn_order(p_game_id uuid, p_first_game_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  if p_first_game_player_id is not null and not game_player_belongs_to_game(p_first_game_player_id, p_game_id) then
    raise exception 'that seat is not in this game';
  end if;

  update game_players
  set turn_order = case
    when p_first_game_player_id is null then null
    when id = p_first_game_player_id then 'first'
    else 'second'
  end
  where game_id = p_game_id;
end;
$$;

grant execute on function set_turn_order(uuid, uuid) to authenticated;

-- Direct column updates are no longer how role/turn_order get set (the RPCs above are the only
-- path now, from both WaitingRoom and Scoreboard), so the client no longer needs write access to
-- these columns via the general "own seat" policy either.
revoke update (role, turn_order) on game_players from authenticated;

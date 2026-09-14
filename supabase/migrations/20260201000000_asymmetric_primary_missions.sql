-- Sourced against the real 2026-27 Mission Deck card text and mission
-- generator at https://wahapedia.ru/wh40k11ed/the-rules/mission-deck-2026-27/
-- (names, categories and VP values only -- never GW's rules text, per the
-- copyright note at the top of 20260101000000_reference_tables.sql), two
-- things the earlier Force Disposition migration got wrong are fixed here:
--
-- 1. The Primary Mission is NOT a single mission shared by both players
--    from an unordered Force Disposition pairing. Each player finds their
--    OWN Primary Mission on their OWN Force Disposition card, indexed by
--    the OPPONENT's Force Disposition ("Find your opponent's Force
--    Disposition symbol on your Force Disposition card. The Primary
--    Mission listed below that symbol is your Primary Mission.") Two
--    players with different Force Dispositions therefore play two
--    different Primary Missions (same 15VP cap, different cards) in the
--    same game. This replaces games.mission_id (resolved from an
--    unordered pair) with a per-player game_players.mission_id (resolved
--    from an ordered pair: the player's own FD, then their opponent's).
--
-- 2. Secondary Missions have no fixed/tactical category at the card
--    level -- every one of the 18 cards can be used as either, Fixed vs
--    Tactical is a per-player mode covering the whole deck for the
--    battle, not a property of an individual card. The category column
--    modelled a distinction that doesn't exist in this deck, so it's
--    dropped.

alter table missions rename column force_disposition_a_id to force_disposition_id;
alter table missions rename column force_disposition_b_id to opponent_force_disposition_id;

comment on column missions.force_disposition_id is
  'The Force Disposition whose card this mission is printed on -- the mission owner''s own choice.';
comment on column missions.opponent_force_disposition_id is
  'The opponent''s Force Disposition that indexes to this mission on the owner''s card.';

-- One mission per (owner FD, opponent FD) ordered pair, per pack.
alter table missions
  add constraint missions_fd_pair_key unique (mission_pack_id, force_disposition_id, opponent_force_disposition_id);

alter table game_players
  add column mission_id uuid references missions(id);

alter table games
  drop column mission_id;

drop function if exists resolve_game_mission(uuid);

-- Resolves each player's own mission_id once both players have chosen a
-- Force Disposition. security definer (unlike the function it replaces)
-- because setting the OPPONENT's game_players.mission_id -- not just the
-- caller's own row -- is required and the "players can update their own
-- seat" RLS policy would otherwise block that; is_game_participant() is
-- checked explicitly to compensate. The `mission_id is null` guard on
-- each update means only the first successful resolution per player
-- actually writes, so concurrent callers from both clients converge.
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

  if v_p1.mission_id is null then
    select id into v_mission_id
    from missions
    where mission_pack_id = v_mission_pack_id
      and force_disposition_id = v_p1.force_disposition_id
      and opponent_force_disposition_id = v_p2.force_disposition_id
    limit 1;

    if v_mission_id is not null then
      update game_players set mission_id = v_mission_id where id = v_p1.id and mission_id is null;
    end if;
  end if;

  if v_p2.mission_id is null then
    select id into v_mission_id
    from missions
    where mission_pack_id = v_mission_pack_id
      and force_disposition_id = v_p2.force_disposition_id
      and opponent_force_disposition_id = v_p1.force_disposition_id
    limit 1;

    if v_mission_id is not null then
      update game_players set mission_id = v_mission_id where id = v_p2.id and mission_id is null;
    end if;
  end if;
end;
$$;

grant execute on function resolve_game_mission(uuid) to authenticated;

alter table secondary_objectives drop column category;

update mission_packs set name = 'Chapter Approved 2026-27'
  where id = '00000000-0000-0000-0000-000000000101';

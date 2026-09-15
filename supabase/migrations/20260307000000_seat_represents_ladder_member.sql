-- Bookkeeping an unclaimed seat's real-world identity, for ladder
-- standings. This app has no separate "solo mode" -- every game works
-- the same way, and the point of an unclaimed second seat has always
-- been that ONE account can bookkeep for both sides of a real two-player
-- game, so the other player never has to sign up at all. That's fine for
-- a one-off game (an army name is enough), but a *ladder* game needs to
-- know which real ladder member the unclaimed seat represents, or that
-- player's wins/losses have nowhere to go in the standings (see
-- 20260306000000_ladders.sql's fetchLadderStandings, which can only
-- aggregate by a stable user id).
--
-- represents_user_id is attribution only -- it grants no access. Unlike
-- game_players.user_id (set only by create_game/join_game_by_code, and
-- meaning "this account can edit this seat"), represents_user_id can be
-- set by any participant on an unclaimed seat the same way army_name or
-- faction_id already can, and never changes who can read or write the
-- row. If that player later actually joins with the code themselves,
-- join_game_by_code clears it -- the real account claiming the seat
-- supersedes a bookkeeper's guess at who it was.
alter table game_players add column represents_user_id uuid references profiles(id) on delete set null;

alter table game_players
  add constraint game_players_represents_requires_unclaimed
  check (represents_user_id is null or user_id is null);

-- Partial unique index (not a full unique constraint) so multiple seats
-- with represents_user_id null -- the common case -- are never treated
-- as duplicates; Postgres never treats two NULLs as equal.
create unique index game_players_game_id_represents_user_id_idx
  on game_players(game_id, represents_user_id)
  where represents_user_id is not null;

grant update (represents_user_id) on game_players to authenticated;

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
    -- represents_user_id is cleared unconditionally -- whoever this
    -- seat was attributed to, the account here now is the ground truth.
    update game_players
    set user_id = auth.uid(),
        force_disposition_id = coalesce(p_force_disposition_id, force_disposition_id),
        faction_id = coalesce(p_faction_id, faction_id),
        army_name = coalesce(p_army_name, army_name),
        represents_user_id = null
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

grant execute on function join_game_by_code(text, uuid, uuid, text) to authenticated;

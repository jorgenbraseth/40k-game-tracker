-- Replaces "verify, then lock" (20260315000000_seat_verification.sql, 20260402000000_verified_game_lock.sql)
-- with "trusted unless contested".
--
-- Why: verification was opt-in, people forgot to do it, and every unverified game rendered as
-- "Unverified -- awaiting X's confirmation", so the normal case (an honest result nobody got
-- round to confirming) looked suspicious. The new model flips the default: a recorded result
-- counts as-is. If a player holding a seat in a ladder game thinks the result is wrong, they
-- *contest* it (any time, with a reason). Contests are shown to that ladder's admin (its creator,
-- the same authority archive/delete/invite-code regeneration already use), who either dismisses
-- the contest or *invalidates* the game for that ladder, with a comment explaining why. An
-- invalidated game stays in everyone's history -- it just stops counting toward that ladder's
-- standings.
--
-- Everything here is additive, per CLAUDE.md's native-app compatibility rule: the verification
-- table, the unlock-request table and their RPCs all stay in place (an older build calling
-- them still gets a valid response), they simply stop mattering. The one behavioral change to
-- existing objects is is_game_fully_verified() below, re-declared (same name, same signature, no
-- drop) to always return false -- that single change lifts the lock from every write policy that
-- references it, without having to re-declare all of those policies. Dropping the verification
-- and unlock-request tables/functions outright is the later "contract" step, once no released
-- native build still reads them.

create or replace function is_game_fully_verified(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Games no longer lock (see this migration's header). Kept, rather than dropped, because
  -- every result-editing RLS policy from 20260402000000_verified_game_lock.sql still calls it.
  select false
$$;

-- True when the caller holds a seat in this game: their own claimed seat (user_id), or an
-- unclaimed seat a bookkeeper attributed to them (represents_user_id). Wider than
-- is_game_participant(), which only counts claimed seats -- the represented player of a
-- solo-entered game is exactly the person most likely to need to contest it.
create function is_game_seat_holder(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_players
    where game_id = p_game_id and (user_id = auth.uid() or represents_user_id = auth.uid())
  )
$$;

grant execute on function is_game_seat_holder(uuid) to authenticated;

create function is_ladder_admin(p_ladder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from ladders where id = p_ladder_id and created_by = auth.uid())
$$;

grant execute on function is_ladder_admin(uuid) to authenticated;

-- One row per (game, ladder) a player contested. Per ladder rather than per game because a game
-- can be tagged to several ladders (issue #75), each with its own admin, and each admin decides
-- for their own ladder only.
create table game_contests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  ladder_id uuid not null references ladders(id) on delete cascade,
  contested_by uuid not null references profiles(id),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'withdrawn', 'upheld')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  resolution_note text check (resolution_note is null or length(resolution_note) <= 1000)
);

-- One open contest per game per ladder -- if the opponent also thinks it's wrong, the existing
-- contest already has the admin's attention.
create unique index game_contests_one_pending_per_game_ladder
  on game_contests(game_id, ladder_id) where status = 'pending';

create index game_contests_game_id_idx on game_contests(game_id);
create index game_contests_ladder_id_idx on game_contests(ladder_id);

alter table game_contests enable row level security;

-- The game's own players (both sides, so the opponent can see their result is being questioned)
-- and the admin of the ladder the contest is about. Not public: a contest is an open question,
-- not a verdict. Writes only via the security-definer RPCs below.
create policy "seat holders and the ladder admin can read contests" on game_contests
  for select to authenticated using (is_game_seat_holder(game_id) or is_ladder_admin(ladder_id));

grant select on game_contests to authenticated;

-- A game an admin has removed from their ladder. Its own table rather than columns on
-- game_ladders: set_game_ladders() replaces a game's whole tag set by delete-then-insert, which
-- would silently wipe an invalidation stored on the tag row (and let a participant clear one by
-- untagging and re-tagging the game).
create table ladder_game_invalidations (
  game_id uuid not null references games(id) on delete cascade,
  ladder_id uuid not null references ladders(id) on delete cascade,
  invalidated_by uuid not null references profiles(id),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  invalidated_at timestamptz not null default now(),
  primary key (game_id, ladder_id)
);

create index ladder_game_invalidations_ladder_id_idx on ladder_game_invalidations(ladder_id);

alter table ladder_game_invalidations enable row level security;

-- Same openness as game_ladders itself: standings are browsable by any signed-in user, so which
-- games were excluded from them (and why) is too.
create policy "ladder game invalidations are readable by any signed-in user" on ladder_game_invalidations
  for select to authenticated using (true);

grant select on ladder_game_invalidations to authenticated;

-- Contest a game on every ladder it's tagged to that hasn't already invalidated it or got an
-- open contest about it. Allowed at any point in the game's life -- there's no "too late".
create function contest_game(p_game_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
begin
  if not is_game_seat_holder(p_game_id) then
    raise exception 'only a player in this game can contest it';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'say why you are contesting this game';
  end if;
  if not exists (select 1 from game_ladders where game_id = p_game_id) then
    raise exception 'only ladder games can be contested';
  end if;

  insert into game_contests (game_id, ladder_id, contested_by, reason)
  select gl.game_id, gl.ladder_id, auth.uid(), btrim(p_reason)
  from game_ladders gl
  where gl.game_id = p_game_id
    and not exists (
      select 1 from ladder_game_invalidations i where i.game_id = gl.game_id and i.ladder_id = gl.ladder_id
    )
    and not exists (
      select 1 from game_contests c
      where c.game_id = gl.game_id and c.ladder_id = gl.ladder_id and c.status = 'pending'
    );

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'this game is already contested or invalidated on every ladder it is on';
  end if;
end;
$$;

grant execute on function contest_game(uuid, text) to authenticated;

-- The contester changed their mind -- withdraws every open contest they raised on this game.
create function withdraw_game_contest(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update game_contests
  set status = 'withdrawn', resolved_by = auth.uid(), resolved_at = now()
  where game_id = p_game_id and contested_by = auth.uid() and status = 'pending';

  if not found then
    raise exception 'you have no open contest on this game';
  end if;
end;
$$;

grant execute on function withdraw_game_contest(uuid) to authenticated;

-- The ladder admin looked at it and the result stands.
create function dismiss_game_contest(p_contest_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ladder_id uuid;
  v_status text;
begin
  select ladder_id, status into v_ladder_id, v_status from game_contests where id = p_contest_id;

  if v_ladder_id is null then
    raise exception 'contest not found';
  end if;
  if not is_ladder_admin(v_ladder_id) then
    raise exception 'only the ladder admin can dismiss a contest';
  end if;
  if v_status <> 'pending' then
    raise exception 'this contest has already been resolved';
  end if;

  update game_contests
  set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now(),
      resolution_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_contest_id;
end;
$$;

grant execute on function dismiss_game_contest(uuid, text) to authenticated;

-- Removes the game from this ladder's standings, with the admin's reason, and closes any open
-- contest about it on this ladder as upheld. Keyed on (game, ladder) rather than a contest id so
-- it doesn't depend on a contest existing, though the UI only offers it from one.
create function invalidate_ladder_game(p_game_id uuid, p_ladder_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_ladder_admin(p_ladder_id) then
    raise exception 'only the ladder admin can invalidate a game';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'say why this game is being invalidated';
  end if;
  -- A contest can outlive the game's tag (a player may untag the game after it was contested), so
  -- a contest on this ladder is enough -- the invalidation then also keeps the game out if it's
  -- ever re-tagged.
  if not exists (select 1 from game_ladders where game_id = p_game_id and ladder_id = p_ladder_id)
    and not exists (select 1 from game_contests where game_id = p_game_id and ladder_id = p_ladder_id)
  then
    raise exception 'this game is not on that ladder';
  end if;
  if exists (select 1 from ladder_game_invalidations where game_id = p_game_id and ladder_id = p_ladder_id) then
    raise exception 'this game is already invalidated on that ladder';
  end if;

  insert into ladder_game_invalidations (game_id, ladder_id, invalidated_by, reason)
  values (p_game_id, p_ladder_id, auth.uid(), btrim(p_reason));

  update game_contests
  set status = 'upheld', resolved_by = auth.uid(), resolved_at = now(), resolution_note = btrim(p_reason)
  where game_id = p_game_id and ladder_id = p_ladder_id and status = 'pending';
end;
$$;

grant execute on function invalidate_ladder_game(uuid, uuid, text) to authenticated;

-- Undo an invalidation (a mistake, or the players sorted it out and fixed the score).
create function reinstate_ladder_game(p_game_id uuid, p_ladder_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_ladder_admin(p_ladder_id) then
    raise exception 'only the ladder admin can reinstate a game';
  end if;

  delete from ladder_game_invalidations where game_id = p_game_id and ladder_id = p_ladder_id;
  if not found then
    raise exception 'this game is not invalidated on that ladder';
  end if;
end;
$$;

grant execute on function reinstate_ladder_game(uuid, uuid) to authenticated;

alter publication supabase_realtime add table game_contests;
alter publication supabase_realtime add table ladder_game_invalidations;

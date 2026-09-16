-- Issue #70: ladders were joinable by anyone who could see them ("ladders are readable by any
-- signed-in user" already means every ladder is browsable) -- there was no way for a ladder's
-- creator to control who's actually allowed in. Adds an invite code, the same style/alphabet as
-- games' own join_code (generate_join_code(), already table-agnostic): joining now requires
-- knowing the code, not just the ladder's name from the browse list.
--
-- Existing membership is grandfathered in untouched -- this only gates *future* joins, so nobody
-- currently in a ladder is affected, and every existing ladder gets a code backfilled below so
-- there's no window where joining is simply broken.
--
-- The code itself is deliberately NOT part of the plain "browse ladders" read path: ladders stay
-- fully browsable by name/member count (unchanged), but invite_code is excluded from the general
-- column grant below and only readable via get_ladder_invite_code(), gated to current members --
-- otherwise every ladder's code would sit right there in the same response the browse list
-- already fetches, and the gate would protect nothing from another signed-in app user.

alter table ladders add column invite_code text unique;

do $$
declare
  v_ladder record;
  v_code text;
  v_done boolean;
begin
  for v_ladder in select id from ladders where invite_code is null loop
    v_done := false;
    while not v_done loop
      v_code := generate_join_code();
      begin
        update ladders set invite_code = v_code where id = v_ladder.id;
        v_done := true;
      exception when unique_violation then
        -- collided with another ladder's code -- loop and try a fresh one
      end;
    end loop;
  end loop;
end $$;

alter table ladders alter column invite_code set not null;

-- Column-scoped grants, same "widening the ROWS must not also widen the COLUMNS" split this
-- codebase already uses for game_players (see 20260215000000_solo_trackable_games.sql) -- the
-- existing row policies (readable by any signed-in user; updatable by the creator) stay as-is,
-- but invite_code itself is carved out of both: reading it goes through get_ladder_invite_code
-- below, and writing it through regenerate_ladder_invite_code, so it's always a properly
-- generated code, never whatever a direct update happened to set it to.
revoke select on ladders from authenticated;
grant select (id, name, created_by, created_at, archived_at) on ladders to authenticated;

revoke update on ladders from authenticated;
grant update (id, name, created_by, created_at, archived_at) on ladders to authenticated;

-- Members can see their own ladder's code, to share it with whoever they want to invite (any
-- member can invite, not just the creator -- same "no single gatekeeper" shape as sharing a
-- game's join code). security definer so it can read the invite_code column the grant above
-- excludes; the membership check is the only thing standing in for that.
create function get_ladder_invite_code(p_ladder_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not exists (
    select 1 from ladder_members where ladder_id = p_ladder_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this ladder';
  end if;

  select invite_code into v_code from ladders where id = p_ladder_id;
  return v_code;
end;
$$;

grant execute on function get_ladder_invite_code(uuid) to authenticated;

-- Regenerating invalidates whatever the old code was (anyone still holding it can no longer join)
-- -- creator-only, same as archiving/deleting the ladder itself.
create function regenerate_ladder_invite_code(p_ladder_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempts int := 0;
  v_done boolean := false;
begin
  if not exists (select 1 from ladders where id = p_ladder_id and created_by = auth.uid()) then
    raise exception 'only the ladder creator can regenerate its invite code';
  end if;

  while not v_done loop
    v_code := generate_join_code();
    begin
      update ladders set invite_code = v_code where id = p_ladder_id;
      v_done := true;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique invite code, try again';
      end if;
    end;
  end loop;

  return v_code;
end;
$$;

grant execute on function regenerate_ladder_invite_code(uuid) to authenticated;

-- create_ladder now also mints the creator's own invite code atomically at creation, same
-- retry-on-collision loop create_game already uses for its own join_code.
drop function if exists create_ladder(text);

create function create_ladder(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ladder_id uuid;
  v_name text := trim(p_name);
  v_code text;
  v_attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_name = '' then
    raise exception 'ladder name required';
  end if;

  loop
    v_code := generate_join_code();
    begin
      insert into ladders (name, created_by, invite_code) values (v_name, auth.uid(), v_code)
      returning id into v_ladder_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique invite code, try again';
      end if;
    end;
  end loop;

  insert into ladder_members (ladder_id, user_id) values (v_ladder_id, auth.uid());

  return v_ladder_id;
end;
$$;

grant execute on function create_ladder(text) to authenticated;

-- Joining is now exclusively through this RPC (checks the code server-side, security definer so
-- it can insert into ladder_members regardless), not a direct client insert -- the old
-- self-service insert policy is dropped below so that path can't bypass the code check.
create function join_ladder_by_code(p_ladder_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select invite_code into v_invite_code from ladders where id = p_ladder_id;
  if v_invite_code is null then
    raise exception 'ladder not found';
  end if;
  if v_invite_code is distinct from upper(trim(p_code)) then
    raise exception 'wrong invite code';
  end if;

  insert into ladder_members (ladder_id, user_id) values (p_ladder_id, auth.uid())
  on conflict (ladder_id, user_id) do nothing;
end;
$$;

grant execute on function join_ladder_by_code(uuid, text) to authenticated;

drop policy "users can join a ladder themselves" on ladder_members;
revoke insert on ladder_members from authenticated;

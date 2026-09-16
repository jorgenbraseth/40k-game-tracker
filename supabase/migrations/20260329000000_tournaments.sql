-- Issue #74: tournaments -- a bounded grouping of games (e.g. one weekend), distinct from a
-- ladder's open-ended ongoing history. Modeled like ladders (same browsable/invite-code-gated
-- shape) with two differences: an optional start/end date pair (purely descriptive, shown on the
-- card, never enforced against when a game can be tagged -- same "bookkeeping tool, not guided
-- workflow" philosophy as everything else here), and standings are a simple W/D/L + VP-diff tally,
-- not a rating -- a one-off event has no ongoing skill to track between events, so Elo/Glicko-2
-- (see ladders' own ranking_type) doesn't apply.
--
-- Also completes issue #75: a game can now be tagged to any combination of ladders *and*
-- tournaments at once via game_ladders/game_tournaments (both game_id/grouping_id join tables),
-- not just one grouping total. games.ladder_id (added 20260306000000_ladders.sql) and the
-- single-tag shape it implied are retired here -- the "contract" half of the expand/contract
-- migration 20260328000000_game_ladders.sql started, now that the real multi-tag UI ships
-- alongside tournaments in the same release.

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  invite_code text not null unique,
  starts_on date,
  ends_on date
);

create table tournament_members (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create index tournament_members_tournament_id_idx on tournament_members(tournament_id);
create index tournament_members_user_id_idx on tournament_members(user_id);

create table game_tournaments (
  game_id uuid not null references games(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, tournament_id)
);

create index game_tournaments_tournament_id_idx on game_tournaments(tournament_id);

alter table tournaments enable row level security;
alter table tournament_members enable row level security;
alter table game_tournaments enable row level security;

create policy "tournaments are readable by any signed-in user" on tournaments
  for select to authenticated using (true);

create policy "the creator can update their own tournament" on tournaments
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "the creator can delete their own tournament" on tournaments
  for delete to authenticated using (created_by = auth.uid());

create policy "tournament membership is readable by any signed-in user" on tournament_members
  for select to authenticated using (true);

create policy "users can leave a tournament themselves" on tournament_members
  for delete to authenticated using (user_id = auth.uid());

create policy "game_tournaments are readable by any signed-in user" on game_tournaments
  for select to authenticated using (true);

-- invite_code carved out of the general select/update grant, same as ladders
-- (20260325000000_ladder_invite_codes.sql) -- browsable by name/dates/member count, but the code
-- itself only through get_tournament_invite_code below.
grant select (id, name, created_by, created_at, archived_at, starts_on, ends_on) on tournaments to authenticated;
grant update (id, name, created_by, created_at, archived_at, starts_on, ends_on) on tournaments to authenticated;
grant delete on tournaments to authenticated;
grant select, delete on tournament_members to authenticated;
grant select on game_tournaments to authenticated;
-- No insert grant on tournament_members (joining is invite-code gated, via join_tournament_by_code
-- only) and no insert/update/delete grant at all on game_tournaments (every write goes through
-- set_game_tournaments/create_game below) -- same shape as ladder_members/game_ladders.

create function create_tournament(p_name text, p_starts_on date default null, p_ends_on date default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_name text := trim(p_name);
  v_code text;
  v_attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_name = '' then
    raise exception 'tournament name required';
  end if;

  loop
    v_code := generate_join_code();
    begin
      insert into tournaments (name, created_by, invite_code, starts_on, ends_on)
      values (v_name, auth.uid(), v_code, p_starts_on, p_ends_on)
      returning id into v_tournament_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique invite code, try again';
      end if;
    end;
  end loop;

  insert into tournament_members (tournament_id, user_id) values (v_tournament_id, auth.uid());

  return v_tournament_id;
end;
$$;

grant execute on function create_tournament(text, date, date) to authenticated;

create function get_tournament_invite_code(p_tournament_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not exists (
    select 1 from tournament_members where tournament_id = p_tournament_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this tournament';
  end if;

  select invite_code into v_code from tournaments where id = p_tournament_id;
  return v_code;
end;
$$;

grant execute on function get_tournament_invite_code(uuid) to authenticated;

create function regenerate_tournament_invite_code(p_tournament_id uuid)
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
  if not exists (select 1 from tournaments where id = p_tournament_id and created_by = auth.uid()) then
    raise exception 'only the tournament creator can regenerate its invite code';
  end if;

  while not v_done loop
    v_code := generate_join_code();
    begin
      update tournaments set invite_code = v_code where id = p_tournament_id;
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

grant execute on function regenerate_tournament_invite_code(uuid) to authenticated;

create function join_tournament_by_code(p_tournament_id uuid, p_code text)
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

  select invite_code into v_invite_code from tournaments where id = p_tournament_id;
  if v_invite_code is null then
    raise exception 'tournament not found';
  end if;
  if v_invite_code is distinct from upper(trim(p_code)) then
    raise exception 'wrong invite code';
  end if;

  insert into tournament_members (tournament_id, user_id) values (p_tournament_id, auth.uid())
  on conflict (tournament_id, user_id) do nothing;
end;
$$;

grant execute on function join_tournament_by_code(uuid, text) to authenticated;

-- Replaces 20260328000000_game_ladders.sql's singular set_game_ladder now that the UI can tag more
-- than one ladder at once -- same membership check, just against an array. set_game_tournaments is
-- its exact mirror for tournaments.
drop function if exists set_game_ladder(uuid, uuid);

create function set_game_ladders(p_game_id uuid, p_ladder_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  if exists (
    select 1 from unnest(p_ladder_ids) as lid
    where not exists (
      select 1 from ladder_members lm join ladders l on l.id = lm.ladder_id
      where lm.ladder_id = lid and lm.user_id = auth.uid() and l.archived_at is null
    )
  ) then
    raise exception 'not a member of one of those ladders';
  end if;

  delete from game_ladders where game_id = p_game_id;
  insert into game_ladders (game_id, ladder_id) select p_game_id, lid from unnest(p_ladder_ids) as lid;
end;
$$;

grant execute on function set_game_ladders(uuid, uuid[]) to authenticated;

create function set_game_tournaments(p_game_id uuid, p_tournament_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  if exists (
    select 1 from unnest(p_tournament_ids) as tid
    where not exists (
      select 1 from tournament_members tm join tournaments t on t.id = tm.tournament_id
      where tm.tournament_id = tid and tm.user_id = auth.uid() and t.archived_at is null
    )
  ) then
    raise exception 'not a member of one of those tournaments';
  end if;

  delete from game_tournaments where game_id = p_game_id;
  insert into game_tournaments (game_id, tournament_id) select p_game_id, tid from unnest(p_tournament_ids) as tid;
end;
$$;

grant execute on function set_game_tournaments(uuid, uuid[]) to authenticated;

-- create_game gains array params for both grouping kinds, replacing the old single p_ladder_id.
drop function if exists create_game(int, uuid, uuid, text, uuid);

create function create_game(
  p_points_limit int,
  p_force_disposition_id uuid default null,
  p_faction_id uuid default null,
  p_army_name text default null,
  p_ladder_ids uuid[] default '{}',
  p_tournament_ids uuid[] default '{}'
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

  if exists (
    select 1 from unnest(p_ladder_ids) as lid
    where not exists (
      select 1 from ladder_members lm join ladders l on l.id = lm.ladder_id
      where lm.ladder_id = lid and lm.user_id = auth.uid() and l.archived_at is null
    )
  ) then
    raise exception 'not a member of one of those ladders';
  end if;

  if exists (
    select 1 from unnest(p_tournament_ids) as tid
    where not exists (
      select 1 from tournament_members tm join tournaments t on t.id = tm.tournament_id
      where tm.tournament_id = tid and tm.user_id = auth.uid() and t.archived_at is null
    )
  ) then
    raise exception 'not a member of one of those tournaments';
  end if;

  select id into v_mission_pack_id from mission_packs where is_current = true order by valid_from desc limit 1;
  if v_mission_pack_id is null then
    raise exception 'no current mission pack configured';
  end if;

  loop
    v_code := generate_join_code();
    begin
      insert into games (join_code, status, mission_pack_id, points_limit, created_by)
      values (v_code, 'lobby', v_mission_pack_id, p_points_limit, auth.uid())
      returning id into v_game_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique join code, try again';
      end if;
    end;
  end loop;

  insert into game_ladders (game_id, ladder_id) select v_game_id, lid from unnest(p_ladder_ids) as lid;
  insert into game_tournaments (game_id, tournament_id) select v_game_id, tid from unnest(p_tournament_ids) as tid;

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id)
  values (v_game_id, auth.uid(), 1, p_faction_id, p_army_name, p_force_disposition_id);

  insert into game_players (game_id, user_id, seat)
  values (v_game_id, null, 2);

  return v_game_id;
end;
$$;

grant execute on function create_game(int, uuid, uuid, text, uuid[], uuid[]) to authenticated;

-- Visibility: any signed-in user can read a game tagged to *any* ladder or tournament (same
-- openness ladder-tagged games already had, see 20260310000000_ladder_game_visibility.sql, just
-- extended to either grouping kind now that there are two).
drop policy "ladder-tagged games are readable by any signed-in user" on games;
drop policy "ladder-tagged games' game_players are readable by any signed-in user" on game_players;
drop policy "ladder-tagged games' round_scores are readable by any signed-in user" on round_scores;
drop policy "ladder-tagged games' secondary_scores are readable by any signed-in user" on secondary_scores;

create policy "grouping-tagged games are readable by any signed-in user" on games
  for select to authenticated using (
    exists (select 1 from game_ladders where game_ladders.game_id = games.id)
    or exists (select 1 from game_tournaments where game_tournaments.game_id = games.id)
  );

create policy "grouping-tagged games' game_players are readable by any signed-in user" on game_players
  for select to authenticated using (
    exists (select 1 from game_ladders where game_ladders.game_id = game_players.game_id)
    or exists (select 1 from game_tournaments where game_tournaments.game_id = game_players.game_id)
  );

create policy "grouping-tagged games' round_scores are readable by any signed-in user" on round_scores
  for select to authenticated using (
    exists (select 1 from game_ladders where game_ladders.game_id = round_scores.game_id)
    or exists (select 1 from game_tournaments where game_tournaments.game_id = round_scores.game_id)
  );

create policy "grouping-tagged games' secondary_scores are readable by any signed-in user" on secondary_scores
  for select to authenticated using (
    exists (select 1 from game_ladders where game_ladders.game_id = secondary_scores.game_id)
    or exists (select 1 from game_tournaments where game_tournaments.game_id = secondary_scores.game_id)
  );

-- The "contract" step: nothing reads or writes games.ladder_id any more (game_ladders has been the
-- synced source of truth since 20260328000000_game_ladders.sql, and every remaining read site is
-- updated in this same release to query game_ladders/game_tournaments directly).
alter table games drop column ladder_id;

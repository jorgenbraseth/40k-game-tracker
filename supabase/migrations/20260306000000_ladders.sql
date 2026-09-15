-- Ladders (issue #18): named groups of players, optionally tagged onto a
-- game at creation time, so history/standings can be filtered/grouped by
-- ladder. Deliberately simple for now:
--
-- - No invite codes -- ladders are browsable by any signed-in user (the
--   "see both your own and others'" requirement), and joining is just a
--   self-service row insert, same as leaving.
-- - No ranking algorithm baked into the schema. Standings are computed
--   live from `games`/`game_totals` on read (see src/lib/queries/ladders.ts),
--   never stored -- so an edited or cancelled game (games rows are
--   actually deleted on cancel, see 20260225000000_cancel_game.sql) is
--   correct again the moment it's queried, with no recalculation step
--   required. This sidesteps the path-dependence problem that a
--   sequential rating (ELO/Glicko) would have; see the issue for the
--   fuller writeup if a fancier rating is picked later.

create table ladders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table ladder_members (
  id uuid primary key default gen_random_uuid(),
  ladder_id uuid not null references ladders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (ladder_id, user_id)
);

create index ladder_members_ladder_id_idx on ladder_members(ladder_id);
create index ladder_members_user_id_idx on ladder_members(user_id);

-- Optional per-game tag, set at creation (create_game below) but -- like
-- every other field on a game -- stays editable afterwards via the
-- existing "participants can update their games" policy; on delete set
-- null rather than cascade, so a ladder going away never takes a game's
-- history with it.
alter table games add column ladder_id uuid references ladders(id) on delete set null;
create index games_ladder_id_idx on games(ladder_id);

alter table ladders enable row level security;
alter table ladder_members enable row level security;

create policy "ladders are readable by any signed-in user" on ladders
  for select to authenticated using (true);

create policy "authenticated users can create ladders" on ladders
  for insert to authenticated with check (created_by = auth.uid());

create policy "ladder membership is readable by any signed-in user" on ladder_members
  for select to authenticated using (true);

create policy "users can join a ladder themselves" on ladder_members
  for insert to authenticated with check (user_id = auth.uid());

create policy "users can leave a ladder themselves" on ladder_members
  for delete to authenticated using (user_id = auth.uid());

grant select, insert on ladders to authenticated;
grant select, insert, delete on ladder_members to authenticated;

-- Creates a ladder and seats its creator as the first member, atomically
-- (so a ladder never briefly exists with zero members).
create function create_ladder(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ladder_id uuid;
  v_name text := trim(p_name);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_name = '' then
    raise exception 'ladder name required';
  end if;

  insert into ladders (name, created_by) values (v_name, auth.uid())
  returning id into v_ladder_id;

  insert into ladder_members (ladder_id, user_id) values (v_ladder_id, auth.uid());

  return v_ladder_id;
end;
$$;

grant execute on function create_ladder(text) to authenticated;

-- create_game gains an optional p_ladder_id: if given, the caller must
-- already be a member (you can only tag a game onto a ladder you're
-- actually in), enforced server-side since ladder_id isn't otherwise
-- column-restricted on games.
drop function if exists create_game(uuid, int, uuid, uuid, text);

create function create_game(
  p_deployment_id uuid,
  p_points_limit int,
  p_force_disposition_id uuid default null,
  p_faction_id uuid default null,
  p_army_name text default null,
  p_ladder_id uuid default null
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

  if p_ladder_id is not null and not exists (
    select 1 from ladder_members where ladder_id = p_ladder_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of that ladder';
  end if;

  select id into v_mission_pack_id from mission_packs where is_current = true order by valid_from desc limit 1;
  if v_mission_pack_id is null then
    raise exception 'no current mission pack configured';
  end if;

  loop
    v_code := generate_join_code();
    begin
      insert into games (join_code, status, mission_pack_id, deployment_id, points_limit, created_by, ladder_id)
      values (v_code, 'lobby', v_mission_pack_id, p_deployment_id, p_points_limit, auth.uid(), p_ladder_id)
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

  insert into game_players (game_id, user_id, seat)
  values (v_game_id, null, 2);

  return v_game_id;
end;
$$;

grant execute on function create_game(uuid, int, uuid, uuid, text, uuid) to authenticated;

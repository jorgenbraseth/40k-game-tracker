-- Issue #75: a game currently belongs to at most one ladder (games.ladder_id, a single nullable
-- column) -- if two players share more than one ladder together, or are also playing a tournament
-- (#74) at the same time, one game can only ever feed one grouping's standings. Fixes that at the
-- schema level with a many-to-many join table.
--
-- This migration is deliberately the "expand" half of an expand/contract change (see
-- 40k-tracker-plan.md's migration conventions): it introduces game_ladders and keeps it in sync,
-- but every *existing* read path (fetchGameDetail, fetchLadderStandings, fetchLadderGames,
-- fetchCompletedGames) keeps reading games.ladder_id exactly as before -- so this migration alone
-- changes no visible behavior, a game still has at most one ladder tag from the UI's point of
-- view. The actual multi-tag UI (and the tournaments feature that needs the same join-table shape,
-- #74) lands in a follow-up change, which is also when reads cut over to game_ladders and
-- games.ladder_id's own write path finally gets dropped (the "contract" half).
create table game_ladders (
  game_id uuid not null references games(id) on delete cascade,
  ladder_id uuid not null references ladders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, ladder_id)
);

create index game_ladders_ladder_id_idx on game_ladders(ladder_id);

insert into game_ladders (game_id, ladder_id)
select id, ladder_id from games where ladder_id is not null;

alter table game_ladders enable row level security;

-- Same openness as ladders/ladder_members themselves ("browsable by any signed-in user") -- no
-- insert/update/delete grant at all, since the only writers are the security-definer functions
-- below, which bypass grants entirely.
create policy "game_ladders are readable by any signed-in user" on game_ladders
  for select to authenticated using (true);

grant select on game_ladders to authenticated;

-- Replaces the plain `update games set ladder_id = ...` useSetLadder used to do directly (that
-- policy path stays revoked below): keeps games.ladder_id and game_ladders in sync atomically, and
-- -- unlike the old direct update, which only the UI's own filtered options prevented from tagging
-- a non-member ladder -- actually enforces the same membership check create_game already does at
-- creation time, server-side, for a correction made later too.
create function set_game_ladder(p_game_id uuid, p_ladder_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;

  if p_ladder_id is not null and not exists (
    select 1 from ladder_members lm
    join ladders l on l.id = lm.ladder_id
    where lm.ladder_id = p_ladder_id and lm.user_id = auth.uid() and l.archived_at is null
  ) then
    raise exception 'not a member of that ladder';
  end if;

  update games set ladder_id = p_ladder_id where id = p_game_id;

  delete from game_ladders where game_id = p_game_id;
  if p_ladder_id is not null then
    insert into game_ladders (game_id, ladder_id) values (p_game_id, p_ladder_id);
  end if;
end;
$$;

grant execute on function set_game_ladder(uuid, uuid) to authenticated;

-- Direct client writes to ladder_id are no longer needed (set_game_ladder above is the only path
-- now, from GameConfigPicker), same "revoke the column once an RPC becomes the sole path" pattern
-- 20260324000000_shared_role_and_turn_order.sql used for role/turn_order.
revoke update (ladder_id) on games from authenticated;

-- create_game's own p_ladder_id path (its membership check is already identical to the one above)
-- needs the same game_ladders insert, so a ladder tagged at creation time -- not just one changed
-- later via set_game_ladder -- is reflected in both places too.
drop function if exists create_game(int, uuid, uuid, text, uuid);

create function create_game(
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
    select 1 from ladder_members lm
    join ladders l on l.id = lm.ladder_id
    where lm.ladder_id = p_ladder_id and lm.user_id = auth.uid() and l.archived_at is null
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
      insert into games (join_code, status, mission_pack_id, points_limit, created_by, ladder_id)
      values (v_code, 'lobby', v_mission_pack_id, p_points_limit, auth.uid(), p_ladder_id)
      returning id into v_game_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'could not generate a unique join code, try again';
      end if;
    end;
  end loop;

  if p_ladder_id is not null then
    insert into game_ladders (game_id, ladder_id) values (v_game_id, p_ladder_id);
  end if;

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id)
  values (v_game_id, auth.uid(), 1, p_faction_id, p_army_name, p_force_disposition_id);

  insert into game_players (game_id, user_id, seat)
  values (v_game_id, null, 2);

  return v_game_id;
end;
$$;

grant execute on function create_game(int, uuid, uuid, text, uuid) to authenticated;

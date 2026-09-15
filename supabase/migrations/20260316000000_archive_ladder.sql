-- Lets a ladder's creator archive it: a friend group's ladder that's run its course (season
-- over, group disbanded) shouldn't keep cluttering "Ladders" or the "tag this game to a ladder"
-- picker forever, but its history -- standings, game log, every game's own ladder_name in
-- History/StatsPage -- has to keep working exactly as before, since none of that reads whether a
-- ladder is archived. So this is purely a visibility flag on the ladder itself, not a cascade:
-- archived_at null means active, set means archived, and unarchiving is just clearing it back to
-- null again -- fully reversible, no data ever deleted or hidden, same as everything else in this
-- app that's "always editable" rather than a one-way workflow step.
alter table ladders add column archived_at timestamptz;

-- No update policy existed on ladders before this -- name/created_by were only ever set once, at
-- creation, via create_ladder. Scoped to the creator only, and left general (not column-restricted
-- to archived_at) on purpose: this repo doesn't add narrower-than-ownership write policies without
-- a reason to (see game_player_verifications' own comment for the one place that reasoning cuts
-- the other way, because *someone else* already had a broader grant on the same row).
create policy "the creator can update their own ladder" on ladders
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

grant update on ladders to authenticated;

-- create_game already rejects tagging a game to a ladder the caller isn't a member of -- extend
-- the same server-side check to also reject an archived one, so the client-side filtering that
-- drops archived ladders from the "tag this game" picker can't be bypassed by calling the RPC
-- directly with a stale id.
drop function if exists create_game(uuid, int, uuid, uuid, text, uuid);

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

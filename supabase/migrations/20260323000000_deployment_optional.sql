-- The "which deployment?" question asked at game creation (NewGamePage) turned out to be
-- unnecessary: the 3 terrain layout alternatives (LayoutVariantPicker, picked later once the
-- Force Disposition pairing is known) are keyed by that pairing, not by deployment
-- (20260305000000_deployment_and_layout_images.sql's own comment already says so), and each
-- layout's own image already shows the deployment's battlefield shape underneath the terrain --
-- SummaryPage stopped showing a separate deployment card for exactly this reason. So picking a
-- deployment up front, before either player has even chosen a Force Disposition, was asking for
-- a fact the layout choice already fully covers -- never actually a free, independent choice.
--
-- deployment_id stays on games (nullable now) rather than being dropped outright: existing games
-- keep pointing at whichever deployment they were created with, same "never touch old history"
-- rule this app applies to every other schema change. New games just don't set it.
alter table games alter column deployment_id drop not null;

drop function if exists create_game(uuid, int, uuid, uuid, text, uuid);

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

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id)
  values (v_game_id, auth.uid(), 1, p_faction_id, p_army_name, p_force_disposition_id);

  insert into game_players (game_id, user_id, seat)
  values (v_game_id, null, 2);

  return v_game_id;
end;
$$;

grant execute on function create_game(int, uuid, uuid, text, uuid) to authenticated;

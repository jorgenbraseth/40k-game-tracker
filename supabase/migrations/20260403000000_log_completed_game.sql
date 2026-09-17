-- Feature request: let someone register a game that already happened, entirely after the fact --
-- both players, their factions/Force Dispositions, and just the final score per side, no live
-- round-by-round play. Every existing creation path (create_game, join_game_by_code) only ever
-- produces a 'lobby' game that has to be played through Scoreboard round by round to reach
-- 'complete' -- there was no shortcut straight to a finished result.
--
-- Nothing about how a finished game is *read* needs to change for this: stats (computeStats),
-- ladder standings, and Elo/Glicko-2 only ever consume games.outcome + game_totals.total_vp +
-- game_players.user_id/represents_user_id/seat -- none of them touch round_scores/secondary_scores
-- directly. But game_totals.total_vp has no direct-write column of its own -- it's always
-- SUM(round_scores.primary_vp) + SUM(secondary_scores.vp_scored) + painted bonus -- so "just enter
-- a final score" has to land as round_scores rows underneath, same as everything else in this
-- schema. round_scores_primary_vp_max (20260312000000) caps each row at 15, so a single number
-- gets split into as many <=15 chunks as it takes (up to the existing 6-round ceiling, 90 total --
-- ample for any real game, and the RPC below rejects anything higher rather than silently
-- truncating it).
alter table games add column is_retroactive boolean not null default false;
comment on column games.is_retroactive is
  'True for a game logged after the fact via log_completed_game() -- never played through '
  'Scoreboard, so its round_scores are a synthetic split of one final number, not a real '
  'round-by-round record. SummaryPage uses this to skip its "round by round" table rather than '
  'render that split misleadingly.';

create function log_completed_game(
  p_points_limit int,
  p_played_at timestamptz,
  p_my_vp int,
  p_opponent_vp int,
  p_my_faction_id uuid default null,
  p_my_force_disposition_id uuid default null,
  p_my_army_name text default null,
  p_opponent_represents_user_id uuid default null,
  p_opponent_faction_id uuid default null,
  p_opponent_force_disposition_id uuid default null,
  p_opponent_army_name text default null,
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
  v_seat1_id uuid;
  v_seat2_id uuid;
  v_outcome text;
  v_attempts int := 0;
  v_remaining int;
  v_round int;
  v_chunk int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_my_vp < 0 or p_my_vp > 90 or p_opponent_vp < 0 or p_opponent_vp > 90 then
    raise exception 'final score must be between 0 and 90';
  end if;

  if p_played_at > now() then
    raise exception 'played-on date cannot be in the future';
  end if;

  -- Same membership checks create_game already makes for these arrays (20260329000000).
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

  -- An opponent attributed to a real ladder member has to actually belong to one of the ladders
  -- this game is tagged to, same as PlayerSetupFields only ever offering that ladder's own
  -- members to pick from client-side -- enforced here too since this RPC is the only write path.
  if p_opponent_represents_user_id is not null and not exists (
    select 1 from unnest(p_ladder_ids) as lid
    join ladder_members lm on lm.ladder_id = lid
    where lm.user_id = p_opponent_represents_user_id
  ) then
    raise exception 'that player is not a member of any of the selected ladders';
  end if;

  select id into v_mission_pack_id from mission_packs where is_current = true order by valid_from desc limit 1;
  if v_mission_pack_id is null then
    raise exception 'no current mission pack configured';
  end if;

  v_outcome := case
    when p_my_vp > p_opponent_vp then 'seat_1'
    when p_opponent_vp > p_my_vp then 'seat_2'
    else 'draw'
  end;

  loop
    v_code := generate_join_code();
    begin
      insert into games (join_code, status, mission_pack_id, points_limit, created_by, outcome, ended_at, is_retroactive)
      values (v_code, 'complete', v_mission_pack_id, p_points_limit, auth.uid(), v_outcome, p_played_at, true)
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
  values (v_game_id, auth.uid(), 1, p_my_faction_id, p_my_army_name, p_my_force_disposition_id)
  returning id into v_seat1_id;

  insert into game_players (game_id, user_id, seat, faction_id, army_name, force_disposition_id, represents_user_id)
  values (v_game_id, null, 2, p_opponent_faction_id, p_opponent_army_name, p_opponent_force_disposition_id, p_opponent_represents_user_id)
  returning id into v_seat2_id;

  -- The whole "final score" lands as round_scores rows, chunked to respect the existing per-row
  -- 15VP cap -- an implementation detail of how game_totals sums up to that number, not a real
  -- round-by-round record (see is_retroactive above).
  v_remaining := p_my_vp;
  v_round := 1;
  while v_remaining > 0 loop
    v_chunk := least(v_remaining, 15);
    insert into round_scores (game_id, game_player_id, battle_round, primary_vp, updated_by)
    values (v_game_id, v_seat1_id, v_round, v_chunk, auth.uid());
    v_remaining := v_remaining - v_chunk;
    v_round := v_round + 1;
  end loop;

  v_remaining := p_opponent_vp;
  v_round := 1;
  while v_remaining > 0 loop
    v_chunk := least(v_remaining, 15);
    insert into round_scores (game_id, game_player_id, battle_round, primary_vp, updated_by)
    values (v_game_id, v_seat2_id, v_round, v_chunk, auth.uid());
    v_remaining := v_remaining - v_chunk;
    v_round := v_round + 1;
  end loop;

  -- The one seat the logger actually is gets auto-verified -- they just typed the result in
  -- themselves, there's no separate "does this look right?" moment to ask them for. The opponent
  -- seat (if attributed to a real ladder member) still goes through the normal solo-entry
  -- confirmation flow -- same reasoning as issue #46 -- and an anonymous, unattributed opponent
  -- seat can never be verified at all, so a game like that never reaches issue #72's lock.
  insert into game_player_verifications (game_player_id, game_id, verified_by)
  values (v_seat1_id, v_game_id, auth.uid());

  return v_game_id;
end;
$$;

grant execute on function log_completed_game(int, timestamptz, int, int, uuid, uuid, text, uuid, uuid, uuid, text, uuid[], uuid[]) to authenticated;

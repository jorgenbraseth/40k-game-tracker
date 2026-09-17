-- Issue #72: once a game's result has been confirmed by both players, neither one should be able
-- to unilaterally change or delete it -- that undermines trust in the recorded result (and any
-- ladder/tournament standings derived from it).
--
-- "Verified by both parties" didn't have a real meaning before this for the common case: two real
-- accounts both holding their own seat. game_player_verifications (20260315000000) only ever let
-- the represented player behind a solo-entered, still-unclaimed seat confirm it -- there was no
-- equivalent "I confirm this result" step for a normal claimed seat. This migration extends the
-- same table/mechanism to cover that case too (a second, narrower INSERT policy, since the
-- existing one is deliberately scoped to the represented-and-unclaimed case and widening it would
-- also have to loosen its represents_user_id/user_id-is-null checks), so "fully verified" can now
-- just mean "every seat -- claimed or represented -- has a matching verification row".
--
-- The lock itself doesn't need a new column or status: it's a *predicate* over rows this app
-- already has (is_game_fully_verified below), applied as an extra AND on every write policy that
-- lets a participant change a finished game's recorded result. A still-in-progress game is never
-- fully verified (verifying is itself gated to complete/abandoned games), so this is a no-op until
-- a game actually finishes and both sides confirm it -- nothing about mid-game editing changes.
--
-- Unlocking is a propose/approve flow, not a diff-level "edit request": a participant requests an
-- unlock (game_unlock_requests), and either the *other* participant or a ladder admin for a ladder
-- this game is tagged to (dispute-resolution override, since two players can otherwise deadlock if
-- one simply refuses to respond) approves it. Approval's only effect is deleting both seats'
-- verification rows -- that's the entire "unlock": it just makes is_game_fully_verified false
-- again, which drops every gated policy back to its normal is_game_participant check, so a
-- participant can then fix whatever needed fixing and the existing Verify flow re-locks it once
-- both sides confirm the correction. No separate "unlocked until when" state to track.

-- A real, claimed seat's own occupant may confirm their own result too, not just a represented
-- seat's real-world player -- same shape as the existing policy, just keyed on user_id instead of
-- represents_user_id.
create policy "a participant may verify their own claimed seat" on game_player_verifications
  for insert to authenticated
  with check (
    verified_by = auth.uid()
    and exists (
      select 1 from game_players gp
      join games g on g.id = gp.game_id
      where gp.id = game_player_verifications.game_player_id
        and gp.game_id = game_player_verifications.game_id
        and gp.user_id = auth.uid()
        and g.status in ('complete', 'abandoned')
    )
  );

-- True once every seat in the game has a matching verification row. A game with no game_players
-- rows (shouldn't happen -- create_game always seats both) is never "fully verified".
create function is_game_fully_verified(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from game_players where game_id = p_game_id)
    and not exists (
      select 1 from game_players gp
      where gp.game_id = p_game_id
        and not exists (
          select 1 from game_player_verifications v where v.game_player_id = gp.id
        )
    )
$$;

grant execute on function is_game_fully_verified(uuid) to authenticated;

-- The creator of any ladder a game is tagged to (game_ladders) may step in as a dispute-resolution
-- override on that game's unlock requests -- same "ladder creator" authority archive/delete-ladder
-- and the invite-code RPCs already use, just scoped through the join table instead of ladders
-- directly.
create function is_ladder_admin_for_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_ladders gl
    join ladders l on l.id = gl.ladder_id
    where gl.game_id = p_game_id and l.created_by = auth.uid()
  )
$$;

grant execute on function is_ladder_admin_for_game(uuid) to authenticated;

create table game_unlock_requests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id)
);

-- At most one open request per game at a time -- a second request while one's already pending
-- would just be noise (approve/reject/cancel the existing one first).
create unique index game_unlock_requests_one_pending_per_game
  on game_unlock_requests(game_id) where status = 'pending';

create index game_unlock_requests_game_id_idx on game_unlock_requests(game_id);

alter table game_unlock_requests enable row level security;

-- Every write goes through the security-definer RPCs below (request/approve/reject/cancel), each
-- of which encodes its own who-may-call-this check -- same reasoning game_player_verifications'
-- own table comment gives for a dedicated table over a column: this way the *only* path to
-- 'approved' is through approve_game_unlock_request, which is also the one place the verification
-- rows actually get cleared, so those two things can never drift apart the way a plain RLS UPDATE
-- policy alongside a separate side-effecting trigger could.
create policy "participants and ladder admins can read unlock requests" on game_unlock_requests
  for select to authenticated using (
    is_game_participant(game_id) or is_ladder_admin_for_game(game_id)
  );

grant select on game_unlock_requests to authenticated;

create function request_game_unlock(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_game_participant(p_game_id) then
    raise exception 'not a participant in this game';
  end if;
  if not is_game_fully_verified(p_game_id) then
    raise exception 'this game is not locked -- nothing to unlock';
  end if;
  if exists (select 1 from game_unlock_requests where game_id = p_game_id and status = 'pending') then
    raise exception 'an unlock request is already pending for this game';
  end if;

  insert into game_unlock_requests (game_id, requested_by)
  values (p_game_id, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function request_game_unlock(uuid) to authenticated;

create function approve_game_unlock_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_requested_by uuid;
  v_status text;
begin
  select game_id, requested_by, status into v_game_id, v_requested_by, v_status
  from game_unlock_requests where id = p_request_id;

  if v_game_id is null then
    raise exception 'unlock request not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'this request has already been resolved';
  end if;
  if not (
    (is_game_participant(v_game_id) and auth.uid() <> v_requested_by)
    or is_ladder_admin_for_game(v_game_id)
  ) then
    raise exception 'only the other player or a ladder admin may approve this request';
  end if;

  update game_unlock_requests
  set status = 'approved', resolved_by = auth.uid(), resolved_at = now()
  where id = p_request_id;

  delete from game_player_verifications where game_id = v_game_id;
end;
$$;

grant execute on function approve_game_unlock_request(uuid) to authenticated;

create function reject_game_unlock_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_requested_by uuid;
  v_status text;
begin
  select game_id, requested_by, status into v_game_id, v_requested_by, v_status
  from game_unlock_requests where id = p_request_id;

  if v_game_id is null then
    raise exception 'unlock request not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'this request has already been resolved';
  end if;
  if not (
    (is_game_participant(v_game_id) and auth.uid() <> v_requested_by)
    or is_ladder_admin_for_game(v_game_id)
  ) then
    raise exception 'only the other player or a ladder admin may reject this request';
  end if;

  update game_unlock_requests
  set status = 'rejected', resolved_by = auth.uid(), resolved_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function reject_game_unlock_request(uuid) to authenticated;

create function cancel_game_unlock_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested_by uuid;
  v_status text;
begin
  select requested_by, status into v_requested_by, v_status
  from game_unlock_requests where id = p_request_id;

  if v_requested_by is null then
    raise exception 'unlock request not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'this request has already been resolved';
  end if;
  if v_requested_by <> auth.uid() then
    raise exception 'only the requester can cancel this request';
  end if;

  update game_unlock_requests set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function cancel_game_unlock_request(uuid) to authenticated;

alter publication supabase_realtime add table game_unlock_requests;

-- The lock itself: re-declare every write policy that lets a participant change a finished game's
-- recorded result with an added "not is_game_fully_verified(...)" -- always true, so a no-op,
-- until both seats are verified. Read/select policies are untouched (a locked game is still fully
-- visible, just not writable).

drop policy "participants can update their games" on games;
create policy "participants can update their games" on games
  for update to authenticated
  using (is_game_participant(id) and not is_game_fully_verified(id))
  with check (is_game_participant(id) and not is_game_fully_verified(id));

drop policy "participants can delete their games" on games;
create policy "participants can delete their games" on games
  for delete to authenticated using (is_game_participant(id) and not is_game_fully_verified(id));

drop policy "players can update their own seat, or claim/fill an unclaimed one" on game_players;
create policy "players can update their own seat, or claim/fill an unclaimed one" on game_players
  for update to authenticated
  using (
    (user_id = auth.uid() or (user_id is null and is_game_participant(game_id)))
    and not is_game_fully_verified(game_id)
  )
  with check (
    (user_id = auth.uid() or (user_id is null and is_game_participant(game_id)))
    and not is_game_fully_verified(game_id)
  );

drop policy "participants can insert round_scores in their games" on round_scores;
create policy "participants can insert round_scores in their games" on round_scores
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can update round_scores in their games" on round_scores;
create policy "participants can update round_scores in their games" on round_scores
  for update to authenticated
  using (is_game_participant(game_id) and not is_game_fully_verified(game_id))
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can insert secondary_scores in their games" on secondary_scores;
create policy "participants can insert secondary_scores in their games" on secondary_scores
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can update secondary_scores in their games" on secondary_scores;
create policy "participants can update secondary_scores in their games" on secondary_scores
  for update to authenticated
  using (is_game_participant(game_id) and not is_game_fully_verified(game_id))
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can delete secondary_scores in their games" on secondary_scores;
create policy "participants can delete secondary_scores in their games" on secondary_scores
  for delete to authenticated
  using (is_game_participant(game_id) and not is_game_fully_verified(game_id));

drop policy "participants can insert primary_objective_ticks in their games" on primary_objective_ticks;
create policy "participants can insert primary_objective_ticks in their games" on primary_objective_ticks
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can update primary_objective_ticks in their games" on primary_objective_ticks;
create policy "participants can update primary_objective_ticks in their games" on primary_objective_ticks
  for update to authenticated
  using (is_game_participant(game_id) and not is_game_fully_verified(game_id))
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can insert secondary_objective_ticks in their games" on secondary_objective_ticks;
create policy "participants can insert secondary_objective_ticks in their games" on secondary_objective_ticks
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can update secondary_objective_ticks in their games" on secondary_objective_ticks;
create policy "participants can update secondary_objective_ticks in their games" on secondary_objective_ticks
  for update to authenticated
  using (is_game_participant(game_id) and not is_game_fully_verified(game_id))
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can insert secondary_draws in their games" on secondary_draws;
create policy "participants can insert secondary_draws in their games" on secondary_draws
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and drawn_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

drop policy "participants can delete secondary_draws in their games" on secondary_draws;
create policy "participants can delete secondary_draws in their games" on secondary_draws
  for delete to authenticated
  using (is_game_participant(game_id) and not is_game_fully_verified(game_id));

drop policy "participants can insert command_points in their games" on command_points;
create policy "participants can insert command_points in their games" on command_points
  for insert to authenticated
  with check (is_game_participant(game_id) and not is_game_fully_verified(game_id) and updated_by = auth.uid());

drop policy "participants can update command_points in their games" on command_points;
create policy "participants can update command_points in their games" on command_points
  for update to authenticated
  using (is_game_participant(game_id) and not is_game_fully_verified(game_id))
  with check (is_game_participant(game_id) and not is_game_fully_verified(game_id) and updated_by = auth.uid());

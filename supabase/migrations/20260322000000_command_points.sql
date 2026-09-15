-- Command Points (CP): gained and spent per seat per battle round, entered manually like every
-- other score in this app -- this is a bookkeeping tool, not a rules engine, so the well-known
-- "+1 CP per round" isn't auto-granted or pre-filled, same reasoning primary/secondary VP are
-- never auto-ticked, just offered as something to record what actually happened. Scoped to real
-- battle rounds only (1-5), not the End of Game pseudo-round (battle_round 6 elsewhere in this
-- schema) -- no CP-related scoring happens there. A player's remaining CP is just
-- sum(cp_gained) - sum(cp_spent) across every round, computed live client-side same as every
-- other running total in this app (game_totals is a stored *view*, not a table, for the same
-- reason -- but CP doesn't feed Elo/standings, so there's no need for a matching SQL view here,
-- the client can just sum the handful of rows itself).
create table command_points (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  game_player_id uuid not null references game_players(id) on delete cascade,
  battle_round int not null check (battle_round between 1 and 5),
  cp_gained int not null default 0 check (cp_gained >= 0),
  cp_spent int not null default 0 check (cp_spent >= 0),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (game_player_id, battle_round)
);

create index command_points_game_id_idx on command_points(game_id);

alter table command_points enable row level security;

-- Readable by any signed-in user, same as every other game table since spectating shipped
-- (20260320000000_spectating.sql) -- a brand new table needs no narrower-then-widen history.
create policy "command_points are readable by any signed-in user" on command_points
  for select to authenticated using (true);

-- Either participant can enter either side's CP -- players agree CP totals verbally at the table
-- same as round/secondary scores, see round_scores' own policy comment for the reasoning.
create policy "participants can insert command_points in their games" on command_points
  for insert to authenticated
  with check (is_game_participant(game_id) and updated_by = auth.uid());

create policy "participants can update command_points in their games" on command_points
  for update to authenticated
  using (is_game_participant(game_id))
  with check (is_game_participant(game_id) and updated_by = auth.uid());

grant select, insert, update on command_points to authenticated;

alter publication supabase_realtime add table command_points;

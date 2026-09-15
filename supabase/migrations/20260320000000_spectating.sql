-- Spectating: any signed-in user can open any game and watch its current state, participant or
-- not -- superseding the two narrower visibility widenings before this (ladder-tagged games,
-- then all *finished* games) rather than replacing them: those stay in place as historical
-- record, this just makes them redundant by widening read access to literally every game,
-- regardless of status or ladder tag. "spectator mode" was explicitly out of scope in this
-- project's original v1 scoping (see 40k-tracker-plan.md section 11 and README.md) -- like
-- ladders before it, that line no longer holds; this is a deliberate scope change, not a bug.
--
-- Write access is untouched: every insert/update policy on every one of these tables is still
-- gated on is_game_participant(game_id) (or the equivalent seat/game_players ownership check), so
-- a spectator can see everything and change nothing -- RLS remains the only security boundary,
-- same as everywhere else in this app.
--
-- Once games itself has no read restriction left, gating child tables on a subquery against games
-- is no longer buying anything -- game_id always refers to a real, now-always-visible row -- so
-- these are flat `using (true)` rather than repeating the exists-against-games pattern the earlier
-- widenings used (that pattern still made sense when games itself was conditionally visible).
create policy "games are readable by any signed-in user" on games
  for select to authenticated using (true);

create policy "game_players are readable by any signed-in user" on game_players
  for select to authenticated using (true);

create policy "round_scores are readable by any signed-in user" on round_scores
  for select to authenticated using (true);

create policy "secondary_scores are readable by any signed-in user" on secondary_scores
  for select to authenticated using (true);

create policy "secondary_draws are readable by any signed-in user" on secondary_draws
  for select to authenticated using (true);

create policy "primary_objective_ticks are readable by any signed-in user" on primary_objective_ticks
  for select to authenticated using (true);

create policy "secondary_objective_ticks are readable by any signed-in user" on secondary_objective_ticks
  for select to authenticated using (true);

-- game_player_verifications needs no policy of its own here -- its existing select policy already
-- rides transparently on game_players' own RLS (see 20260315000000_seat_verification.sql), which
-- just became fully open above.

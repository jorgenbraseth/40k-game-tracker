-- Tactical secondaries can be discarded instead of scored: either because
-- the card isn't achievable (discarded at the end of the turn), or via the
-- once-per-game "New Orders" stratagem (discard one, draw a replacement).
-- A discarded card stays in secondary_draws -- it was drawn, and it must not
-- go back into the deck -- it just stops being scorable. So this is two
-- nullable columns on the existing draw row rather than a new table: null
-- discarded_round means "still active", same as every row written before
-- this existed. Purely additive -- an older client that doesn't know about
-- these columns keeps reading/inserting draws exactly as before.
alter table secondary_draws
  add column discarded_round int check (discarded_round between 1 and 5),
  add column discard_reason text check (discard_reason in ('not_achievable', 'new_orders')),
  add column discarded_by uuid references profiles(id),
  add column discarded_at timestamptz,
  add constraint secondary_draws_discard_consistent
    check ((discarded_round is null) = (discard_reason is null));

-- Discarding (and un-discarding) is an update on the draw row. Same
-- participant + "not locked once fully verified" rule as the insert/delete
-- policies (20260402000000_verified_game_lock.sql).
create policy "participants can update secondary_draws in their games" on secondary_draws
  for update to authenticated
  using (is_game_participant(game_id) and not is_game_fully_verified(game_id))
  with check (
    is_game_participant(game_id)
    and not is_game_fully_verified(game_id)
    and game_player_belongs_to_game(game_player_id, game_id)
    and (discarded_by is null or discarded_by = auth.uid())
  );

grant update on secondary_draws to authenticated;

-- A third discard reason: discarding a Tactical secondary for CP, as
-- distinct from "not achievable" and New Orders. Widens the check on
-- secondary_draws.discard_reason (20261011000000_secondary_discards.sql)
-- -- every value an older client can write is still accepted, so this is
-- additive from a client's point of view. CP itself is still logged by
-- the players under Command Points, not granted here.
alter table secondary_draws drop constraint secondary_draws_discard_reason_check;
alter table secondary_draws add constraint secondary_draws_discard_reason_check
  check (discard_reason in ('not_achievable', 'for_cp', 'new_orders'));

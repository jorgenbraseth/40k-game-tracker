-- Every table so far has been unreachable from the client in production:
-- RLS policies restrict which ROWS a query can see once a statement is
-- already permitted, but Postgres also requires a table-level GRANT
-- before a role may run that statement at all -- and no migration has
-- ever granted anything to `anon` or `authenticated` (Supabase's Table
-- Editor does this automatically; hand-written migrations, as this whole
-- project uses, must do it explicitly). Every request from the deployed
-- app has been failing with "permission denied for table ..." (Postgres
-- error 42501) since the very first deploy -- RLS was never reached.
--
-- Grants below mirror each table's policies in 20260101000004_policies.sql
-- exactly: `to` a role only for the statements that table already has a
-- policy for, in the anon-vs-authenticated split each policy already
-- declares. This makes the policies actually take effect; it does not
-- loosen anything they didn't already intend to allow.

grant usage on schema public to anon, authenticated;

-- Reference data: policies have no `to` clause, i.e. apply to any role
-- (including signed-out visitors previewing the landing/create-game
-- screens), so anon needs read access too.
grant select on
  rulesets,
  mission_packs,
  missions,
  deployments,
  secondary_objectives,
  factions,
  force_dispositions
to anon, authenticated;

-- Everything else is `to authenticated` only in its policies.
grant select, update on profiles to authenticated;
grant select, insert, update on games to authenticated;
grant select, update on game_players to authenticated;
grant select, insert, update on round_scores to authenticated;
grant select, insert, update, delete on secondary_scores to authenticated;
grant select on join_attempts to authenticated;
grant select on game_totals to authenticated;

-- secondary_scores has always allowed client-side delete
-- (useRemoveSecondaryScore in src/lib/queries/games.ts, for un-scoring an
-- objective) but never had an RLS policy permitting it -- with RLS
-- enabled and no matching policy, that statement was denied outright.
-- Matches the existing update policy: either participant may delete
-- either seat's row, same "players agree scores verbally at the table"
-- reasoning as the rest of round_scores/secondary_scores.
create policy "participants can delete secondary_scores in their games" on secondary_scores
  for delete to authenticated
  using (is_game_participant(game_id));

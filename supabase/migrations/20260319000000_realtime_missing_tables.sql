-- secondary_draws (20260309000000_secondary_draws.sql), primary_objective_ticks and
-- secondary_objective_ticks (20260301000000_objective_lines.sql), and
-- game_player_verifications (20260315000000_seat_verification.sql) were each added to the schema
-- after 20260101000005_realtime.sql first set up streaming, and none of them were ever added to
-- the supabase_realtime publication -- so no postgres_changes event for any of them was ever
-- actually reaching a subscribed client, regardless of what the client subscribes to. Drawing a
-- secondary (secondary_draws, with no accompanying round_scores/secondary_scores write) was the
-- one action where this was visibly broken: the other client only ever saw it once some later,
-- unrelated write to an already-streamed table happened to trigger a refetch.
alter publication supabase_realtime add table secondary_draws;
alter publication supabase_realtime add table primary_objective_ticks;
alter publication supabase_realtime add table secondary_objective_ticks;
alter publication supabase_realtime add table game_player_verifications;

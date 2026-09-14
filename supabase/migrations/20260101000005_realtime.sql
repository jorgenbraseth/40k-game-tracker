-- Stream mutable game tables over Supabase Realtime. RLS is enforced on
-- the stream too (enable "Enforce Row Level Security" for Realtime in the
-- dashboard), so a subscriber only ever receives changes they're allowed
-- to select per the policies above.
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_players;
alter publication supabase_realtime add table round_scores;
alter publication supabase_realtime add table secondary_scores;

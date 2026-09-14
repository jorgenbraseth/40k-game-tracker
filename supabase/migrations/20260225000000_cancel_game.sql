-- A player must be able to cancel a game outright -- not just mark it
-- abandoned (which keeps a record in history), but actually remove it
-- from every list it shows up in. game_players/round_scores/
-- secondary_scores already cascade-delete off games (see
-- 20260101000001_game_tables.sql), so deleting the games row is enough;
-- there was just no policy or grant permitting it yet.
create policy "participants can delete their games" on games
  for delete to authenticated using (is_game_participant(id));

grant delete on games to authenticated;

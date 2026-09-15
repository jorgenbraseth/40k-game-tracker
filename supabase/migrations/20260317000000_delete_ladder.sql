-- Lets a ladder's creator permanently delete it, alongside the archive option from
-- 20260316000000_archive_ladder.sql -- archiving hides a ladder that's done but whose history is
-- still worth keeping around; this is for the other case (created by mistake, a duplicate, a test)
-- where the creator wants it gone outright. Every affected row already handles this correctly
-- without any further cleanup here: ladder_members cascades (20260306000000_ladders.sql), and
-- games.ladder_id is `on delete set null` (same migration) so a deleted ladder never takes a
-- game's own history with it -- the game just becomes untagged, same as if it had never been
-- tagged to a ladder at all.
create policy "the creator can delete their own ladder" on ladders
  for delete to authenticated using (created_by = auth.uid());

grant delete on ladders to authenticated;

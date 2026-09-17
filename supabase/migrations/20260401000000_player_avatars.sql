-- Issue #73: lets a player upload their own profile avatar, shown wherever a player is
-- referenced (ladder/tournament standings and game lists, History, a player's own stats page).
-- `profiles.avatar_url` and its own update policy ("users can update their own profile", see
-- 20260101000001_game_tables.sql / 20260101000004_policies.sql) already existed -- Google sign-in
-- was already populating it from the provider's own avatar -- so this migration is *only* the
-- storage side: nowhere for a manually-uploaded image to actually live yet.
--
-- Client-side resizing (src/lib/resizeImage.ts) crops to a small square and compresses before
-- upload, so this bucket-level file_size_limit is a backstop, not the primary control -- same
-- "client does the real work, server caps the worst case" shape as everywhere else size limits
-- matter in this app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 512000, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Public read -- avatars are shown to any signed-in user wherever a player is referenced, same
-- openness as profiles.display_name itself.
create policy "avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

-- Objects are stored at "<user id>/avatar.<ext>" -- (storage.foldername(name))[1] is that leading
-- path segment, so this is the storage-level equivalent of profiles' own "id = auth.uid()" check:
-- a user can only write inside their own folder, never anyone else's.
create policy "users can upload their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can replace their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete their own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

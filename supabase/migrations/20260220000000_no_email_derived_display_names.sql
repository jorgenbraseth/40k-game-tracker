-- Players can already rename themselves any time on the Profile page
-- (profiles.display_name, editable via useUpdateProfile) -- what was
-- missing is that nothing stopped an email-derived name from reaching
-- other players in the first place:
--
-- 1. handle_new_user() fell back to the local part of the user's email
--    address (split_part(new.email, '@', 1)) whenever an email/password
--    signup didn't type in a display name. That's still derived from
--    their email, not a real nickname, and it's exactly what shows up in
--    history/stats/the waiting room to the other player.
-- 2. Realtime presence (fixed in the app, not here -- see GamePage.tsx)
--    was broadcasting the raw email itself to everyone subscribed to a
--    game's channel.
--
-- Neither the reference tables nor RLS change here -- this is a content
-- default plus a one-time backfill for profiles that already got the old
-- email-derived default.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Commander ' || upper(substr(new.id::text, 1, 4))
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Backfill: only touches profiles whose display_name is EXACTLY what the
-- old fallback would have generated from their own email -- i.e. rows
-- that never got a real name typed in, not anyone who happened to pick a
-- nickname resembling their email's local part.
update public.profiles p
set display_name = 'Commander ' || upper(substr(p.id::text, 1, 4))
from auth.users u
where u.id = p.id
  and p.display_name = split_part(u.email, '@', 1);

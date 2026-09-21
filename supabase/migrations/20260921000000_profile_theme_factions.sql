-- Adds 12 faction-specific themes alongside the original 4 generic ones (grimdark/astartes/
-- aeldari/parchment, untouched -- see 20260918000000_profile_theme.sql), one per non-default
-- crest now in profiles_logo_check (20260918080000_profile_logo_chapter_pack.sql,
-- 20260918090000_rename_logo_custodes_to_tau.sql). Same id strings as the matching logo value,
-- and same widen-the-check-constraint shape every logo addition already uses
-- (20260918030000_profile_logo_sororitas.sql and friends) -- theme and logo stay two independent
-- pickers, this just makes it possible to match them.
alter table profiles drop constraint profiles_theme_check;

alter table profiles add constraint profiles_theme_check
  check (theme in (
    'grimdark', 'astartes', 'aeldari', 'parchment',
    'votann', 'tyranid', 'tau', 'orks', 'chaos', 'sororitas', 'greyknights',
    'mechanicus', 'thousandsons', 'darkangels', 'worldeaters', 'spacewolves'
  ));

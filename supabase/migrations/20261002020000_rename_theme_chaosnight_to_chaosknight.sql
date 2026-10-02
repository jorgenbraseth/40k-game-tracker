-- breaking-change-ok: 'chaosnight' was only added by 20261002010000_profile_theme_chaosnight.sql
-- earlier the same day, so no native app build (let alone a signed store release) can have
-- shipped with it -- dropping it from the allowed values breaks nothing installed.
--
-- Renames the 'chaosnight' theme id to 'chaosknight' (the faction is Chaos Knights -- the
-- original name was a typo). Widen to allow both, move any existing rows across, then narrow
-- back to just the new id.
alter table profiles drop constraint profiles_theme_check;
alter table profiles add constraint profiles_theme_check
  check (theme in (
    'grimdark', 'votann', 'tyranid', 'tau', 'orks', 'chaos', 'sororitas', 'greyknights',
    'mechanicus', 'thousandsons', 'darkangels', 'worldeaters', 'spacewolves', 'necrons',
    'chaosnight', 'chaosknight'
  ));

update profiles set theme = 'chaosknight' where theme = 'chaosnight';

alter table profiles drop constraint profiles_theme_check;
alter table profiles add constraint profiles_theme_check
  check (theme in (
    'grimdark', 'votann', 'tyranid', 'tau', 'orks', 'chaos', 'sororitas', 'greyknights',
    'mechanicus', 'thousandsons', 'darkangels', 'worldeaters', 'spacewolves', 'necrons',
    'chaosknight'
  ));

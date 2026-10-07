-- Adds 'necrons' as a fourteenth theme (palette in index.css + crest in theme.ts's THEMES).
-- Widens profiles_theme_check only -- every previously-allowed value stays allowed, so this is
-- purely additive for any already-released client (an older build just never offers the new
-- value. If a user picks it on a newer build, an older one still renders: getTheme falls back to
-- the default crest, and an unknown data-theme matches no index.css block, leaving the base
-- grimdark palette).
alter table profiles drop constraint profiles_theme_check;
alter table profiles add constraint profiles_theme_check
  check (theme in (
    'grimdark', 'votann', 'tyranid', 'tau', 'orks', 'chaos', 'sororitas', 'greyknights',
    'mechanicus', 'thousandsons', 'darkangels', 'worldeaters', 'spacewolves', 'necrons'
  ));

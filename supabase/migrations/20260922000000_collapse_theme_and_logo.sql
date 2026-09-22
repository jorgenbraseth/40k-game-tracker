-- breaking-change-ok: no native app has shipped a real (signed) store release yet -- README's
-- "Publishing a real (signed) Android release" section confirms only a debug-APK CI artifact
-- exists so far (android-apk.yml), which nobody's installed device depends on, so narrowing the
-- theme values and dropping the logo column here is safe.
--
-- Collapses the separate theme (grimdark/astartes/aeldari/parchment + 12 faction themes) and logo
-- (default + 12 faction crests) pickers into one: a single `theme` value now drives both the
-- color palette and the crest together, so "the logo and color scheme are the same choice".
-- 'astartes'/'aeldari'/'parchment' drop (no matching crest -- every theme value from here on
-- names both a palette in index.css and a crest in logo.ts's LOGOS), and 'grimdark' absorbs
-- logo's 'default' crest (same choice now, see theme.ts).
--
-- Existing rows where theme and logo had diverged (a custom crest under a generic/mismatched
-- theme, or vice versa) pick a winner: an explicitly-chosen faction crest wins over a generic
-- theme (astartes/aeldari/parchment collapse to 'grimdark' otherwise, since none of those three
-- has a matching crest to fall back to).
update profiles
set theme = case
  when logo <> 'default' then logo
  when theme in ('astartes', 'aeldari', 'parchment') then 'grimdark'
  else theme
end;

alter table profiles drop constraint profiles_theme_check;
alter table profiles add constraint profiles_theme_check
  check (theme in (
    'grimdark', 'votann', 'tyranid', 'tau', 'orks', 'chaos', 'sororitas', 'greyknights',
    'mechanicus', 'thousandsons', 'darkangels', 'worldeaters', 'spacewolves'
  ));

alter table profiles drop constraint profiles_logo_check;
alter table profiles drop column logo;

-- Light/dark/system preference, independent of which theme -- every theme now ships both a
-- light and dark palette (see index.css), and this picks which one applies. Defaults to
-- 'system' so a new profile follows the device's OS-level preference out of the box.
alter table profiles add column color_mode text not null default 'system'
  check (color_mode in ('light', 'dark', 'system'));

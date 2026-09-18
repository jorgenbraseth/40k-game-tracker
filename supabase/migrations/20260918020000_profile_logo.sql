-- Lets each account pick which crest represents the app for them (issue: logo prominence + choice)
-- -- the original Aquila mark stays the default, alongside five faction-flavored alternatives.
-- Same shape as profiles.theme (20260918000000_profile_theme.sql): a plain checked column, no
-- separate table, since this is a small fixed set of options picked from a profile page.
alter table profiles
  add column logo text not null default 'default'
    check (logo in ('default', 'mechanicus', 'tyranid', 'custodes', 'orks', 'chaos'));

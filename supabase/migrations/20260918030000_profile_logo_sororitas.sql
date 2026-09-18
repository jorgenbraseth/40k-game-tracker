-- Adds the Adepta Sororitas crest as a seventh logo option (see 20260918020000_profile_logo.sql
-- for the original set). Check constraints can't be widened in place, so this drops and recreates
-- profiles_logo_check with 'sororitas' added -- same "drop constraint / add constraint" shape
-- 20260312000000_primary_caps_and_end_of_game.sql already used to loosen a check elsewhere.
alter table profiles drop constraint profiles_logo_check;

alter table profiles add constraint profiles_logo_check
  check (logo in ('default', 'mechanicus', 'tyranid', 'custodes', 'orks', 'chaos', 'sororitas'));

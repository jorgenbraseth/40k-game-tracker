-- Adds Grey Knights as an eighth logo option (see 20260918020000_profile_logo.sql for the
-- original set, 20260918030000_profile_logo_sororitas.sql for the same shape used to add
-- Sororitas). Check constraints can't be widened in place, so this drops and recreates
-- profiles_logo_check with 'greyknights' added.
alter table profiles drop constraint profiles_logo_check;

alter table profiles add constraint profiles_logo_check
  check (logo in ('default', 'votann', 'tyranid', 'custodes', 'orks', 'chaos', 'sororitas', 'greyknights'));

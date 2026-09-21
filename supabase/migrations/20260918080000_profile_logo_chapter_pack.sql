-- Adds Dark Angels, World Eaters, and Space Wolves as three more logo options in one batch (all
-- three landed in the same session, none deployed yet), same widen-the-check-constraint shape as
-- every other logo addition (20260918030000_profile_logo_sororitas.sql,
-- 20260918050000_profile_logo_greyknights.sql, 20260918060000_profile_logo_mechanicus.sql,
-- 20260918070000_profile_logo_thousandsons.sql).
alter table profiles drop constraint profiles_logo_check;

alter table profiles add constraint profiles_logo_check
  check (logo in ('default', 'votann', 'tyranid', 'custodes', 'orks', 'chaos', 'sororitas', 'greyknights', 'mechanicus', 'thousandsons', 'darkangels', 'worldeaters', 'spacewolves'));

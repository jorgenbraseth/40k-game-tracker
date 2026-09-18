-- Adds Thousand Sons as a tenth logo option, same widen-the-check-constraint shape as every
-- other logo addition (20260918030000_profile_logo_sororitas.sql,
-- 20260918050000_profile_logo_greyknights.sql, 20260918060000_profile_logo_mechanicus.sql).
alter table profiles drop constraint profiles_logo_check;

alter table profiles add constraint profiles_logo_check
  check (logo in ('default', 'votann', 'tyranid', 'custodes', 'orks', 'chaos', 'sororitas', 'greyknights', 'mechanicus', 'thousandsons'));

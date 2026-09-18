-- Adds a genuine Adeptus Mechanicus crest as a ninth logo option -- distinct from 'votann'
-- (20260918040000_rename_logo_mechanicus_to_votann.sql), which freed up the "Mechanicus" name
-- after it turned out that artwork was actually Leagues of Votann. Same widen-the-check-constraint
-- shape as every other logo addition (20260918030000_profile_logo_sororitas.sql,
-- 20260918050000_profile_logo_greyknights.sql).
alter table profiles drop constraint profiles_logo_check;

alter table profiles add constraint profiles_logo_check
  check (logo in ('default', 'votann', 'tyranid', 'custodes', 'orks', 'chaos', 'sororitas', 'greyknights', 'mechanicus'));

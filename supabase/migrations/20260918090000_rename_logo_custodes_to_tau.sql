-- The white/red robotic crest was mislabeled 'custodes' -- it's actually T'au Empire iconography
-- (the drone escorts, the ident-circle emblem, the white/red Fire Warrior colors are T'au, not
-- Adeptus Custodes). Renaming the stored value, not just the label, so the id and what it actually
-- shows agree -- same shape as 20260918040000_rename_logo_mechanicus_to_votann.sql, which fixed
-- an identical mislabeling: any profile that already picked it moves with it.
update profiles set logo = 'tau' where logo = 'custodes';

alter table profiles drop constraint profiles_logo_check;

alter table profiles add constraint profiles_logo_check
  check (logo in ('default', 'votann', 'tyranid', 'tau', 'orks', 'chaos', 'sororitas', 'greyknights', 'mechanicus', 'thousandsons', 'darkangels', 'worldeaters', 'spacewolves'));

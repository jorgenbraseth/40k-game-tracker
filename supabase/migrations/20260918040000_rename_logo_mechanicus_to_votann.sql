-- The gold/bronze dwarf-tech crest was mislabeled 'mechanicus' -- it's actually Leagues of Votann
-- (the beard, the ancestor-core-style rig, the ident runes are Votann iconography, not Adeptus
-- Mechanicus). Renaming the stored value, not just the label, so the id and what it actually shows
-- agree -- any profile that already picked it (there's no bulk-migration path otherwise, since
-- this is the value itself, not just display text) moves with it.
update profiles set logo = 'votann' where logo = 'mechanicus';

alter table profiles drop constraint profiles_logo_check;

alter table profiles add constraint profiles_logo_check
  check (logo in ('default', 'votann', 'tyranid', 'custodes', 'orks', 'chaos', 'sororitas'));

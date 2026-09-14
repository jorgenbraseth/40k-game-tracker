-- Reference data seed.
--
-- Deployments and factions below are the real Chapter Approved 2026-27
-- deck / a starter faction list, sourced from the public card text and
-- mission generator at
-- https://wahapedia.ru/wh40k11ed/the-rules/mission-deck-2026-27/. This
-- repo never stores GW's rules text (how each mission is actually scored
-- turn by turn) -- that's their copyrighted material; players read that
-- off their own physical or app copy of the deck. See "Ruleset / mission
-- content" in README.md for how this data is versioned.
--
-- Missions and secondary_objectives are NOT seeded here -- they're
-- applied by migration 20260221000000_apply_real_reference_data.sql
-- instead, so they're guaranteed to actually reach production via
-- deploy.yml rather than depending on someone remembering to run this
-- file by hand against it (nobody had, for months, which is exactly why
-- Force Disposition mission resolution silently never worked in
-- production). Edit that migration, not this file, and keep the two in
-- sync only in the sense that this file no longer duplicates that data.
--
-- The five Force Disposition names are seeded in migration 20260115000000,
-- not here (they're stable structural metadata, not content that changes
-- with each pack).
--
-- This file is applied automatically by `supabase start` / `supabase db
-- reset` in local dev. It is NOT run against production by deploy.yml.

insert into rulesets (id, name, edition, is_current) values
  ('00000000-0000-0000-0000-000000000001', 'Warhammer 40,000 11th Edition', 11, true)
on conflict (id) do nothing;

insert into mission_packs (id, ruleset_id, name, valid_from, is_current) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Chapter Approved 2026-27', '2026-06-20', true)
on conflict (id) do nothing;

-- Deployments are unchanged by the Force Disposition restructuring, so
-- (unlike missions/secondary_objectives below) they're only inserted if
-- this pack doesn't have any yet -- no delete, no risk of an FK conflict
-- with a game that already references one.
insert into deployments (mission_pack_id, name)
select '00000000-0000-0000-0000-000000000101', name
from (values
  ('Hammer and Anvil'),
  ('Search and Destroy'),
  ('Sweeping Engagement'),
  ('Crucible of Battle'),
  ('Tipping Point'),
  ('Dawn of War')
) as t(name)
where not exists (
  select 1 from deployments where mission_pack_id = '00000000-0000-0000-0000-000000000101'
);

-- Factions. A handful of top-level armies plus example Space Marine
-- chapters hanging off the parent, per the parent_faction_id design.
-- Safe to re-run: skipped entirely once any faction rows exist.
insert into factions (ruleset_id, name)
select '00000000-0000-0000-0000-000000000001', name
from (values
  ('Space Marines'),
  ('Chaos Space Marines'),
  ('Astra Militarum'),
  ('Adeptus Mechanicus'),
  ('Adepta Sororitas'),
  ('Adeptus Custodes'),
  ('Grey Knights'),
  ('Imperial Knights'),
  ('Aeldari'),
  ('Drukhari'),
  ('Necrons'),
  ('Orks'),
  ('Tyranids'),
  ('T''au Empire'),
  ('Genestealer Cults'),
  ('Chaos Daemons'),
  ('Chaos Knights'),
  ('Death Guard'),
  ('Thousand Sons'),
  ('World Eaters'),
  ('Leagues of Votann')
) as t(name)
where not exists (select 1 from factions where ruleset_id = '00000000-0000-0000-0000-000000000001');

insert into factions (ruleset_id, name, parent_faction_id)
select '00000000-0000-0000-0000-000000000001', chapters.chapter, top_level.id
from factions top_level, (values
  ('Space Marines', 'Ultramarines'),
  ('Space Marines', 'Blood Angels'),
  ('Space Marines', 'Dark Angels'),
  ('Space Marines', 'Space Wolves'),
  ('Space Marines', 'Imperial Fists'),
  ('Space Marines', 'Iron Hands'),
  ('Space Marines', 'Salamanders'),
  ('Space Marines', 'Raven Guard'),
  ('Space Marines', 'White Scars'),
  ('Space Marines', 'Black Templars'),
  ('Space Marines', 'Deathwatch')
) as chapters(parent_name, chapter)
where top_level.name = chapters.parent_name
  and top_level.ruleset_id = '00000000-0000-0000-0000-000000000001'
  and top_level.parent_faction_id is null
  and not exists (
    select 1 from factions f2
    where f2.name = chapters.chapter and f2.parent_faction_id = top_level.id
  );

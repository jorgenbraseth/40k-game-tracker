-- Reference data seed.
--
-- IMPORTANT: the mission/deployment/secondary names below are PLACEHOLDER
-- content so the app has something to run against locally. They are not
-- transcribed from Games Workshop's Chapter Approved 2026-27 deck (that's
-- copyrighted rules text this repo must never contain). Before going to
-- production, replace this file's mission_packs/missions/deployments/
-- secondary_objectives rows with the real names and VP values from your
-- own copy of the current deck -- names and point values only, never the
-- rules text.
--
-- This file is applied automatically by `supabase start` / `supabase db
-- reset` in local dev. It is NOT run against production by deploy.yml --
-- production reference data should be seeded once, deliberately, the same
-- way (psql/SQL editor) after review.

insert into rulesets (id, name, edition, is_current) values
  ('00000000-0000-0000-0000-000000000001', 'Warhammer 40,000 11th Edition', 11, true);

insert into mission_packs (id, ruleset_id, name, valid_from, is_current) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Chapter Approved 2026-27 (placeholder)', '2026-06-20', true);

insert into missions (mission_pack_id, name, max_primary_vp) values
  ('00000000-0000-0000-0000-000000000101', 'Scorched Earth', 50),
  ('00000000-0000-0000-0000-000000000101', 'Vital Intelligence', 50),
  ('00000000-0000-0000-0000-000000000101', 'Terraform', 50),
  ('00000000-0000-0000-0000-000000000101', 'Crucible of Battle', 50),
  ('00000000-0000-0000-0000-000000000101', 'Purge the Foe', 50),
  ('00000000-0000-0000-0000-000000000101', 'Sites of Power', 50);

insert into deployments (mission_pack_id, name) values
  ('00000000-0000-0000-0000-000000000101', 'Hammer and Anvil'),
  ('00000000-0000-0000-0000-000000000101', 'Search and Destroy'),
  ('00000000-0000-0000-0000-000000000101', 'Sweeping Engagement'),
  ('00000000-0000-0000-0000-000000000101', 'Crucible of Battle'),
  ('00000000-0000-0000-0000-000000000101', 'Tipping Point'),
  ('00000000-0000-0000-0000-000000000101', 'Dawn of War');

insert into secondary_objectives (mission_pack_id, name, category, max_vp) values
  ('00000000-0000-0000-0000-000000000101', 'Bring It Down', 'fixed', 15),
  ('00000000-0000-0000-0000-000000000101', 'Engage on All Fronts', 'fixed', 12),
  ('00000000-0000-0000-0000-000000000101', 'No Prisoners', 'fixed', 15),
  ('00000000-0000-0000-0000-000000000101', 'Assassination', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Cleanse', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Deploy Teleport Homers', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Deploy Scramblers', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Defend Stronghold', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Establish Locus', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Extend Battle Lines', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Investigate Signals', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Overwhelming Force', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Storm Hostile Objective', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Area Denial', 'tactical', 15),
  ('00000000-0000-0000-0000-000000000101', 'Behind Enemy Lines', 'tactical', 15);

-- Factions. A handful of top-level armies plus example Space Marine
-- chapters hanging off the parent, per the parent_faction_id design.
with top_level as (
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
  returning id, name
)
insert into factions (ruleset_id, name, parent_faction_id)
select '00000000-0000-0000-0000-000000000001', chapter, top_level.id
from top_level, (values
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
where top_level.name = chapters.parent_name;

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
-- The five Force Disposition names ARE the real, confirmed ones (seeded
-- in migration 20260115000000, not here) -- GW announced them publicly.
-- What's still placeholder is which specific Primary Mission card goes
-- with which pairing of Force Dispositions, and the secondary objective
-- names/VP values in each deck.
--
-- This file is applied automatically by `supabase start` / `supabase db
-- reset` in local dev. It is NOT run against production by deploy.yml --
-- production reference data should be seeded once, deliberately, the same
-- way (psql/SQL editor) after review. It is safe to re-run: it clears out
-- its own previously-seeded missions/deployments/secondary_objectives
-- before re-inserting, so you can paste it again after editing.

insert into rulesets (id, name, edition, is_current) values
  ('00000000-0000-0000-0000-000000000001', 'Warhammer 40,000 11th Edition', 11, true)
on conflict (id) do nothing;

insert into mission_packs (id, ruleset_id, name, valid_from, is_current) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Chapter Approved 2026-27 (placeholder)', '2026-06-20', true)
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

-- missions/secondary_objectives DO need a clean replace: existing rows
-- predate the Force Disposition columns entirely. If this fails with a
-- foreign key violation, a game (almost certainly a leftover test game,
-- since this is pre-launch) still references the old rows -- run
-- `delete from games;` first, then re-run this script.
delete from secondary_objectives where mission_pack_id = '00000000-0000-0000-0000-000000000101';
delete from missions where mission_pack_id = '00000000-0000-0000-0000-000000000101';

-- One placeholder Primary Mission per unordered Force Disposition pairing
-- (5 dispositions -> 15 pairings including mirror matchups), so every
-- combination players can pick resolves to *something*. The real deck
-- has 30 primary mission cards (likely more than one option per pairing
-- for variety) -- this is a deliberately simplified 1-per-pairing stand-in.
with fd as (
  select id, name from force_dispositions where ruleset_id = '00000000-0000-0000-0000-000000000001'
),
pairs as (
  select a.id as a_id, a.name as a_name, b.id as b_id, b.name as b_name
  from fd a
  join fd b on a.name <= b.name
)
insert into missions (mission_pack_id, name, max_primary_vp, force_disposition_a_id, force_disposition_b_id)
select
  '00000000-0000-0000-0000-000000000101',
  case when a_name = b_name
    then a_name || ' Mirror Match (placeholder)'
    else a_name || ' vs ' || b_name || ' (placeholder)'
  end,
  50,
  a_id,
  b_id
from pairs;

insert into secondary_objectives (mission_pack_id, name, category, role, max_vp) values
  ('00000000-0000-0000-0000-000000000101', 'Bring It Down', 'tactical', 'attacker', 15),
  ('00000000-0000-0000-0000-000000000101', 'Engage on All Fronts', 'tactical', 'attacker', 12),
  ('00000000-0000-0000-0000-000000000101', 'No Prisoners', 'tactical', 'attacker', 15),
  ('00000000-0000-0000-0000-000000000101', 'Assassination', 'tactical', 'attacker', 15),
  ('00000000-0000-0000-0000-000000000101', 'Cleanse', 'tactical', 'attacker', 15),
  ('00000000-0000-0000-0000-000000000101', 'Deploy Teleport Homers', 'tactical', 'attacker', 15),
  ('00000000-0000-0000-0000-000000000101', 'Deploy Scramblers', 'tactical', 'attacker', 15),
  ('00000000-0000-0000-0000-000000000101', 'Investigate Signals', 'tactical', 'attacker', 15),
  ('00000000-0000-0000-0000-000000000101', 'Overwhelming Force', 'tactical', 'attacker', 15),
  ('00000000-0000-0000-0000-000000000101', 'Defend Stronghold', 'tactical', 'defender', 15),
  ('00000000-0000-0000-0000-000000000101', 'Establish Locus', 'tactical', 'defender', 15),
  ('00000000-0000-0000-0000-000000000101', 'Extend Battle Lines', 'tactical', 'defender', 15),
  ('00000000-0000-0000-0000-000000000101', 'Storm Hostile Objective', 'tactical', 'defender', 15),
  ('00000000-0000-0000-0000-000000000101', 'Area Denial', 'tactical', 'defender', 15),
  ('00000000-0000-0000-0000-000000000101', 'Behind Enemy Lines', 'tactical', 'defender', 15);

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

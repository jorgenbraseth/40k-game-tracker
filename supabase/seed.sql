-- Reference data seed.
--
-- The mission_packs/missions/deployments/secondary_objectives rows below
-- are the real Chapter Approved 2026-27 deck -- names, Force Disposition
-- pairings, and VP values only, sourced from the public card text and
-- mission generator at
-- https://wahapedia.ru/wh40k11ed/the-rules/mission-deck-2026-27/. This
-- repo never stores GW's rules text (how each mission is actually scored
-- turn by turn) -- that's their copyrighted material; players read that
-- off their own physical or app copy of the deck. See "Ruleset / mission
-- content" in README.md for how this data is versioned.
--
-- The five Force Disposition names are seeded in migration 20260115000000,
-- not here (they're stable structural metadata, not content that changes
-- with each pack).
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

-- missions/secondary_objectives DO need a clean replace: existing rows
-- predate the Force Disposition columns entirely. If this fails with a
-- foreign key violation, a game (almost certainly a leftover test game,
-- since this is pre-launch) still references the old rows -- run
-- `delete from games;` first, then re-run this script.
delete from secondary_objectives where mission_pack_id = '00000000-0000-0000-0000-000000000101';
delete from missions where mission_pack_id = '00000000-0000-0000-0000-000000000101';

-- Every Force Disposition card lists a Primary Mission for each of the 5
-- possible opponent Force Dispositions (including itself, for a mirror
-- matchup) -- 5 cards x 5 opponent lookups = 25 distinct Primary
-- Missions, each worth up to 15VP. This is an ORDERED pairing: "Take and
-- Hold" facing "Purge the Foe" plays a different mission than "Purge the
-- Foe" facing "Take and Hold" -- see resolve_game_mission() and the
-- comment at the top of 20260201000000_asymmetric_primary_missions.sql.
with fd as (
  select id, name from force_dispositions where ruleset_id = '00000000-0000-0000-0000-000000000001'
),
mission_grid (owner_fd, opponent_fd, mission_name) as (
  values
    ('Take and Hold', 'Take and Hold', 'Battlefield Dominance'),
    ('Take and Hold', 'Purge the Foe', 'Immovable Object'),
    ('Take and Hold', 'Disruption', 'Determined Acquisition'),
    ('Take and Hold', 'Reconnaissance', 'Purge and Secure'),
    ('Take and Hold', 'Priority Assets', 'Inescapable Dominion'),

    ('Purge the Foe', 'Take and Hold', 'Unstoppable Force'),
    ('Purge the Foe', 'Purge the Foe', 'Meatgrinder'),
    ('Purge the Foe', 'Disruption', 'Punishment'),
    ('Purge the Foe', 'Reconnaissance', 'Consecrate'),
    ('Purge the Foe', 'Priority Assets', 'Destroyer''s Wrath'),

    ('Disruption', 'Take and Hold', 'Death Trap'),
    ('Disruption', 'Purge the Foe', 'Delaying Action'),
    ('Disruption', 'Disruption', 'Outmanoeuvre'),
    ('Disruption', 'Reconnaissance', 'Smoke and Mirrors'),
    ('Disruption', 'Priority Assets', 'Locate and Deny'),

    ('Reconnaissance', 'Take and Hold', 'Reconnaissance Sweep'),
    ('Reconnaissance', 'Purge the Foe', 'Triangulation'),
    ('Reconnaissance', 'Disruption', 'Surveil the Foe'),
    ('Reconnaissance', 'Reconnaissance', 'Gather Intel'),
    ('Reconnaissance', 'Priority Assets', 'Search and Scour'),

    ('Priority Assets', 'Take and Hold', 'Secure Asset'),
    ('Priority Assets', 'Purge the Foe', 'Vital Link'),
    ('Priority Assets', 'Disruption', 'Extract Relic'),
    ('Priority Assets', 'Reconnaissance', 'Vanguard Operation'),
    ('Priority Assets', 'Priority Assets', 'Sabotage')
)
insert into missions (mission_pack_id, name, max_primary_vp, force_disposition_id, opponent_force_disposition_id)
select
  '00000000-0000-0000-0000-000000000101',
  g.mission_name,
  15,
  owner.id,
  opponent.id
from mission_grid g
join fd owner on owner.name = g.owner_fd
join fd opponent on opponent.name = g.opponent_fd;

-- The 18-card Secondary Mission deck is identical for Attacker and
-- Defender (each just draws from/keeps their own copy of it), so each
-- name is seeded once per role. Every card caps at 5VP regardless of
-- whether a player is using it under Fixed or Tactical rules for the
-- battle (a per-player, whole-deck choice this app doesn't need to model
-- -- there's no per-card fixed/tactical category in this deck).
insert into secondary_objectives (mission_pack_id, name, role, max_vp)
select '00000000-0000-0000-0000-000000000101', name, role, 5
from (values
  ('No Prisoners'),
  ('Overwhelming Force'),
  ('Plunder'),
  ('Display of Might'),
  ('Outflank'),
  ('Beacon'),
  ('Cleanse'),
  ('A Grievous Blow'),
  ('Defend Stronghold'),
  ('Engage on All Fronts'),
  ('Secure No Man''s Land'),
  ('Forward Position'),
  ('Centre Ground'),
  ('Assassination'),
  ('A Tempting Target'),
  ('Behind Enemy Lines'),
  ('Bring It Down'),
  ('Burden of Trust')
) as names(name)
cross join (values ('attacker'), ('defender')) as roles(role);

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

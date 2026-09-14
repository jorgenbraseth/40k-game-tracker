-- Production's missions/secondary_objectives still held the very first
-- scaffold's placeholder rows (names like "Scorched Earth", "Deploy
-- Teleport Homers") with force_disposition_id/role left null -- the
-- Force Disposition redesign and the real Chapter Approved 2026-27 data
-- both landed only in supabase/seed.sql, which is deliberately NOT run
-- against production by deploy.yml (see its header comment). Nobody has
-- run it by hand since the very first deploy, so resolve_game_mission()
-- has never had a real (force_disposition_id, opponent_force_disposition_id)
-- row to match against -- every game, solo or two-player, has been
-- stuck at "waiting on both Force Dispositions to reveal the mission"
-- forever, regardless of what either player picked.
--
-- Confirmed directly against the production REST API: 6 missions and 15
-- secondary_objectives, all with force_disposition_id/role = null,
-- exactly the pre-redesign scaffold content.
--
-- Fix: promote this reference data into a real migration instead of a
-- manual step, so it's applied deterministically by deploy.yml like
-- everything else -- this class of bug (someone forgets the manual
-- step) can't recur. Content matches supabase/seed.sql exactly; keep
-- them in sync if either changes.

-- The 6 leftover pre-redesign mission rows are harmless clutter, not a
-- live reference: no game_players.mission_id could ever have pointed at
-- one (that column didn't exist until after the redesign, and
-- resolve_game_mission never matched them in the first place).
delete from missions
where mission_pack_id = '00000000-0000-0000-0000-000000000101'
  and force_disposition_id is null;

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
join fd opponent on opponent.name = g.opponent_fd
on conflict (mission_pack_id, force_disposition_id, opponent_force_disposition_id)
do update set name = excluded.name, max_primary_vp = excluded.max_primary_vp;

-- Same story for secondary_objectives: the 15 leftover pre-redesign rows
-- all have role = null, so Scoreboard's `s.role === entry.player.role`
-- filter already hides them from the picker whenever a role is set --
-- dead clutter, not a live reference (no secondary_scores row could
-- reference one: the RLS/grants fix that made writes possible at all
-- landed well after these became unreachable in the UI).
delete from secondary_objectives
where mission_pack_id = '00000000-0000-0000-0000-000000000101'
  and role is null;

alter table secondary_objectives
  add constraint secondary_objectives_pack_name_role_key unique (mission_pack_id, name, role);

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
cross join (values ('attacker'), ('defender')) as roles(role)
on conflict (mission_pack_id, name, role) do update set max_vp = excluded.max_vp;

-- Deployment map images + terrain layout variant selection (issues #19,
-- #20). Both are static assets committed under public/images/ and served
-- from the app's own domain -- see README's "Ruleset / mission content"
-- copyright note for why (same one-time exception already made for the
-- verbatim scoring-condition text).
--
-- Deployment images are one per `deployments` row, keyed by name.
--
-- Layout images are NOT keyed by deployment at all: wahapedia's own page
-- script (CA7_Layouts / CA7_LayoutKey) shows the 3 layout variants
-- (A/B/C) are keyed by the *sorted pair* of both players' Force
-- Disposition categories -- the same pairing that already determines
-- which row of `missions` gets played (see
-- 20260201000000_asymmetric_primary_missions.sql). So the 3 image paths
-- live directly on `missions`, populated identically on both of a pair's
-- ordered rows (p1-vs-p2 and p2-vs-p1 both show the same layout pack,
-- since the pairing is unordered for this purpose even though the
-- mission itself is asymmetric).

alter table deployments add column image_path text;
alter table missions
  add column layout_a_image_path text,
  add column layout_b_image_path text,
  add column layout_c_image_path text;

-- Which of the (up to) 3 recommended layouts the table was actually set
-- up as. Nullable and freely editable at any time, same as every other
-- piece of game state -- this app never gates progress on it, it's just
-- another fact to record for the bookkeeping.
alter table games add column layout_variant text check (layout_variant in ('A', 'B', 'C'));

update deployments set image_path = v.image_path
from (values
  ('Hammer and Anvil', '/images/deployments/hammer-and-anvil.png'),
  ('Search and Destroy', '/images/deployments/search-and-destroy.png'),
  ('Sweeping Engagement', '/images/deployments/sweeping-engagement.png'),
  ('Crucible of Battle', '/images/deployments/crucible-of-battle.png'),
  ('Tipping Point', '/images/deployments/tipping-point.png'),
  ('Dawn of War', '/images/deployments/dawn-of-war.png')
) as v(name, image_path)
where deployments.name = v.name;

-- One row per unordered Force Disposition pair (15 total: 5 same-vs-same
-- + 10 distinct pairs), applied to both ordered `missions` rows that
-- share that pair.
with packs (fd_a, fd_b, layout_a, layout_b, layout_c) as (
  values
    ('Disruption', 'Disruption', '/images/layouts/disruption-vs-disruption-a.png', '/images/layouts/disruption-vs-disruption-b.png', '/images/layouts/disruption-vs-disruption-c.png'),
    ('Disruption', 'Priority Assets', '/images/layouts/disruption-vs-priorityassets-a.png', '/images/layouts/disruption-vs-priorityassets-b.png', '/images/layouts/disruption-vs-priorityassets-c.png'),
    ('Disruption', 'Purge the Foe', '/images/layouts/disruption-vs-purgethefoe-a.png', '/images/layouts/disruption-vs-purgethefoe-b.png', '/images/layouts/disruption-vs-purgethefoe-c.png'),
    ('Disruption', 'Reconnaissance', '/images/layouts/disruption-vs-reconnaissance-a.png', '/images/layouts/disruption-vs-reconnaissance-b.png', '/images/layouts/disruption-vs-reconnaissance-c.png'),
    ('Disruption', 'Take and Hold', '/images/layouts/disruption-vs-takeandhold-a.png', '/images/layouts/disruption-vs-takeandhold-b.png', '/images/layouts/disruption-vs-takeandhold-c.png'),
    ('Priority Assets', 'Priority Assets', '/images/layouts/priorityassets-vs-priorityassets-a.png', '/images/layouts/priorityassets-vs-priorityassets-b.png', '/images/layouts/priorityassets-vs-priorityassets-c.png'),
    ('Priority Assets', 'Purge the Foe', '/images/layouts/priorityassets-vs-purgethefoe-a.png', '/images/layouts/priorityassets-vs-purgethefoe-b.png', '/images/layouts/priorityassets-vs-purgethefoe-c.png'),
    ('Priority Assets', 'Reconnaissance', '/images/layouts/priorityassets-vs-reconnaissance-a.png', '/images/layouts/priorityassets-vs-reconnaissance-b.png', '/images/layouts/priorityassets-vs-reconnaissance-c.png'),
    ('Priority Assets', 'Take and Hold', '/images/layouts/priorityassets-vs-takeandhold-a.png', '/images/layouts/priorityassets-vs-takeandhold-b.png', '/images/layouts/priorityassets-vs-takeandhold-c.png'),
    ('Purge the Foe', 'Purge the Foe', '/images/layouts/purgethefoe-vs-purgethefoe-a.png', '/images/layouts/purgethefoe-vs-purgethefoe-b.png', '/images/layouts/purgethefoe-vs-purgethefoe-c.png'),
    ('Purge the Foe', 'Reconnaissance', '/images/layouts/purgethefoe-vs-reconnaissance-a.png', '/images/layouts/purgethefoe-vs-reconnaissance-b.png', '/images/layouts/purgethefoe-vs-reconnaissance-c.png'),
    ('Purge the Foe', 'Take and Hold', '/images/layouts/purgethefoe-vs-takeandhold-a.png', '/images/layouts/purgethefoe-vs-takeandhold-b.png', '/images/layouts/purgethefoe-vs-takeandhold-c.png'),
    ('Reconnaissance', 'Reconnaissance', '/images/layouts/reconnaissance-vs-reconnaissance-a.png', '/images/layouts/reconnaissance-vs-reconnaissance-b.png', '/images/layouts/reconnaissance-vs-reconnaissance-c.png'),
    ('Reconnaissance', 'Take and Hold', '/images/layouts/reconnaissance-vs-takeandhold-a.png', '/images/layouts/reconnaissance-vs-takeandhold-b.png', '/images/layouts/reconnaissance-vs-takeandhold-c.png'),
    ('Take and Hold', 'Take and Hold', '/images/layouts/takeandhold-vs-takeandhold-a.png', '/images/layouts/takeandhold-vs-takeandhold-b.png', '/images/layouts/takeandhold-vs-takeandhold-c.png')
),
fd_ids as (
  select id, name from force_dispositions where ruleset_id = '00000000-0000-0000-0000-000000000001'
)
update missions m
set layout_a_image_path = p.layout_a,
    layout_b_image_path = p.layout_b,
    layout_c_image_path = p.layout_c
from packs p
join fd_ids fa on fa.name = p.fd_a
join fd_ids fb on fb.name = p.fd_b
where (m.force_disposition_id = fa.id and m.opponent_force_disposition_id = fb.id)
   or (m.force_disposition_id = fb.id and m.opponent_force_disposition_id = fa.id);

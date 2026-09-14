-- Reference data: rulesets, mission packs, missions, deployments,
-- secondary objectives, factions.
--
-- This content is versioned so that a finished game always points at the
-- exact mission pack it was played under. When GW publishes a new Chapter
-- Approved deck, insert a new mission_packs row (and its children) rather
-- than editing existing rows -- old games must keep pointing at old data.
--
-- Only names, categories and VP values are stored here, never GW's rules
-- text -- that's their copyrighted material.

create extension if not exists pgcrypto;

create table rulesets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  edition int not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table mission_packs (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references rulesets(id) on delete cascade,
  name text not null,
  valid_from date not null,
  valid_to date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create index mission_packs_ruleset_id_idx on mission_packs(ruleset_id);

create table missions (
  id uuid primary key default gen_random_uuid(),
  mission_pack_id uuid not null references mission_packs(id) on delete cascade,
  name text not null,
  max_primary_vp int not null default 50,
  created_at timestamptz not null default now()
);

create index missions_mission_pack_id_idx on missions(mission_pack_id);

create table deployments (
  id uuid primary key default gen_random_uuid(),
  mission_pack_id uuid not null references mission_packs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index deployments_mission_pack_id_idx on deployments(mission_pack_id);

create table secondary_objectives (
  id uuid primary key default gen_random_uuid(),
  mission_pack_id uuid not null references mission_packs(id) on delete cascade,
  name text not null,
  category text not null check (category in ('fixed', 'tactical')),
  max_vp int not null default 15,
  created_at timestamptz not null default now()
);

create index secondary_objectives_mission_pack_id_idx on secondary_objectives(mission_pack_id);

create table factions (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references rulesets(id) on delete cascade,
  name text not null,
  parent_faction_id uuid references factions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index factions_ruleset_id_idx on factions(ruleset_id);
create index factions_parent_faction_id_idx on factions(parent_faction_id);

-- Instead of typing a raw VP number, a player should be able to pick
-- which of a mission/secondary's actual scoring conditions they achieved
-- -- and for a "for each..." condition, set a count -- with the total
-- computed for them. That means storing the real scoring conditions
-- printed on each card, which this repo has deliberately never done
-- (see the copyright note atop 20260101000000_reference_tables.sql):
-- names, categories and VP values only, never the rules text itself.
--
-- This migration is a deliberate, informed exception to that rule, made
-- by the project owner after being told explicitly what it means: the
-- condition_text below is GW's copyrighted rules text (via wahapedia.ru's
-- public transcription of the card text), not just names/VP values.
--
-- round_scores.primary_vp and secondary_scores.vp_scored remain the
-- source of truth for a round's totals -- unchanged, no migration needed
-- for them. These new *_ticks tables are an additional, optional record
-- of *how* a player got there: the app sums ticked lines and writes the
-- result into the existing totals via the existing upsert mutations, but
-- a player can still edit the raw total directly too (same "always
-- editable, never a guided workflow" rule as everywhere else in this
-- app) -- the ticks are a convenience and a record, not a lock.

create table mission_objective_lines (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  window_label text not null,
  when_label text,
  condition_text text not null,
  vp_value int not null,
  is_counter boolean not null default false,
  is_cumulative_bonus boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index mission_objective_lines_mission_id_idx on mission_objective_lines(mission_id);

create table secondary_objective_lines (
  id uuid primary key default gen_random_uuid(),
  secondary_objective_id uuid not null references secondary_objectives(id) on delete cascade,
  window_label text not null,
  when_label text,
  condition_text text not null,
  vp_value int not null,
  is_counter boolean not null default false,
  is_cumulative_bonus boolean not null default false,
  -- Four of the eighteen secondary cards score differently depending on
  -- whether the scoring player is using Fixed or Tactical rules for the
  -- battle (a per-player, whole-deck choice this app doesn't track
  -- elsewhere) -- null means the line applies either way.
  mode text check (mode in ('fixed', 'tactical')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index secondary_objective_lines_secondary_objective_id_idx on secondary_objective_lines(secondary_objective_id);

-- Which lines a player has ticked (and how many times, for a counter
-- line) in a given battle round. One row per line actually touched;
-- untouched lines simply have no row (read as count = 0).
create table primary_objective_ticks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  game_player_id uuid not null references game_players(id) on delete cascade,
  battle_round int not null check (battle_round between 1 and 5),
  mission_objective_line_id uuid not null references mission_objective_lines(id) on delete cascade,
  count int not null default 1 check (count >= 0),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (game_player_id, battle_round, mission_objective_line_id)
);

create index primary_objective_ticks_game_id_idx on primary_objective_ticks(game_id);
create index primary_objective_ticks_game_player_id_idx on primary_objective_ticks(game_player_id);

create table secondary_objective_ticks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  game_player_id uuid not null references game_players(id) on delete cascade,
  battle_round int not null check (battle_round between 1 and 5),
  secondary_objective_line_id uuid not null references secondary_objective_lines(id) on delete cascade,
  count int not null default 1 check (count >= 0),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (game_player_id, battle_round, secondary_objective_line_id)
);

create index secondary_objective_ticks_game_id_idx on secondary_objective_ticks(game_id);
create index secondary_objective_ticks_game_player_id_idx on secondary_objective_ticks(game_player_id);

alter table mission_objective_lines enable row level security;
alter table secondary_objective_lines enable row level security;
alter table primary_objective_ticks enable row level security;
alter table secondary_objective_ticks enable row level security;

create policy "reference data is publicly readable" on mission_objective_lines for select using (true);
create policy "reference data is publicly readable" on secondary_objective_lines for select using (true);

create policy "participants can read primary_objective_ticks in their games" on primary_objective_ticks
  for select to authenticated using (is_game_participant(game_id));

create policy "participants can insert primary_objective_ticks in their games" on primary_objective_ticks
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

create policy "participants can update primary_objective_ticks in their games" on primary_objective_ticks
  for update to authenticated
  using (is_game_participant(game_id))
  with check (
    is_game_participant(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

create policy "participants can read secondary_objective_ticks in their games" on secondary_objective_ticks
  for select to authenticated using (is_game_participant(game_id));

create policy "participants can insert secondary_objective_ticks in their games" on secondary_objective_ticks
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

create policy "participants can update secondary_objective_ticks in their games" on secondary_objective_ticks
  for update to authenticated
  using (is_game_participant(game_id))
  with check (
    is_game_participant(game_id)
    and updated_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

grant select on mission_objective_lines to anon, authenticated;
grant select on secondary_objective_lines to anon, authenticated;
grant select, insert, update on primary_objective_ticks to authenticated;
grant select, insert, update on secondary_objective_ticks to authenticated;

-- Sourced verbatim from https://wahapedia.ru/wh40k11ed/the-rules/mission-deck-2026-27/
-- (public card text; names/VP values already in missions/secondary_objectives per
-- earlier migrations -- this adds the actual scoring condition lines printed on
-- each card).

with mission_lookup as (
  select id, name from missions where mission_pack_id = '00000000-0000-0000-0000-000000000101'
),
rows (mission_name, window_label, when_label, condition_text, vp_value, is_counter, is_cumulative_bonus, sort_order) as (
  values
    ('Battlefield Dominance', 'First and Second Battle Round', 'End of your turn.', 'You control more objectives than your opponent.', 2, false, false, 0),
    ('Battlefield Dominance', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'For each objective you control.', 3, true, false, 1),
    ('Battlefield Dominance', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'For each of those objectives (excluding your home objective) if you control your home objective.', 2, true, true, 2),
    ('Immovable Object', 'Any Battle Round', 'End of your turn.', 'You control one or more central objectives.', 3, false, false, 0),
    ('Immovable Object', 'Second to Fourth Battle Round', 'End of your Command phase.', 'For each objective you control (excluding your home objective).', 5, true, false, 1),
    ('Immovable Object', 'Fifth Battle Round', 'End of your turn.', 'For each objective you control (excluding your home objective).', 5, true, false, 2),
    ('Determined Acquisition', 'Any Battle Round', 'End of your turn.', 'For each objective you control that you did not control at the start of the turn (excluding your home objective).', 2, true, false, 0),
    ('Determined Acquisition', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'For each objective you control.', 3, true, false, 1),
    ('Determined Acquisition', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'For each of those objectives that is within your opponent''s territory.', 3, true, true, 2),
    ('Purge and Secure', 'Any Battle Round', 'End of your turn.', 'One or more enemy units were destroyed this turn by a friendly unit that was within range of one or more objectives.', 3, false, false, 0),
    ('Purge and Secure', 'Any Battle Round', 'End of your turn.', 'One or more enemy units that started the turn within range of one or more objectives were destroyed this turn.', 3, false, false, 1),
    ('Purge and Secure', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'For each objective you control (excluding your home objective).', 4, true, false, 2),
    ('Purge and Secure', 'Second Battle Round Onwards', 'End of your turn.', 'You control one or more objectives you did not control at the start of the turn (excluding your home objective).', 3, false, false, 3),
    ('Inescapable Dominion', 'Any Battle Round', 'End of your turn.', 'You control three or more objectives.', 4, false, false, 0),
    ('Inescapable Dominion', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control two or more objectives.', 5, false, false, 1),
    ('Inescapable Dominion', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control more objectives than your opponent.', 4, false, false, 2),
    ('Inescapable Dominion', 'End of the Battle', null, 'You control your opponent''s home objective.', 5, false, false, 3),
    ('Unstoppable Force', 'Any Battle Round', 'End of your turn.', 'One or more enemy units were destroyed this turn.', 3, false, false, 0),
    ('Unstoppable Force', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'For each objective you control (excluding your home objective).', 4, true, false, 1),
    ('Unstoppable Force', 'Second Battle Round Onwards', 'End of your turn.', 'You control one or more objectives you did not control at the start of the turn (excluding your home objective).', 3, false, false, 2),
    ('Unstoppable Force', 'End of the Battle', null, 'You control one or more central objectives.', 5, false, false, 3),
    ('Meatgrinder', 'Any Battle Round', 'End of your turn.', 'One or more enemy units were destroyed this turn.', 3, false, false, 0),
    ('Meatgrinder', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 1),
    ('Meatgrinder', 'Second Battle Round Onwards', 'End of your turn.', 'More enemy units were destroyed this turn than friendly units were destroyed in the previous turn.', 5, false, false, 2),
    ('Meatgrinder', 'Second Battle Round Onwards', 'End of your turn.', 'You control your opponent''s home objective.', 5, false, false, 3),
    ('Punishment', 'Any Battle Round', 'End of a turn.', 'One or more condemned enemy units left the battlefield this turn.', 5, false, false, 0),
    ('Punishment', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 1),
    ('Punishment', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control more objectives than your opponent.', 5, false, false, 2),
    ('Punishment', 'End of the Battle', null, 'You control your opponent''s home objective.', 8, false, false, 3),
    ('Consecrate', 'Any Battle Round', 'End of your turn.', 'One or two objectives are consecrated.', 3, false, false, 0),
    ('Consecrate', 'Any Battle Round', 'End of your turn.', 'Three or more objectives are consecrated.', 6, false, false, 1),
    ('Consecrate', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 2),
    ('Consecrate', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control more objectives than your opponent.', 4, false, false, 3),
    ('Consecrate', 'End of the Battle', null, 'Your opponent''s home objective is consecrated.', 5, false, false, 4),
    ('Destroyer''s Wrath', 'Any Battle Round', 'End of your turn.', 'One or more enemy units were destroyed this turn.', 3, false, false, 0),
    ('Destroyer''s Wrath', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 1),
    ('Destroyer''s Wrath', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control more objectives than your opponent.', 6, false, false, 2),
    ('Destroyer''s Wrath', 'Second Battle Round Onwards', 'End of your turn.', 'More enemy units were destroyed this turn than friendly units were destroyed in the previous turn.', 4, false, false, 3),
    ('Death Trap', 'Any Battle Round', 'End of your turn.', 'For each terrain area trapped this turn.', 2, true, false, 0),
    ('Death Trap', 'Any Battle Round', 'End of your turn.', 'For each of those terrain areas that is an objective.', 3, true, true, 1),
    ('Death Trap', 'Any Battle Round', 'End of your turn.', 'One or more enemy units that started the turn within a terrain area were destroyed, if that terrain area is trapped.', 3, false, false, 2),
    ('Death Trap', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 3),
    ('Delaying Action', 'Any Battle Round', 'End of your turn.', 'For each enemy unit destroyed this turn.', 2, true, false, 0),
    ('Delaying Action', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 1),
    ('Delaying Action', 'Second Battle Round Onwards', 'End of your turn.', 'You control one or more central objectives and one or more expansion objectives.', 3, false, false, 2),
    ('Outmanoeuvre', 'Any Battle Round', 'End of your turn.', 'You control your opponent''s home objective.', 10, false, false, 0),
    ('Outmanoeuvre', 'First Battle Round', 'End of your turn.', 'For each objective you control (excluding your home objective).', 4, true, false, 1),
    ('Outmanoeuvre', 'Second and Third Battle Round', 'End of your Command phase.', 'For each objective you control (excluding your home objective).', 5, true, false, 2),
    ('Outmanoeuvre', 'Fourth Battle Round Onwards', 'End of your turn.', 'For each objective you control (excluding your home objective).', 6, true, false, 3),
    ('Smoke and Mirrors', 'Any Battle Round', 'End of your turn.', 'For each objective that is decoyed.', 2, true, false, 0),
    ('Smoke and Mirrors', 'Any Battle Round', 'End of your turn.', 'For each of those objectives that is within your opponent''s territory.', 2, true, true, 1),
    ('Smoke and Mirrors', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 2),
    ('Smoke and Mirrors', 'End of the Battle', null, 'Four or more objectives are decoyed.', 10, false, false, 3),
    ('Locate and Deny', 'Any Battle Round', 'End of your turn.', 'One or more enemy units that started the turn within range of one or more objectives are destroyed.', 4, false, false, 0),
    ('Locate and Deny', 'Any Battle Round', 'End of your turn.', 'Only one of your operation markers is on the battlefield, if one or more of your units are within the same terrain area as that marker, and no enemy units are within that terrain area.', 4, false, false, 1),
    ('Locate and Deny', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 2),
    ('Locate and Deny', 'End of the Battle', null, 'Only one of your operation markers is on the battlefield, if one or more of your units are within the same terrain area as that marker, and no enemy units are within that terrain area.', 5, false, false, 3),
    ('Reconnaissance Sweep', 'Any Battle Round', 'End of your turn.', 'Three or more friendly units are wholly within three different table quarters and not within 6" of the centre of the battlefield.', 3, false, false, 0),
    ('Reconnaissance Sweep', 'Any Battle Round', 'End of your turn.', 'Four or more friendly units are wholly within four different table quarters and not within 6" of the centre of the battlefield.', 6, false, false, 1),
    ('Reconnaissance Sweep', 'Any Battle Round', 'End of your turn.', 'For each enemy unit destroyed this turn.', 1, true, false, 2),
    ('Reconnaissance Sweep', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 3, false, false, 3),
    ('Triangulation', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 0),
    ('Triangulation', 'Second Battle Round Onwards', 'End of your turn.', 'One objective is triangulated.', 3, false, false, 1),
    ('Triangulation', 'Second Battle Round Onwards', 'End of your turn.', 'Two objectives are triangulated.', 6, false, false, 2),
    ('Triangulation', 'Second Battle Round Onwards', 'End of your turn.', 'Three or more objectives are triangulated.', 10, false, false, 3),
    ('Triangulation', 'End of the Battle', null, 'You control four or more objectives.', 10, false, false, 4),
    ('Surveil the Foe', 'Any Battle Round', 'End of your turn.', 'One or more enemy units were surveilled this turn, unless each of those units is within range of one or more objectives that have one or more operation markers within range of them.', 4, false, false, 0),
    ('Surveil the Foe', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 1),
    ('Surveil the Foe', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control more objectives than your opponent.', 4, false, false, 2),
    ('Surveil the Foe', 'Second Battle Round Onwards', 'End of your turn.', 'None of your opponent''s operation markers are on the battlefield.', 5, false, false, 3),
    ('Gather Intel', 'First Battle Round', 'End of your turn.', 'You control one or more central objectives.', 6, false, false, 0),
    ('Gather Intel', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 1),
    ('Gather Intel', 'Second Battle Round Onwards', 'End of your turn.', 'For each friendly unit that completed the Extract Intelligence action this turn.', 7, true, false, 2),
    ('Gather Intel', 'End of the Battle', null, 'Three or more of your operation markers are on the battlefield.', 5, false, false, 3),
    ('Gather Intel', 'End of the Battle', null, 'One of your operation markers is within range of your opponent''s home objective.', 5, false, false, 4),
    ('Search and Scour', 'Any Battle Round', 'End of your turn.', 'You control one or more central objectives.', 3, false, false, 0),
    ('Search and Scour', 'Any Battle Round', 'End of your turn.', 'One or more enemy units that started the turn within a terrain area are destroyed.', 2, false, false, 1),
    ('Search and Scour', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'For each objective you control (excluding your home objective).', 4, true, false, 2),
    ('Search and Scour', 'End of the Battle', null, 'No enemy units are wholly within your territory.', 5, false, false, 3),
    ('Secure Asset', 'Any Battle Round', 'End of your turn.', 'A friendly unit secured the asset this turn.', 4, false, false, 0),
    ('Secure Asset', 'Any Battle Round', 'End of your turn.', 'One or more enemy units that started the turn within range of one or more central objectives are destroyed.', 2, false, false, 1),
    ('Secure Asset', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 2),
    ('Secure Asset', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control three or more objectives.', 4, false, false, 3),
    ('Vital Link', 'Any Battle Round', 'End of your turn.', 'You control one or more central objectives.', 2, false, false, 0),
    ('Vital Link', 'Any Battle Round', 'End of your turn.', 'For each of your operation markers within range of one of those objectives.', 1, true, true, 1),
    ('Vital Link', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 2),
    ('Vital Link', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'One or more of those objectives is a central objective.', 4, false, true, 3),
    ('Vital Link', 'End of the Battle', null, 'You control your opponent''s home objective.', 10, false, false, 4),
    ('Extract Relic', 'Any Battle Round', 'End of your turn.', 'A friendly unit performed a sensor sweep this turn.', 4, false, false, 0),
    ('Extract Relic', 'Any Battle Round', 'End of your turn.', 'One or more enemy units that started the turn within range of one or more objectives are destroyed.', 3, false, false, 1),
    ('Extract Relic', 'Any Battle Round', 'End of your turn.', 'Only one of your opponent''s operation markers is on the battlefield, if one or more of your units are within the same terrain area as that operation marker, and no enemy units are within that terrain area.', 4, false, false, 2),
    ('Extract Relic', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 3),
    ('Extract Relic', 'End of the Battle', null, 'Only one of your opponent''s operation markers is on the battlefield, if one or more of your units are within the same terrain area as that operation marker, and no enemy units are within that terrain area.', 5, false, false, 4),
    ('Vanguard Operation', 'Any Battle Round', 'End of your turn.', 'A friendly unit performed a vanguard operation this turn.', 4, false, false, 0),
    ('Vanguard Operation', 'Any Battle Round', 'End of your turn.', 'One or more enemy units were destroyed this turn.', 2, false, false, 1),
    ('Vanguard Operation', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 2),
    ('Vanguard Operation', 'End of the Battle', null, 'You control your opponent''s home objective.', 10, false, false, 3),
    ('Sabotage', 'Any Battle Round', 'End of your turn.', 'For each friendly unit that committed sabotage this turn.', 3, true, false, 0),
    ('Sabotage', 'Any Battle Round', 'End of your turn.', 'For each of those units that is within range of one or more objectives in your opponent''s territory.', 2, true, true, 1),
    ('Sabotage', 'Second Battle Round Onwards', 'End of your Command phase (or the end of your turn in the fifth battle round).', 'You control one or more objectives (excluding your home objective).', 4, false, false, 2)
)
insert into mission_objective_lines (mission_id, window_label, when_label, condition_text, vp_value, is_counter, is_cumulative_bonus, sort_order)
select m.id, r.window_label, r.when_label, r.condition_text, r.vp_value, r.is_counter, r.is_cumulative_bonus, r.sort_order
from rows r
join mission_lookup m on m.name = r.mission_name;

with secondary_lookup as (
  select id, name, role from secondary_objectives where mission_pack_id = '00000000-0000-0000-0000-000000000101'
),
rows (secondary_name, window_label, when_label, condition_text, vp_value, is_counter, is_cumulative_bonus, mode, sort_order) as (
  values
    ('No Prisoners', 'Any Battle Round', 'End of a turn.', 'For each enemy unit destroyed this turn.', 2, true, false, null, 0),
    ('Overwhelming Force', 'Any Battle Round', 'End of a turn.', 'For each enemy unit that started the turn within range of one or more objectives and is destroyed.', 3, true, false, null, 0),
    ('Plunder', 'Any Battle Round', 'End of your turn.', 'A terrain area was plundered this turn.', 5, false, false, null, 0),
    ('Display of Might', 'Any Battle Round', 'End of your turn.', 'There are more friendly units than enemy units (excluding Aircraft and battle-shocked units) wholly within No Man''s Land.', 2, false, false, null, 0),
    ('Display of Might', 'Any Battle Round', 'End of your opponent''s turn.', 'There are more friendly units than enemy units (excluding Aircraft and battle-shocked units) wholly within No Man''s Land.', 5, false, false, null, 1),
    ('Outflank', 'Any Battle Round', 'End of your turn.', 'One or more friendly units (excluding Aircraft and battle-shocked units) are within 6" of one or more battlefield edges and not within your territory.', 3, false, false, null, 0),
    ('Outflank', 'Any Battle Round', 'End of your turn.', 'Two or more friendly units (excluding Aircraft and battle-shocked units) are within 6" of opposite battlefield edges and one or more of those units is not within your territory.', 5, false, false, null, 1),
    ('Beacon', 'Any Battle Round', 'End of your opponent''s turn or the end of the fifth battle round (whichever comes first).', 'Your beacon unit is on the battlefield and not within your deployment zone.', 3, false, false, null, 0),
    ('Beacon', 'Any Battle Round', 'End of your opponent''s turn or the end of the fifth battle round (whichever comes first).', 'Your beacon unit is on the battlefield and not within your territory.', 5, false, false, null, 1),
    ('Cleanse', 'Any Battle Round', 'End of your turn.', 'One objective was cleansed by your army this turn.', 2, false, false, null, 0),
    ('Cleanse', 'Any Battle Round', 'End of your turn.', 'Two or more objectives were cleansed by your army this turn.', 5, false, false, null, 1),
    ('A Grievous Blow', 'Any Battle Round', 'End of a turn.', 'For each enemy unit with a starting strength of 13+ destroyed this turn.', 4, true, false, 'fixed', 0),
    ('A Grievous Blow', 'Any Battle Round', 'End of a turn.', 'One or more enemy units with a starting strength of 13+ were destroyed this turn.', 5, false, false, 'tactical', 1),
    ('Defend Stronghold', 'Second Battle Round Onwards', 'End of your opponent''s turn or the end of the fifth battle round (whichever comes first).', 'You control your home objective.', 3, false, false, null, 0),
    ('Defend Stronghold', 'Second Battle Round Onwards', 'End of your opponent''s turn or the end of the fifth battle round (whichever comes first).', 'No enemy units are within your deployment zone.', 2, false, true, null, 1),
    ('Engage on All Fronts', 'Any Battle Round', 'End of your turn.', 'You have a presence in three table quarters.', 2, false, false, 'fixed', 0),
    ('Engage on All Fronts', 'Any Battle Round', 'End of your turn.', 'You have a presence in three table quarters.', 3, false, false, 'tactical', 1),
    ('Engage on All Fronts', 'Any Battle Round', 'End of your turn.', 'You have a presence in four table quarters.', 4, false, false, 'fixed', 2),
    ('Engage on All Fronts', 'Any Battle Round', 'End of your turn.', 'You have a presence in four table quarters.', 5, false, false, 'tactical', 3),
    ('Secure No Man''s Land', 'Any Battle Round', 'End of your turn.', 'You control two or more objectives within No Man''s Land (excluding your home objective).', 5, false, false, null, 0),
    ('Forward Position', 'Any Battle Round', 'End of your turn.', 'You control your opponent''s home objective and/or each expansion objective.', 5, false, false, null, 0),
    ('Centre Ground', 'Any Battle Round', 'End of your turn.', 'One or more friendly units (excluding Aircraft and battle-shocked units) are within 3" of the centre of the battlefield, and no enemy units are within 3" of the centre of the battlefield.', 3, false, false, null, 0),
    ('Centre Ground', 'Any Battle Round', 'End of your turn.', 'One or more friendly units (excluding Aircraft and battle-shocked units) are within 3" of the centre of the battlefield, and no enemy units are within 6" of the centre of the battlefield.', 5, false, false, null, 1),
    ('Assassination', 'Any Battle Round', 'End of a turn.', 'For each enemy Character model destroyed this turn.', 3, true, false, 'fixed', 0),
    ('Assassination', 'Any Battle Round', 'End of a turn.', 'For each of those models with a Wounds characteristic of 4 or more.', 1, true, true, 'fixed', 1),
    ('Assassination', 'Any Battle Round', 'End of a turn.', 'One or more enemy Character models were destroyed this turn, or all enemy Character models have been destroyed during the battle.', 5, false, false, 'tactical', 2),
    ('A Tempting Target', 'Any Battle Round', 'End of your turn.', 'You control your tempting target.', 5, false, false, null, 0),
    ('Behind Enemy Lines', 'Any Battle Round', 'End of your turn.', 'For each friendly unit (excluding Aircraft and battle-shocked units) wholly within your opponent''s deployment zone.', 3, true, false, null, 0),
    ('Bring It Down', 'Any Battle Round', 'End of a turn.', 'For each enemy model with a Wounds characteristic of 10 or more destroyed this turn.', 4, true, false, 'fixed', 0),
    ('Bring It Down', 'Any Battle Round', 'End of a turn.', 'One or more enemy models with a Wounds characteristic of 10 or more were destroyed this turn.', 5, false, false, 'tactical', 1),
    ('Burden of Trust', 'Any Battle Round', 'End of your opponent''s turn or the end of the fifth battle round (whichever comes first).', 'For each objective guarded by your army.', 2, true, false, null, 0)
)
insert into secondary_objective_lines (secondary_objective_id, window_label, when_label, condition_text, vp_value, is_counter, is_cumulative_bonus, mode, sort_order)
select so.id, r.window_label, r.when_label, r.condition_text, r.vp_value, r.is_counter, r.is_cumulative_bonus, r.mode, r.sort_order
from rows r
join secondary_lookup so on so.name = r.secondary_name;

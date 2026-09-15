-- A handful of secondary cards (see the `mode` column on
-- secondary_objective_lines, 20260301000000_objective_lines.sql: 4 of the 18
-- secondaries -- A Grievous Blow, Engage on All Fronts, Assassination, Bring
-- It Down -- have every one of their lines tagged 'fixed' or 'tactical')
-- score differently depending on whether a player is playing Secondary
-- Missions as Fixed picks or Tactical draws. Until now the round screen
-- showed both sets of conditions on those cards at once, distinguished only
-- by a "(fixed)"/"(tactical)" label -- misleading, since a player is only
-- ever playing one of the two for the whole game, never both.
--
-- Modeled like Faction/Force Disposition, not like role/turn_order: this is
-- each seat's own choice, not a shared roll-off outcome between the two
-- seats, so no mirroring and no per-game uniqueness constraint -- and, like
-- every other setup field, optional, never required to start, always
-- editable.
alter table game_players
  add column secondary_mode text check (secondary_mode in ('fixed', 'tactical'));

grant update (secondary_mode) on game_players to authenticated;

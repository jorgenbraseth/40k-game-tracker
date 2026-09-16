-- Once a player imports their Faction from a NewRecruit list link (see
-- import-newrecruit-list edge function, issue #86), the link itself is worth
-- keeping around -- it's the actual army list, not just the faction it named.
-- Stored here rather than discarded after the import, so both players (and
-- spectators) can open it from the game summary afterwards.
--
-- Modeled exactly like army_name: each seat's own free-text setup field, no
-- gameplay effect, always optional, always editable, same "whoever can edit
-- this seat's setup can set it" RLS as everything else in PlayerSetupFields
-- (the pre-existing table-wide `grant select, update on game_players` plus
-- game_players' own RLS policies already cover it -- no new grant or policy
-- needed beyond the UPDATE column below, same as secondary_mode's own
-- migration).
--
-- Free text, not validated as a NewRecruit URL specifically: a player could
-- paste a WarOrgan link once #87 lands, or just their own Google Doc/PDF --
-- this column doesn't care, it's a bookkeeping field like army_name, not a
-- re-validation of what import-newrecruit-list already checked once.
alter table game_players
  add column army_list_url text;

grant update (army_list_url) on game_players to authenticated;

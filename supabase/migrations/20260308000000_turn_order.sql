-- "Determine First Turn" is its own roll-off, separate from the one that
-- decides Attacker/Defender (see wahapedia's deployment sequence, step
-- 10: "Roll off: the winner takes the first turn"). Whoever wins it goes
-- first every battle round for the rest of the game -- the "top of
-- round" player, as opposed to "bottom of round" for whoever goes
-- second -- so it's worth recording explicitly, and worth using to
-- decide which player's card renders first in the live Scoreboard.
--
-- Modeled exactly like `role`: a per-seat pick with a partial-looking
-- uniqueness constraint (Postgres never treats two NULLs as equal, so it
-- only bites once both players have actually chosen), nullable so
-- existing games are unaffected, and -- like every other setup field --
-- never required and always editable.
alter table game_players
  add column turn_order text check (turn_order in ('first', 'second')),
  add constraint game_players_game_id_turn_order_key unique (game_id, turn_order);

grant update (turn_order) on game_players to authenticated;

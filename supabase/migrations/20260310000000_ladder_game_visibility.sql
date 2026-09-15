-- Fixes a real bug in the ladder standings shipped in
-- 20260306000000_ladders.sql: fetchLadderStandings (src/lib/queries/ladders.ts)
-- reads games/game_players/game_totals filtered by ladder_id, but every
-- select policy on those tables is participant-only
-- (is_game_participant(game_id)) -- so a viewer only ever saw the rows
-- for games *they themselves* played in, silently missing every game
-- between two other ladder members. A ladder's standings table was
-- therefore wrong (incomplete) for anyone except a player who'd been in
-- every single game on that ladder.
--
-- Fix: any signed-in user can read a *ladder-tagged* game's rows, same
-- openness already chosen for ladders/ladder_members themselves
-- ("ladders are readable by any signed-in user" -- anyone can browse any
-- ladder's member list, so seeing the games/scores that produced its
-- standings is a continuation of that, not a new precedent). An
-- untagged game stays participant-only, unchanged.
--
-- game_totals is `security_invoker`, so it automatically respects
-- whatever these underlying table policies allow -- no separate grant
-- needed there.
create policy "ladder-tagged games are readable by any signed-in user" on games
  for select to authenticated using (ladder_id is not null);

create policy "ladder-tagged games' game_players are readable by any signed-in user" on game_players
  for select to authenticated using (
    exists (select 1 from games where games.id = game_players.game_id and games.ladder_id is not null)
  );

create policy "ladder-tagged games' round_scores are readable by any signed-in user" on round_scores
  for select to authenticated using (
    exists (select 1 from games where games.id = round_scores.game_id and games.ladder_id is not null)
  );

create policy "ladder-tagged games' secondary_scores are readable by any signed-in user" on secondary_scores
  for select to authenticated using (
    exists (select 1 from games where games.id = secondary_scores.game_id and games.ladder_id is not null)
  );

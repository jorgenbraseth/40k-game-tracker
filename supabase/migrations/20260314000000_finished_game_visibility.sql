-- 20260310000000_ladder_game_visibility.sql's scoping -- a game's rows are readable by any
-- signed-in user only if it's tagged to a ladder -- turned out to be narrower than actually
-- wanted: a player's stats page (issue #28) is meant to be open to anyone, not limited to games
-- shared with a ladder in common. Under the old scoping this surfaced as a confusing "no games
-- between you two" empty state on a stranger's stats page even for a real, played (but untagged)
-- game between the viewer and that player.
--
-- Widen visibility to every *finished* game (complete or abandoned), regardless of ladder tag --
-- additive to, not a replacement for, the ladder-tagged policies (those still matter for a
-- lobby/active ladder game, which this doesn't cover: bookkeeping still in progress isn't "stats"
-- yet, so a game keeps needing to actually finish before strangers can see into it).
create policy "finished games are readable by any signed-in user" on games
  for select to authenticated using (status in ('complete', 'abandoned'));

create policy "finished games' game_players are readable by any signed-in user" on game_players
  for select to authenticated using (
    exists (select 1 from games where games.id = game_players.game_id and games.status in ('complete', 'abandoned'))
  );

create policy "finished games' round_scores are readable by any signed-in user" on round_scores
  for select to authenticated using (
    exists (select 1 from games where games.id = round_scores.game_id and games.status in ('complete', 'abandoned'))
  );

create policy "finished games' secondary_scores are readable by any signed-in user" on secondary_scores
  for select to authenticated using (
    exists (select 1 from games where games.id = secondary_scores.game_id and games.status in ('complete', 'abandoned'))
  );

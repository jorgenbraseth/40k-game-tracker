-- Critical scoring bug, present since game_totals was first defined
-- (20260101000002_views.sql, carried forward unchanged into
-- 20260312000000_primary_caps_and_end_of_game.sql): joining round_scores and
-- secondary_scores directly onto game_players in the same query, then summing both, is a
-- classic SQL fan-out -- left joining two one-to-many relationships in a single query produces
-- the *cross product* of their rows per game_player_id, not two independent row sets. A player
-- with 5 round_scores rows and 3 secondary_scores rows got 15 joined rows back, so
-- sum(rs.primary_vp) counted each round's primary_vp once per secondary score (3x inflated) and
-- sum(ss.vp_scored) counted each secondary's vp_scored once per round (5x inflated) -- both
-- totals wrong, by different multipliers, growing worse the more rounds/secondaries a game had.
-- This fed every consumer of game_totals: the live Scoreboard's running-total bar, SummaryPage,
-- History, ladder standings and Elo, and the client-side round/game VP caps (PrimaryScorePanel/
-- SecondaryScores clamp against this same inflated total).
--
-- Fixed by aggregating each table to one row per game_player_id *before* joining, not after --
-- two independent subqueries, each already collapsed to at most one row per player, so joining
-- them onto game_players can no longer multiply anything.
drop view game_totals;
create view game_totals
with (security_invoker = true) as
select
  gp.id as game_player_id,
  gp.game_id,
  gp.seat,
  coalesce(rs.primary_total, 0) as primary_total,
  coalesce(ss.secondary_total, 0) as secondary_total,
  case when gp.painted_bonus then 10 else 0 end as painted_bonus_vp,
  coalesce(rs.primary_total, 0) + coalesce(ss.secondary_total, 0)
    + case when gp.painted_bonus then 10 else 0 end as total_vp
from game_players gp
left join (
  select game_player_id, sum(primary_vp) as primary_total
  from round_scores
  group by game_player_id
) rs on rs.game_player_id = gp.id
left join (
  select game_player_id, sum(vp_scored) as secondary_total
  from secondary_scores
  group by game_player_id
) ss on ss.game_player_id = gp.id;

grant select on game_totals to authenticated;

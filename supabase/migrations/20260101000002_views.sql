-- Derived per-player totals for a game. security_invoker is required so the
-- view is evaluated with the querying user's own RLS, not the view owner's.
create view game_totals
with (security_invoker = true) as
select
  gp.id as game_player_id,
  gp.game_id,
  gp.seat,
  coalesce(sum(rs.primary_vp), 0) as primary_total,
  coalesce(sum(ss.vp_scored), 0) as secondary_total,
  coalesce(sum(rs.primary_vp), 0) + coalesce(sum(ss.vp_scored), 0) as total_vp
from game_players gp
left join round_scores rs on rs.game_player_id = gp.id
left join secondary_scores ss on ss.game_player_id = gp.id
group by gp.id;

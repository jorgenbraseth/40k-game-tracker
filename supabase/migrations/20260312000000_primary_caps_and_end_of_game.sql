-- Real 40k core rules the app has always *labelled* (missions.max_primary_vp,
-- secondary_objectives.max_vp) but never actually enforced: no more than 15VP
-- from primary in a single battle round, no more than 45VP from primary over
-- the whole game, and the same 15-per-round/45-per-game split for secondary.
-- The client now clamps to these (PrimaryScorePanel, SecondaryScores); this
-- migration adds the row-level half of that as defence in depth, matching the
-- existing primary_vp/vp_scored >= 0 checks.
--
-- Also: a handful of mission cards award a few more VP once, checked only at
-- the very end of the game ("End of the Battle" in mission_objective_lines'
-- window_label) rather than in any specific battle round -- there was nowhere
-- to record that, since round_scores/primary_objective_ticks capped
-- battle_round at 5. battle_round 6 is that "End of Game" pseudo-round: same
-- tables, same upsert machinery, just for end-of-battle-only scoring instead
-- of a real battle round (see windowAppliesToRound() client-side for how a
-- line's window_label maps to the round(s), including 6, it can be scored in).
--
-- And the painted-army bonus (+10VP each, if a player's army is painted) is a
-- new concept entirely -- not primary or secondary VP, so its own column
-- rather than folded into either total, entered on that same End of Game
-- screen.

alter table round_scores drop constraint round_scores_battle_round_check;
alter table round_scores add constraint round_scores_battle_round_check check (battle_round between 1 and 6);

alter table primary_objective_ticks drop constraint primary_objective_ticks_battle_round_check;
alter table primary_objective_ticks add constraint primary_objective_ticks_battle_round_check
  check (battle_round between 1 and 6);

-- not valid: enforces the cap on every write from here on without requiring every existing row
-- (from before this cap existed) to already satisfy it, so this can't fail applying to a live
-- database over real game data.
alter table round_scores add constraint round_scores_primary_vp_max check (primary_vp <= 15) not valid;
alter table secondary_scores add constraint secondary_scores_vp_scored_max check (vp_scored <= 15) not valid;

alter table game_players add column painted_bonus boolean not null default false;
grant update (painted_bonus) on game_players to authenticated;

drop view game_totals;
create view game_totals
with (security_invoker = true) as
select
  gp.id as game_player_id,
  gp.game_id,
  gp.seat,
  coalesce(sum(rs.primary_vp), 0) as primary_total,
  coalesce(sum(ss.vp_scored), 0) as secondary_total,
  case when gp.painted_bonus then 10 else 0 end as painted_bonus_vp,
  coalesce(sum(rs.primary_vp), 0) + coalesce(sum(ss.vp_scored), 0)
    + case when gp.painted_bonus then 10 else 0 end as total_vp
from game_players gp
left join round_scores rs on rs.game_player_id = gp.id
left join secondary_scores ss on ss.game_player_id = gp.id
group by gp.id;

grant select on game_totals to authenticated;

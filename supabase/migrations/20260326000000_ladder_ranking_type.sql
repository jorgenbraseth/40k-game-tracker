-- Issue #68: Elo was the only ranking a ladder could use. Adds a per-ladder choice between Elo
-- and Glicko-2 (see issue #26's research writeup for why these two -- Glicko-2 is the better fit
-- for irregular tabletop play since it factors in how established a rating is, Elo is the simpler
-- fallback; TrueSkill/OpenSkill and Massey/Colley were both explicitly ruled out there).
--
-- Standings are already computed live by replaying a ladder's full game history from scratch on
-- every view (never stored, see fetchLadderStandings) -- switching ranking_type is just replaying
-- with a different formula, no migration/backfill of any stored rating needed. Existing ladders
-- default to 'elo', so nothing changes for them until their creator picks something else.
alter table ladders
  add column ranking_type text not null default 'elo' check (ranking_type in ('elo', 'glicko2'));

-- Additive to the column-scoped select/update grants from 20260325000000_ladder_invite_codes.sql
-- -- unlike invite_code, ranking_type isn't sensitive, so it's readable by anyone who can already
-- browse the ladder, and (like name/archived_at) only the creator can change it, via the same
-- existing creator-only update policy.
grant select (ranking_type) on ladders to authenticated;
grant update (ranking_type) on ladders to authenticated;

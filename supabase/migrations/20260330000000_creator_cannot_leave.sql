-- A ladder/tournament's creator could leave it through the same self-service "leave" delete as
-- any other member, even though every other creator-only action (archive, delete, ranking type,
-- regenerating the invite code) is gated on created_by, not membership -- leaving never touched
-- created_by. But LaddersPage/TournamentsPage only render the settings panel (and the code that
-- opens it) for a *current member*, so a creator who left lost the UI path to their own
-- delete/archive controls even though the policies behind them would still have allowed it,
-- effectively stranding the ladder/tournament with no reachable way to manage or remove it. Closed
-- off at the source: a creator's own row in ladder_members/tournament_members is no longer
-- deletable via the self-leave policy. The frontend (LaddersPage.tsx/TournamentsPage.tsx) is
-- updated alongside this to stop offering "Leave" to a creator in the first place, and to show the
-- settings panel to the creator regardless of membership so anyone already stuck in this state
-- from before this migration can still reach delete/archive to recover.
drop policy "users can leave a ladder themselves" on ladder_members;
create policy "users can leave a ladder themselves" on ladder_members
  for delete to authenticated using (
    user_id = auth.uid()
    and not exists (select 1 from ladders where id = ladder_id and created_by = auth.uid())
  );

drop policy "users can leave a tournament themselves" on tournament_members;
create policy "users can leave a tournament themselves" on tournament_members
  for delete to authenticated using (
    user_id = auth.uid()
    and not exists (select 1 from tournaments where id = tournament_id and created_by = auth.uid())
  );

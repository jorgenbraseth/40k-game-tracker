-- Shareable invite links: a member can now share a URL (/ladders/join/<code>) that auto-joins
-- whoever opens it once they're signed in, instead of them having to copy a code into a separate
-- "join a ladder" form. Games already support this shape without any schema change --
-- join_game_by_code (20260307000000_seat_represents_ladder_member.sql) takes just the code, no
-- game id, since join_code is already globally unique -- so /game/join/<code> only needed a
-- client-side route.
--
-- Ladders are different: the existing join_ladder_by_code(p_ladder_id, p_code) needs a ladder id
-- the client doesn't have from a bare link, since invite_code is deliberately not part of the
-- public "browse ladders" read path (see 20260325000000_ladder_invite_codes.sql) -- there's
-- nothing for the client to resolve a ladder id from ahead of calling the RPC. This adds a
-- code-only variant that looks the ladder up itself (invite_code is already unique), leaving the
-- existing p_ladder_id + p_code form in place for the "join this specific ladder I'm already
-- looking at" flow on the Ladders page.
create function join_ladder_by_invite_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ladder_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_ladder_id from ladders where invite_code = upper(trim(p_code));
  if v_ladder_id is null then
    raise exception 'invalid invite link';
  end if;

  insert into ladder_members (ladder_id, user_id) values (v_ladder_id, auth.uid())
  on conflict (ladder_id, user_id) do nothing;

  return v_ladder_id;
end;
$$;

grant execute on function join_ladder_by_invite_code(text) to authenticated;

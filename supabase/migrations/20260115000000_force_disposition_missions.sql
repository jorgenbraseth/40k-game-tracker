-- The 2026-27 Chapter Approved deck replaces the older "both players play
-- the same shared mission" format with an asymmetric one: each player
-- picks a Force Disposition (their detachment's strategic role), and the
-- *pairing* of both players' choices determines which Primary Mission is
-- played. Secondaries are also split into separate Attacker/Defender
-- decks rather than one shared pool.
--
-- The five Force Disposition names below are confirmed from GW's own
-- Warhammer Community announcement, so unlike mission/secondary/
-- deployment names (still placeholder pending the real deck), these are
-- seeded directly in this migration as stable reference data.

create table force_dispositions (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references rulesets(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (ruleset_id, name)
);

alter table force_dispositions enable row level security;

create policy "reference data is publicly readable" on force_dispositions
  for select using (true);

-- Unlike mission/secondary/deployment names (genuinely uncertain,
-- deliberately left to seed.sql), the ruleset and mission pack identity
-- themselves are stable structural metadata, not copyright-sensitive
-- content -- safe to create here, idempotently, so this migration
-- doesn't depend on seed.sql having already run (it hasn't, on a fresh
-- `supabase db reset`: migrations run first). seed.sql's own inserts for
-- these two rows remain harmless no-ops via the same conflict target.
insert into rulesets (id, name, edition, is_current) values
  ('00000000-0000-0000-0000-000000000001', 'Warhammer 40,000 11th Edition', 11, true)
on conflict (id) do nothing;

insert into mission_packs (id, ruleset_id, name, valid_from, is_current) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Chapter Approved 2026-27 (placeholder)', '2026-06-20', true)
on conflict (id) do nothing;

insert into force_dispositions (ruleset_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Take and Hold'),
  ('00000000-0000-0000-0000-000000000001', 'Purge the Foe'),
  ('00000000-0000-0000-0000-000000000001', 'Reconnaissance'),
  ('00000000-0000-0000-0000-000000000001', 'Disruption'),
  ('00000000-0000-0000-0000-000000000001', 'Priority Assets');

-- A primary mission now belongs to an unordered pair of Force
-- Dispositions (both null = generic fallback, not currently used but
-- kept as an escape hatch). Nullable because existing placeholder
-- mission rows predate this column.
alter table missions
  add column force_disposition_a_id uuid references force_dispositions(id),
  add column force_disposition_b_id uuid references force_dispositions(id);

-- Secondary objectives are drawn from a separate deck per role.
alter table secondary_objectives
  add column role text check (role in ('attacker', 'defender'));

-- The primary mission is no longer known at creation time -- it's
-- resolved once both players have picked a Force Disposition, during the
-- waiting room. See resolve_game_mission() below.
alter table games alter column mission_id drop not null;

-- Each player's Force Disposition, chosen in the waiting room.
alter table game_players
  add column force_disposition_id uuid references force_dispositions(id);

-- Attacker/Defender is assigned by the deployment card's roll-off, not
-- by Force Disposition -- players claim a role themselves in the waiting
-- room. The partial-looking uniqueness works because Postgres never
-- treats two NULLs as equal, so it only bites once both players have
-- actually chosen a role.
alter table game_players
  add column role text check (role in ('attacker', 'defender')),
  add constraint game_players_game_id_role_key unique (game_id, role);

-- Resolves and sets games.mission_id once both players have chosen a
-- Force Disposition. Deterministic (lowest mission id wins ties) so
-- concurrent callers from both clients converge on the same pick; the
-- `mission_id is null` guard means only the first successful call
-- actually writes.
create function resolve_game_mission(p_game_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mission_pack_id uuid;
  v_fd_ids uuid[];
  v_mission_id uuid;
begin
  select mission_pack_id into v_mission_pack_id from games where id = p_game_id;

  select array_agg(force_disposition_id order by seat) into v_fd_ids
  from game_players
  where game_id = p_game_id and force_disposition_id is not null;

  if array_length(v_fd_ids, 1) is distinct from 2 then
    return;
  end if;

  select id into v_mission_id
  from missions
  where mission_pack_id = v_mission_pack_id
    and (
      (force_disposition_a_id = v_fd_ids[1] and force_disposition_b_id = v_fd_ids[2])
      or (force_disposition_a_id = v_fd_ids[2] and force_disposition_b_id = v_fd_ids[1])
    )
  order by id
  limit 1;

  if v_mission_id is not null then
    update games set mission_id = v_mission_id where id = p_game_id and mission_id is null;
  end if;
end;
$$;

grant execute on function resolve_game_mission(uuid) to authenticated;

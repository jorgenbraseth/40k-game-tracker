-- Issue #46: one-account bookkeeping (game_players.user_id nullable) plus ladder attribution
-- (game_players.represents_user_id) already let a bookkeeper solo-enter a result on a real
-- ladder member's behalf without that player ever signing in -- but nothing distinguished a
-- self-reported solo result from one both real accounts entered together, so a represented
-- player had no way to confirm (or dispute) a score entered for them.
--
-- A separate table, not a column on game_players: an UPDATE policy can't restrict *which* role
-- may change *which* column on a row multiple existing policies already grant others access to
-- (the bookkeeper already has UPDATE on this same unclaimed seat's other columns via "players can
-- update their own seat, or claim/fill an unclaimed one") -- Postgres RLS policies are ORed
-- together per-row, not scoped per-column, so a verified_at column here would end up writable by
-- the bookkeeper too, defeating the point. A dedicated table's own INSERT policy fully owns who
-- may create a verification row, with no interference from game_players' policies.
--
-- Deliberately scoped to *finished* games only (verifying a still-in-progress score is
-- premature -- the client only ever offers this once a game is complete/abandoned) and to a seat
-- that's still unclaimed-and-attributed (represents_user_id set, user_id still null) -- if that
-- player later joins for real via the join code, they're a full participant who can just edit
-- the score directly, verification no longer means anything for that seat.
--
-- No backfill for games solo-entered before this existed: they'll show as unverified same as any
-- other qualifying game rather than fabricating a "verified_by" that was never actually asked.
-- game_id is redundant with game_players.game_id (reachable via game_player_id) but kept as its
-- own column so the client can fetch a game's verifications in the same parallel batch as
-- everything else fetchGameDetail loads, instead of a second round trip that has to wait on
-- game_players resolving player ids first. The insert policy below checks it against the seat's
-- actual game_id, so it can never actually diverge.
create table game_player_verifications (
  game_player_id uuid primary key references game_players(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  verified_by uuid not null references profiles(id),
  verified_at timestamptz not null default now()
);

create index game_player_verifications_game_id_idx on game_player_verifications(game_id);

alter table game_player_verifications enable row level security;

-- Visibility of a verification row rides entirely on whether the caller can already see the
-- game_players row it's about -- that row's own RLS (participant, or finished-games visibility)
-- applies transparently to the EXISTS subquery below, so this needs no visibility logic of its own.
create policy "verifications are readable by anyone who can see the seat" on game_player_verifications
  for select to authenticated using (
    exists (select 1 from game_players gp where gp.id = game_player_verifications.game_player_id)
  );

create policy "the represented player may verify their own unclaimed seat" on game_player_verifications
  for insert to authenticated
  with check (
    verified_by = auth.uid()
    and exists (
      select 1 from game_players gp
      join games g on g.id = gp.game_id
      where gp.id = game_player_verifications.game_player_id
        and gp.game_id = game_player_verifications.game_id
        and gp.represents_user_id = auth.uid()
        and gp.user_id is null
        and g.status in ('complete', 'abandoned')
    )
  );

grant select, insert on game_player_verifications to authenticated;

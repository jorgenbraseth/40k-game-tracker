-- Tactical secondaries are drawn cumulatively, not scored per-round from
-- scratch: each round a player draws 2 new cards, and in any round they
-- may score any not-yet-scored secondary drawn *so far this game* (not
-- just this round). secondary_scores already models "scored" correctly
-- (one row per secondary a player actually banked VP for, tagged with
-- the round it happened in) -- what's been missing is "drawn": there was
-- no record of which secondaries a player has even seen yet, so the
-- picker could only offer "not scored this round" instead of "drawn and
-- still unscored, from any round".
create table secondary_draws (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  game_player_id uuid not null references game_players(id) on delete cascade,
  secondary_objective_id uuid not null references secondary_objectives(id),
  battle_round int not null check (battle_round between 1 and 5),
  drawn_by uuid references profiles(id),
  drawn_at timestamptz not null default now(),
  -- A given secondary can only be drawn once per player per game -- no
  -- re-drawing the same card.
  unique (game_player_id, secondary_objective_id)
);

create index secondary_draws_game_id_idx on secondary_draws(game_id);
create index secondary_draws_game_player_id_idx on secondary_draws(game_player_id);

alter table secondary_draws enable row level security;

create policy "participants can read secondary_draws in their games" on secondary_draws
  for select to authenticated using (is_game_participant(game_id));

create policy "participants can insert secondary_draws in their games" on secondary_draws
  for insert to authenticated
  with check (
    is_game_participant(game_id)
    and drawn_by = auth.uid()
    and game_player_belongs_to_game(game_player_id, game_id)
  );

-- Deletable so a bookkeeper can undo a mis-drawn card, same
-- "players agree at the table" reasoning as secondary_scores' delete
-- policy. The client only offers this for a draw that hasn't been
-- scored yet (see SecondaryScores.tsx) -- nothing here needs to enforce
-- that server-side, since an orphaned score with no matching draw row
-- still just reads as "scored", which is harmless.
create policy "participants can delete secondary_draws in their games" on secondary_draws
  for delete to authenticated using (is_game_participant(game_id));

grant select, insert, delete on secondary_draws to authenticated;

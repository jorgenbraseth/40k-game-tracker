-- Row Level Security. The anon key ships in the client bundle by design --
-- every security guarantee here comes from these policies, not from
-- hiding the key. Assume a hostile client.

alter table rulesets enable row level security;
alter table mission_packs enable row level security;
alter table missions enable row level security;
alter table deployments enable row level security;
alter table secondary_objectives enable row level security;
alter table factions enable row level security;
alter table profiles enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table round_scores enable row level security;
alter table secondary_scores enable row level security;
alter table join_attempts enable row level security;

-- Reference data: readable by anyone (including signed-out visitors on the
-- landing/create-game preview), writable only via migrations.
create policy "reference data is publicly readable" on rulesets for select using (true);
create policy "reference data is publicly readable" on mission_packs for select using (true);
create policy "reference data is publicly readable" on missions for select using (true);
create policy "reference data is publicly readable" on deployments for select using (true);
create policy "reference data is publicly readable" on secondary_objectives for select using (true);
create policy "reference data is publicly readable" on factions for select using (true);

-- profiles
create policy "profiles are readable by any signed-in user" on profiles
  for select to authenticated using (true);

create policy "users can update their own profile" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- games
create policy "participants can read their games" on games
  for select to authenticated using (is_game_participant(id));

create policy "authenticated users can create games" on games
  for insert to authenticated with check (created_by = auth.uid());

create policy "participants can update their games" on games
  for update to authenticated using (is_game_participant(id)) with check (is_game_participant(id));

-- game_players
-- No insert policy: joining a game goes exclusively through the
-- join_game_by_code / create_game RPCs (security definer), never a direct
-- client insert.
create policy "participants can read game_players in their games" on game_players
  for select to authenticated using (is_game_participant(game_id));

create policy "players can update their own seat" on game_players
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- round_scores -- either player may enter either seat's score (players
-- agree scores verbally at the table); updated_by is recorded and shown.
create policy "participants can read round_scores in their games" on round_scores
  for select to authenticated using (is_game_participant(game_id));

create policy "participants can insert round_scores in their games" on round_scores
  for insert to authenticated
  with check (is_game_participant(game_id) and updated_by = auth.uid());

create policy "participants can update round_scores in their games" on round_scores
  for update to authenticated
  using (is_game_participant(game_id))
  with check (is_game_participant(game_id) and updated_by = auth.uid());

-- secondary_scores
create policy "participants can read secondary_scores in their games" on secondary_scores
  for select to authenticated using (is_game_participant(game_id));

create policy "participants can insert secondary_scores in their games" on secondary_scores
  for insert to authenticated
  with check (is_game_participant(game_id) and updated_by = auth.uid());

create policy "participants can update secondary_scores in their games" on secondary_scores
  for update to authenticated
  using (is_game_participant(game_id))
  with check (is_game_participant(game_id) and updated_by = auth.uid());

-- join_attempts: users can see their own history, nothing else. Rows are
-- written only by the join_game_by_code RPC.
create policy "users can read their own join attempts" on join_attempts
  for select to authenticated using (user_id = auth.uid());

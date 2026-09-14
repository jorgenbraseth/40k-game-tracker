-- Game data: profiles, games, game_players, round_scores, secondary_scores.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up (Google or
-- email/password both land here).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table games (
  id uuid primary key default gen_random_uuid(),
  join_code text unique not null,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'complete', 'abandoned')),
  mission_pack_id uuid not null references mission_packs(id),
  mission_id uuid not null references missions(id),
  deployment_id uuid not null references deployments(id),
  points_limit int not null,
  total_rounds int not null default 5,
  current_round int not null default 1,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  outcome text check (outcome in ('seat_1', 'seat_2', 'draw'))
);

create index games_join_code_idx on games(join_code);
create index games_created_by_idx on games(created_by);

create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references profiles(id),
  seat int not null check (seat in (1, 2)),
  faction_id uuid references factions(id),
  army_name text,
  is_ready boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, seat),
  unique (game_id, user_id)
);

create index game_players_game_id_idx on game_players(game_id);
create index game_players_user_id_idx on game_players(user_id);

create table round_scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  game_player_id uuid not null references game_players(id) on delete cascade,
  battle_round int not null check (battle_round between 1 and 5),
  primary_vp int not null default 0 check (primary_vp >= 0),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (game_player_id, battle_round)
);

create index round_scores_game_id_idx on round_scores(game_id);
create index round_scores_game_player_id_idx on round_scores(game_player_id);

create table secondary_scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  game_player_id uuid not null references game_players(id) on delete cascade,
  battle_round int not null check (battle_round between 1 and 5),
  secondary_objective_id uuid not null references secondary_objectives(id),
  vp_scored int not null default 0 check (vp_scored >= 0),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (game_player_id, battle_round, secondary_objective_id)
);

create index secondary_scores_game_id_idx on secondary_scores(game_id);
create index secondary_scores_game_player_id_idx on secondary_scores(game_player_id);

-- Abuse visibility for the join-by-code flow (see join_game_by_code RPC).
create table join_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  code_attempted text not null,
  success boolean not null,
  reason text,
  created_at timestamptz not null default now()
);

create index join_attempts_user_id_idx on join_attempts(user_id);

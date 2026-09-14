# Warhammer 40,000 Game Tracker — Build Plan

**Status:** approved plan, ready to execute
**Intended use:** hand this to the implementing model/session as the source of truth.

---

## 1. What we're building

A public web app where two players track a game of Warhammer 40,000
together in real time. One player creates a game and shares a short code;
the opponent joins; both score primary and secondary objectives round by
round on their own phones and see each other's updates live.

After the game, both players get history, win/loss records, and
breakdowns by faction and mission.

**Non-negotiables from the interview:**

- Public sign-up, anyone can use it
- Login via Google **or** email/password
- Live score sync between the two players
- Join an existing game via a shared code
- Primary + secondary scoring, per battle round
- The app knows the actual missions, deployments and secondary objectives
- Game history, faction/army tracking, mission + deployment tracking, win/loss stats
- Players only — no spectator access
- Code on GitHub, merge to `main` deploys to production
- Serverless backend
- React, **not** Next.js
- MVP quality: real users, not a throwaway prototype

---

## 2. Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript (strict) | React without Next, as requested. Vite gives a static SPA build that deploys anywhere. |
| Routing | React Router | Standard for a Vite SPA. |
| Server state | TanStack Query | Caching, optimistic updates, automatic refetch on reconnect — all of which matter at a table with bad wifi. |
| Styling | Tailwind CSS | Fast to build a mobile-first UI. |
| Validation | Zod | Shared shapes between forms and DB responses. |
| Backend | **Supabase** (hosted Postgres) | No servers to run. Auth, database, realtime and row-level security in one product. |
| Auth | Supabase Auth — Google OAuth + email/password | Both requested login methods are first-party features. |
| Realtime | Supabase Realtime (Postgres Changes + Presence) | Live sync without operating a WebSocket server. |
| Hosting | Cloudflare Pages | Free tier, global CDN, clean GitHub Actions integration. Netlify or Vercel work identically if preferred. |
| CI/CD | GitHub Actions | Required by the brief. |
| Tests | Vitest + React Testing Library | Playwright optional, post-MVP. |

### Why not "real" serverless functions with WebSockets

Lambda-style functions can't hold persistent connections, so a raw
WebSocket setup (API Gateway WebSocket + Lambda + DynamoDB, or Cloudflare
Durable Objects) means writing and operating connection registry, fan-out
and reconnection logic yourself. Supabase Realtime is a managed service
that does this over WebSockets already, and it enforces row-level
security on the stream. It's still serverless in the sense that matters:
nothing to provision, patch or scale.

If you later need server-side logic (scheduled jobs, webhooks, ELO
recalculation), add Supabase Edge Functions. Don't add them in v1.

---

## 3. Ruleset versioning — read this before designing tables

40k rotates its mission content. 11th edition launched 20 June 2026 with
the Chapter Approved 2026-27 Mission Deck; a 2027-28 deck will follow, and
12th edition eventually after that.

**Therefore: missions, deployments, secondary objectives and factions are
versioned reference data in the database, never constants in the
codebase.**

Every finished game stores a foreign key to the *specific* mission pack it
was played under. When the next Chapter Approved drops, you insert a new
`mission_packs` row and its children. Old games keep pointing at the old
pack and their history stays correct. No migration of user data, no
rewriting of stats.

**Content note:** store objective **names, categories and VP values**
only. Do not copy the full rules text of GW's cards into the repo or the
database — that's their copyrighted material. Names and point values are
what a scoring app needs; players have the physical cards for the rules
text. Include a short attribution line in the footer noting the app is
unofficial and not endorsed by Games Workshop.

---

## 4. Data model

All tables in the `public` schema. All have RLS enabled. UUID primary
keys via `gen_random_uuid()`.

### Reference data (seeded, read-only to users)

```sql
rulesets (
  id, name,                    -- 'Warhammer 40,000 11th Edition'
  edition int,                 -- 11
  is_current bool
)

mission_packs (
  id, ruleset_id, name,        -- 'Chapter Approved 2026-27'
  valid_from date, valid_to date,
  is_current bool
)

missions (
  id, mission_pack_id, name,
  max_primary_vp int
)

deployments (
  id, mission_pack_id, name
)

secondary_objectives (
  id, mission_pack_id, name,
  category text,               -- e.g. 'fixed' / 'tactical'
  max_vp int
)

factions (
  id, ruleset_id, name,
  parent_faction_id uuid null  -- lets Blood Angels hang off Space Marines
)
```

### Game data

```sql
profiles (
  id uuid pk references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
)
-- populated by a trigger on auth.users insert

games (
  id uuid pk,
  join_code text unique not null,
  status text not null check (status in ('lobby','active','complete','abandoned')),
  mission_pack_id, mission_id, deployment_id,
  points_limit int,                    -- 1000 / 2000 / etc
  total_rounds int not null default 5,
  current_round int not null default 1,
  created_by uuid references profiles(id),
  created_at, started_at, ended_at timestamptz,
  outcome text check (outcome in ('seat_1','seat_2','draw'))
)

game_players (
  id uuid pk,
  game_id uuid references games(id) on delete cascade,
  user_id uuid references profiles(id),
  seat int not null check (seat in (1,2)),
  faction_id uuid references factions(id),
  army_name text,
  is_ready bool default false,
  unique (game_id, seat),
  unique (game_id, user_id)
)

round_scores (
  id uuid pk,
  game_id uuid references games(id) on delete cascade,   -- denormalised on purpose
  game_player_id uuid references game_players(id) on delete cascade,
  battle_round int not null check (battle_round between 1 and 5),
  primary_vp int not null default 0,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now(),
  unique (game_player_id, battle_round)
)

secondary_scores (
  id uuid pk,
  game_id uuid references games(id) on delete cascade,   -- denormalised on purpose
  game_player_id uuid references game_players(id) on delete cascade,
  battle_round int not null check (battle_round between 1 and 5),
  secondary_objective_id uuid references secondary_objectives(id),
  vp_scored int not null default 0,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now(),
  unique (game_player_id, battle_round, secondary_objective_id)
)
```

`game_id` is duplicated onto both score tables deliberately. It makes RLS
policies a single cheap lookup and lets Realtime filter the stream with
`game_id=eq.<uuid>` without a join.

### Derived totals

```sql
create view game_totals with (security_invoker = true) as
select
  gp.id as game_player_id,
  gp.game_id,
  gp.seat,
  coalesce(sum(rs.primary_vp), 0)   as primary_total,
  coalesce(sum(ss.vp_scored), 0)    as secondary_total,
  coalesce(sum(rs.primary_vp), 0) + coalesce(sum(ss.vp_scored), 0) as total_vp
from game_players gp
left join round_scores rs on rs.game_player_id = gp.id
left join secondary_scores ss on ss.game_player_id = gp.id
group by gp.id;
```

`security_invoker = true` is required, otherwise the view bypasses RLS.

---

## 5. Security model

The Supabase anon key ships in the client bundle. That is by design —
**every security guarantee comes from RLS**, not from hiding the key.
Assume a hostile client and write policies accordingly.

### Policies

- `profiles` — anyone authenticated can `select`; you can only `update`
  your own row.
- `games` — `select` only if you are a participant. `insert` only with
  `created_by = auth.uid()`. `update` only if participant.
- `game_players` — `select` if you're in the same game. Direct `insert`
  is **denied**; joining goes through an RPC (below).
- `round_scores` / `secondary_scores` — `select`, `insert`, `update` only
  if `auth.uid()` is a participant in that `game_id`.
- Reference tables — `select` for all; no write policy at all (seeded by
  migration).

Helper, used by most policies:

```sql
create function is_game_participant(p_game_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from game_players
    where game_id = p_game_id and user_id = auth.uid()
  );
$$;
```

### The join-by-code problem

A player who hasn't joined yet cannot `select` the game — that's exactly
what the RLS policy forbids — so they can't look it up by code from the
client. Solve it with one `security definer` RPC:

```sql
create function join_game_by_code(p_code text) returns uuid
```

It must, atomically:

1. Normalise the code (uppercase, trim).
2. Find a game with that code **and** `status = 'lobby'`. Anything else →
   error.
3. Reject if the game already has 2 players, or if the caller is already
   in it (return the existing `game_id` in that case, so a refresh is
   idempotent).
4. Insert the `game_players` row at the free seat.
5. Return the `game_id`.

Take a row lock (`select ... for update`) so two people racing for the
last seat can't both win.

### Join codes

- 6 characters, uppercase, from an alphabet excluding `0 O 1 I L` —
  people read these aloud across a table.
- Generated server-side in the `create_game` RPC, retry on unique
  violation.
- Only usable while `status = 'lobby'`. Once the game starts, the code is
  dead. This is the main brute-force mitigation: the attack window is
  minutes, and the payload is someone's game of toy soldiers.
- Log failed join attempts with the caller's user id so abuse is visible
  later.

---

## 6. Realtime design

Enable replication on the four mutable tables:

```sql
alter publication supabase_realtime
  add table games, game_players, round_scores, secondary_scores;
```

Turn on RLS enforcement for Realtime in the Supabase dashboard, so the
stream honours the same policies as queries.

**Client pattern:** one channel per game, subscribed on entering the game
screen and torn down on leave.

```
channel: `game:${gameId}`
  - postgres_changes on round_scores      filter game_id=eq.${gameId}
  - postgres_changes on secondary_scores  filter game_id=eq.${gameId}
  - postgres_changes on game_players      filter game_id=eq.${gameId}
  - postgres_changes on games             filter id=eq.${gameId}
  - presence: { userId, displayName }
```

Each event invalidates the matching TanStack Query key rather than
patching cache by hand. Simpler, and self-healing if an event is missed.

**Presence** drives an "opponent connected" dot in the header. Cheap to
add, and it's the single clearest signal to a user that live sync is
actually working.

**Conflicts:** last write wins on the unique row. Two people editing the
same cell simultaneously is vanishingly rare in this domain and not worth
CRDTs. Do record `updated_by` and `updated_at` and surface "edited by
<name>" in the UI so a surprise change is explicable.

**Optimistic updates:** apply locally, roll back on error, toast the
failure.

**Reconnection:** Supabase Realtime reconnects automatically; on
`SUBSCRIBED` after a drop, invalidate all game queries to resync. Also
refetch on `window` focus and on `navigator.onLine`.

---

## 7. App structure

```
/src
  /app            router, providers, error boundary
  /features
    /auth         login, signup, OAuth callback, session hook
    /lobby        create game, join by code, waiting room
    /game         live scoreboard, round stepper, secondary picker
    /history      past games list + detail
    /stats        win-loss, by faction, by mission
    /profile      display name, avatar
  /components     shared primitives (Button, Sheet, Stepper, ScoreCell)
  /lib
    supabase.ts   client singleton
    queries/      typed query + mutation hooks
    realtime/     useGameChannel, usePresence
    types.ts      generated from `supabase gen types typescript`
/supabase
  /migrations     numbered SQL, checked in
  /seed           reference data: ruleset, mission pack, missions,
                  deployments, secondary objectives, factions
/.github/workflows
  ci.yml
  deploy.yml
```

### Routes

| Route | Purpose |
|---|---|
| `/` | Landing + login |
| `/auth/callback` | OAuth redirect target |
| `/home` | Active game (if any), start, join, recent games |
| `/game/new` | Pick mission pack, mission, deployment, points limit, your faction |
| `/game/join` | Enter code |
| `/game/:id` | Waiting room or live scoreboard, depending on status |
| `/game/:id/summary` | Final result |
| `/history` | All past games |
| `/stats` | Aggregates |
| `/profile` | Account settings |

### UI priorities

This is used **on a phone, on a table, mid-game, one-handed, often with
dice in the other hand.**

- Mobile-first. Design at 380px and scale up.
- The live scoreboard must show both players' running totals without
  scrolling.
- Score entry is tap-to-increment with a long-press or sheet for direct
  entry. No tiny number inputs.
- Use the Wake Lock API to keep the screen on during an active game.
- Handle empty, loading, offline and error states explicitly — this is
  the difference between MVP and prototype.

Consult the `frontend-design` skill before building UI.

---

## 8. Environments and CI/CD

### Environments

- **Local:** `supabase start` runs the full stack in Docker. Migrations
  and seed apply automatically.
- **Production:** one hosted Supabase project.
- Add a staging project later if it starts hurting. Not needed for v1.

### Configuration

Build-time vars (public, safe to expose):
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

GitHub Actions secrets:
```
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_REF
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The service-role key must never appear in the frontend, the repo, or CI
for the frontend build.

### `ci.yml` — on pull request

`install → typecheck → lint → unit tests → build`. Branch protection on
`main` requires this green.

### `deploy.yml` — on push to `main`

1. Install, typecheck, test, build
2. `supabase link --project-ref $SUPABASE_PROJECT_REF`
3. `supabase db push` — apply pending migrations
4. Deploy `dist/` to Cloudflare Pages

**Migrations run before the frontend deploy.** During the gap, the old
frontend is live against the new schema, so migrations must be
backward-compatible: add columns, don't rename or drop them in the same
release. Use expand-then-contract across two releases for any breaking
change.

### Supabase Auth setup (manual, one time)

- Create Google OAuth credentials in Google Cloud Console.
- Add client ID/secret to Supabase → Auth → Providers → Google.
- Set Site URL and add redirect URLs for production and
  `http://localhost:5173`.
- Enable email/password; decide whether to require email confirmation
  (recommended: yes for a public app).

---

## 9. Build order

Each milestone ends deployable and green.

| # | Milestone | Done when |
|---|---|---|
| M0 | Scaffold | Vite + TS + Tailwind + Router running; CI passing; deploys to Cloudflare Pages on merge |
| M1 | Auth | Google and email login work; `profiles` row auto-created; protected routes; session persists |
| M2 | Schema | All migrations + RLS policies + seed data applied; generated TS types committed |
| M3 | Create & join | Create a game, get a code, second account joins via code, both see the waiting room |
| M4 | Live scoring | Round-by-round primary + secondary entry; both clients update live; presence indicator |
| M5 | Finish & history | End game, compute outcome, summary screen, history list and detail |
| M6 | Stats | Win/loss overall, by faction, by mission, by opponent |
| M7 | Polish | Mobile pass, wake lock, offline/reconnect handling, empty and error states, unofficial-fan-project footer |

Recommend a security review after M3 — try to read another user's game
with a second account before building anything on top of the policies.

---

## 10. Assumptions made

Flag any of these that are wrong before building.

1. **Two players per game.** No teams, no multiplayer free-for-all.
2. **Either player can edit either score.** Players agree scores verbally
   at the table; making you edit only your own column creates friction.
   `updated_by` is recorded and shown. Easy to tighten to own-column-only
   if you disagree.
3. **Login required.** No guest/anonymous games in v1.
4. **5 battle rounds**, with the ability to end a game early (concession
   or time).
5. **Draws are possible** and recorded as such.
6. **A game counts toward stats as soon as it's marked complete** — no
   two-player confirmation step.
7. Seed data targets **11th edition / Chapter Approved 2026-27**. You'll
   need to source the mission, deployment and secondary objective names
   from your own copy of the deck.

## 11. Explicitly out of scope for v1

Spectator mode · tournaments and events · army list builder or import ·
ELO/ranking · in-app chat · push notifications · rematch chains · CP/
painting scoring beyond primary+secondary · offline-first with local
write queue · native apps.

---

## 12. First thing to do

Before writing code: create the Supabase project and the Google OAuth
credentials. Everything in M1 is blocked on those, and they're the only
steps a model can't do for you.

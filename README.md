# 40K Tracker

A public web app for two players to track a game of Warhammer 40,000
together in real time: create a game, share a short code, and score
primary and secondary objectives round by round on your own phones with
live sync. Afterwards, get history, win/loss records, and breakdowns by
faction and mission.

Unofficial fan project. Not affiliated with, endorsed, sponsored, or
specifically approved by Games Workshop Limited.

See [`40k-tracker-plan.md`](./40k-tracker-plan.md) for the full design and
rationale this build follows.

## Stack

Vite + React + TypeScript (strict), React Router, TanStack Query, Tailwind
CSS, Zod, and Supabase (Postgres + Auth + Realtime) as the serverless
backend. Deployed to Cloudflare Pages via GitHub Actions.

## Getting started

### 1. Prerequisites

- Node 22+
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (for local dev and migrations)
- Docker (the Supabase CLI runs the local stack in containers)

### 2. Local Supabase stack

```bash
supabase start
```

This applies everything in `supabase/migrations` and `supabase/seed.sql`
automatically. Note the `API URL` and `anon key` it prints.

### 3. Frontend env

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from `supabase start` output
```

### 4. Run it

```bash
npm install
npm run dev
```

### Google sign-in locally

Google OAuth needs real credentials even for local dev:

1. Create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add the local Supabase auth callback as an authorized redirect URI
   (`supabase status` shows the local API URL; the callback is
   `<API URL>/auth/v1/callback`).
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars before
   `supabase start` (see `supabase/config.toml` `[auth.external.google]`),
   and flip `enabled = true` there.

Email/password sign-in works out of the box against the local stack
(Inbucket, printed by `supabase status`, catches confirmation emails).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | `oxlint` |
| `npm run test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run build` | Typecheck + production build |

## Project structure

```
/src
  /app            router, providers, layout, error boundary
  /features        auth, lobby, game, history, stats, profile
  /components      shared UI primitives
  /lib             supabase client, generated types, query hooks, realtime hooks
/supabase
  /migrations      numbered SQL, applied in order
  seed.sql         reference data (missions, deployments, secondaries, factions -- force_dispositions is seeded by migration, not here)
  config.toml      local dev config (`supabase start`)
/.github/workflows
  ci.yml           typecheck + lint + test + build, on every PR
  deploy.yml       migrate + build + deploy to Cloudflare Pages, on push to main
```

## Ruleset / mission content

Missions, deployments, secondary objectives, factions and Force
Dispositions are versioned reference data (`mission_packs` and its
children), never hardcoded -- see the comment at the top of
`supabase/migrations/20260101000000_reference_tables.sql`. When a new
Chapter Approved deck ships, add a new `mission_packs` row and its
children in a new migration; existing games keep pointing at the pack
they were played under.

The 2026-27 deck's Primary Mission is **asymmetric**: each player picks a
Force Disposition (`force_dispositions` -- the five real, GW-confirmed
role names: Take and Hold, Purge the Foe, Reconnaissance, Disruption,
Priority Assets), and the *pairing* of both players' choices determines
which `missions` row applies (`missions.force_disposition_a_id`/`_b_id`,
resolved by the `resolve_game_mission` RPC once both players have picked,
in the waiting room). Secondary objectives are also split into separate
Attacker/Defender decks (`secondary_objectives.role`) rather than one
shared pool. See `supabase/migrations/20260115000000_force_disposition_missions.sql`.

**The seed data in `supabase/seed.sql` is placeholder content**, not
transcribed from GW's actual Chapter Approved 2026-27 deck (that's their
copyrighted rules text -- this repo only ever stores objective names,
categories and VP values, never rules text). It seeds exactly one
placeholder Primary Mission per Force Disposition pairing (15 total) so
every combination resolves to *something*; the real deck has 30 primary
mission cards, so there's likely more than one option per pairing for
variety that this simplified stand-in doesn't capture. Replace it with
the real names/values from your own copy of the current deck before
relying on this for real games -- `seed.sql` is safe to re-run after
editing (it clears its own previously-seeded missions/deployments/
secondary_objectives first). It's applied automatically for local dev
only; it does not run in `deploy.yml` -- seed production reference data
once, deliberately, after review.

## Deployment

`deploy.yml` runs on every push to `main`: typecheck, test, build,
`supabase db push` against the linked project, then deploy `dist/` to
Cloudflare Pages. It expects these repository secrets:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_REF
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The service-role key is never used by the frontend, the repo, or this
workflow.

**Before the first deploy**, you need to create the actual Supabase
project and the production Google OAuth client by hand -- see
"First thing to do" in `40k-tracker-plan.md`. Everything else in this repo
is ready to run once those exist and the secrets above are set.

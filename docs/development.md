# Development

> Stack, local setup, scripts, and project layout. Back to the
> [README](../README.md).

## Stack

- Vite + React + TypeScript (strict)
- React Router, TanStack Query, Tailwind CSS, Zod
- `vite-plugin-pwa` (installability -- see
  [status.md](./status.md#installable-pwa))
- Supabase (Postgres + Auth + Realtime) as the serverless backend
- Deployed to Cloudflare Pages via GitHub Actions -- see
  [deployment.md](./deployment.md)

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

Email/password sign-in works out of the box against the local stack
(Inbucket, printed by `supabase status`, catches confirmation emails).

Google OAuth needs real credentials even for local dev:

1. Create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add the local Supabase auth callback as an authorized redirect URI
   (`supabase status` shows the local API URL; the callback is
   `<API URL>/auth/v1/callback`).
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars before
   `supabase start` (see `supabase/config.toml` `[auth.external.google]`),
   and flip `enabled = true` there.

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
  /features        auth, lobby, game, history, ladders, stats, profile
  /components      shared UI primitives
  /lib             supabase client, generated types, query hooks, realtime hooks
/supabase
  /migrations      numbered SQL, applied in order
  seed.sql         reference data (missions, deployments, secondaries, factions -- force_dispositions is seeded by migration, not here)
  config.toml      local dev config (`supabase start`)
/.github/workflows
  ci.yml           typecheck + lint + test + build, on every PR
  deploy.yml       migrate + build + deploy to Cloudflare Pages, on push to main
/docs              product and developer documentation (start at README.md)
```

## Rules to follow when changing things

These live in [`CLAUDE.md`](../CLAUDE.md) and apply to every change:

- **Keep the docs current.** [goal.md](./goal.md) and
  [status.md](./status.md) must stay accurate after every change that
  affects them.
- **Migrations must stay compatible with released native app builds**
  (expand-then-contract; `scripts/check-migration-compat.sh` is the CI
  tripwire).
- **In-page view state belongs in the URL.**

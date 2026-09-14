# 40K Tracker

**Live app:** https://40k-game-tracker-bca.pages.dev
**Repo:** https://github.com/jorgenbraseth/40k-game-tracker

Unofficial fan project. Not affiliated with, endorsed, sponsored, or
specifically approved by Games Workshop Limited.

See [`40k-tracker-plan.md`](./40k-tracker-plan.md) for the full original
design brief and rationale this build follows.

## What this is (the goal)

40K Tracker is a public web app to track a game of Warhammer 40,000 in
real time, from the table -- solo (one player runs the whole scoreboard,
both sides) or shared live between two players' own phones.

**The intended experience, end to end:**

- Anyone can sign up -- with Google or with email/password. No invite
  needed, no spectator mode, players only. Signing up registers a display
  name (editable any time from Profile) that's what other players see in
  the waiting room, live scoreboard, and history/stats -- their email
  address is never shown to, or sent to, anyone else.
- One player starts a game (mission pack, deployment, points limit,
  their own faction and army name) and gets a short 6-character code.
- **A single player can completely track a game alone.** The creator
  fills in Player 2's setup themselves in the waiting room -- same
  Force Disposition/faction/army/role fields as their own -- and can
  start and run the whole game solo, entering both sides' scores round
  by round. Sharing the join code is optional: if a second player does
  enter it, they're simply added as another person who can also adjust
  either side's numbers, the same as if they'd been there from the
  start -- not a required step to use the app.
- Whoever fills in each side's setup claims their own Force Disposition
  (their army's strategic role) and either Attacker or Defender -- the
  app explains in-UI what Attacker/Defender actually determines
  (battlefield edge, which Secondary Mission deck you draw from), since
  it's easy to forget between games -- and each side's Primary Mission,
  determined by the *pairing* of both Force Dispositions per the actual
  2026-27 ruleset, is revealed once both are chosen.
- Once the game starts, primary VP and secondary objectives are scored
  round by round (5 battle rounds). With two players each on their own
  phone, scores update live for both as they're entered -- no refreshing,
  no "did you get that?" across the table -- and either one can enter
  either side's score, since players agree scores verbally at the table
  anyway. Tracking solo works the same way, just from one phone.
- The app knows the actual current missions, deployments, and secondary
  objectives for whichever Chapter Approved mission pack is active --
  this isn't a generic point counter, it understands the ruleset. When a
  new mission pack ships, the content updates without breaking the
  history of games played under the old one.
- At the end, either player can close out the game (a winner is
  suggested from the totals, or record a draw), and both players get a
  permanent record of it: a round-by-round breakdown, and it folds into
  their history. A game can also be ended early -- conceded, or the
  opponent had to leave -- from any round, not just the last one.
- **This is a bookkeeping tool, not a guided workflow.** Its job is to
  end up with the correct score, keep a clean round-by-round record of
  primary + secondary VP, and track which objectives were drawn and
  scored each round -- not to police how you got there. Every value a
  player enters -- score, secondary picked, faction, army name, Force
  Disposition, role, even the declared winner -- stays editable for the
  life of the game, including after it's marked complete or abandoned.
  Fat-fingered a tap, picked the wrong secondary, realized your army name
  was wrong three rounds in? Fix it in place, no reset required.
- Over time, each player builds up game history and win/loss stats,
  broken down by faction played, mission, and opponent -- so "how do I do
  against Necrons?" or "what's my record with Orks?" has a real answer
  instead of a memory.
- It's built to be used one-handed, on a phone, mid-game, with dice in
  the other hand -- not at a desk afterward. Large tap targets, no tiny
  number inputs, the screen stays on during an active game, and it copes
  with a flaky venue wifi connection dropping and reconnecting.

**What this deliberately is not (out of scope):** spectator mode,
tournaments/events, an army list builder, ELO/ranking, in-app chat, push
notifications, rematch chains, CP/painting scoring, offline-first play,
or native mobile apps. See section 11 of `40k-tracker-plan.md` for the
full list and reasoning.

## What's actually in place right now

Everything in "the goal" above is implemented and deployed at the live
app URL, with one caveat worth knowing before you rely on it:

- **Google sign-in needs its OAuth client wired up** in the Supabase
  dashboard (Auth → Providers → Google) before it'll work in production;
  email/password sign-in works today without any extra setup.

Mission/deployment/secondary objective names are the real Chapter
Approved 2026-27 deck (names and VP values only, sourced from the public
card text -- see "Ruleset / mission content" below), not placeholder
content.

Solo tracking is implemented: `create_game` seats the creator and also
creates an unclaimed second seat (`game_players.user_id` is nullable) the
creator can fill in and run themselves from the waiting room; joining by
code later claims that same seat rather than adding a third one, and
just grants the joiner the same edit rights the creator already had.

Display names never derive from email: `handle_new_user()`'s fallback
(when a signup provides no name at all) generates a generic placeholder,
never the email's local part, and the signup form requires a display
name for email/password accounts so that fallback is rarely even hit.
Realtime presence -- broadcast to everyone subscribed to a game's channel
-- sends the profile display name, never the raw email, fixed alongside.

Everything else -- auth, live game creation/joining, the Force
Disposition/mission-pairing flow, live round-by-round scoring, realtime
sync, game history, and win/loss stats -- is built, deployed, and
functional today, not aspirational. So is the always-editable bookkeeping
model described above: score/secondary edits apply optimistically (so a
tap shows up immediately, including while offline -- it sends once
back online, no separate offline queue needed) with rollback and an
error toast if a save genuinely fails; ending a game early (concede /
opponent left) works from any round; and `game_players`/`games` state
transitions that used to be enforced only in the UI (starting a game
before both players are ready, cross-game score writes) are now also
checked server-side (`start_game` RPC, RLS).

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

The 2026-27 deck's Primary Mission is **asymmetric per player**, not a
single mission shared by both: each player picks a Force Disposition
(`force_dispositions` -- the five real, GW-confirmed role names: Take and
Hold, Purge the Foe, Reconnaissance, Disruption, Priority Assets), and
then finds their **own** Primary Mission on their **own** Force
Disposition card, indexed by their *opponent's* choice. Two players with
different Force Dispositions therefore play two different Primary
Missions (same 15VP cap, different cards) in the same game --
`game_players.mission_id`, not `games.mission_id`, resolved per-seat by
the `resolve_game_mission` RPC once both players have picked, in the
waiting room. `missions.force_disposition_id` is the mission owner's own
Force Disposition, `missions.opponent_force_disposition_id` is the
opponent's -- an ordered pair, since e.g. Take and Hold-facing-Purge the
Foe and Purge the Foe-facing-Take and Hold are different mission cards.
Secondary objectives are also split into separate Attacker/Defender decks
(`secondary_objectives.role`), though the 18 cards in each are identical.
See `supabase/migrations/20260201000000_asymmetric_primary_missions.sql`.

The real Chapter Approved 2026-27 deck content -- names, Force
Disposition pairings and VP values, sourced from the public card text
and mission generator at
[wahapedia.ru](https://wahapedia.ru/wh40k11ed/the-rules/mission-deck-2026-27/)
(never GW's copyrighted rules text -- how each mission actually scores
turn by turn -- which this repo doesn't and shouldn't store; players read
that off their own copy of the deck) -- lives in
`supabase/migrations/20260221000000_apply_real_reference_data.sql`, **not**
`seed.sql`. Missions and secondary objectives specifically have to be a
migration, not a manual seed step: they were originally only in
`seed.sql` (which deploy.yml deliberately never runs against production,
by design, for review before touching real reference data), and nobody
ran it by hand after the Force Disposition redesign landed -- so
production silently kept the very first scaffold's placeholder missions,
with `force_disposition_id`/`role` left null, and every game's Primary
Mission resolution failed forever, for months, with no error. A migration
can't be forgotten the same way; it runs automatically, every deploy.
`seed.sql` still seeds deployments, factions, and the rulesets/
mission_packs rows themselves (all safe to apply idempotently, unlike
content that needs a clean replace) for local dev.

When the next Chapter Approved deck ships: add a new `mission_packs` row
and a new migration with its missions/secondary_objectives, the same
way -- don't touch the old pack's migration, existing games keep pointing
at it.

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

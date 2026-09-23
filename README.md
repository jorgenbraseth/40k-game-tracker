# 40K Tracker

**Live app:** https://www.40ktracker.com
**Repo:** https://github.com/jorgenbraseth/40k-game-tracker

Unofficial fan project. Not affiliated with, endorsed, sponsored, or
specifically approved by Games Workshop Limited.

A phone-first web app for tracking a game of Warhammer 40,000 live, from
the table. One account can keep score for both sides, or two players can
share a live scoreboard from their own phones. Finished games feed
history, stats and optional ranked ladders.

## At a glance

- **Start, join, or log a game.** Share a 6-character code or a link. A
  game already played elsewhere can be logged with just the final score.
- **No opponent account needed.** One person can bookkeep the whole game.
  A second player joining is optional.
- **Knows the ruleset.** The real Chapter Approved 2026-27 missions,
  Force Disposition pairings, terrain layouts and secondaries.
- **Pick-what-you-achieved scoring.** Tick the mission's scoring
  conditions, with the 15VP-per-round / 45VP-per-game caps applied. Also
  covers Tactical/Fixed secondaries, Command Points, the End of Game step
  and the painted bonus.
- **Always editable.** Every value can be fixed at any time, until both
  players verify the result and lock it.
- **Live sync and spectating.** Scores update for everyone watching.
- **History, stats and ladders.** Win/loss by faction, Force Disposition
  and opponent. Ladders are invite-only and ranked by Elo or Glicko-2.
- **Themes.** Thirteen themes (the original grimdark plus twelve factions), each in light and dark.
- **Installable.** Works as a PWA today. An Android app-store build is in
  progress.

## Status

Everything described in the [goal](./docs/goal.md) is live at the URL above, except:

- **Google sign-in in production** needs its OAuth client set up in the
  Supabase dashboard. Email/password works today.
- **Android app:** the scaffolding works on a real device, but it hasn't
  been published to the store yet (#125). **iOS** hasn't been started
  (#126).

The full details are in [status.md](./docs/status.md#known-caveats).

## Documentation

| Doc | What's in it |
|---|---|
| [**Goal**](./docs/goal.md) | What the app is *for* and how each feature is meant to work (the product vision) |
| [**Status**](./docs/status.md) | What's *true today* and how it's built: tables, migrations, components, and why |
| [**Ruleset content**](./docs/ruleset-content.md) | How mission/deck data is versioned and stored, the copyright exceptions, and how to add the next deck |
| [**Development**](./docs/development.md) | Stack, local setup, scripts, project structure |
| [**Deployment**](./docs/deployment.md) | CI/CD workflows, secrets, Android debug and signed release builds, security headers |
| [`40k-tracker-plan.md`](./40k-tracker-plan.md) | The original design brief and rationale this build follows |
| [`CLAUDE.md`](./CLAUDE.md) | Standing rules for every change (keeping docs current, native-app-safe migrations, view state in the URL) |

> Older code comments and migrations refer to sections of this README
> like "What this is (the goal)", "What's actually in place right now",
> "Ruleset / mission content" and "Publishing a real (signed) Android
> release". Those sections now live in
> [goal.md](./docs/goal.md), [status.md](./docs/status.md),
> [ruleset-content.md](./docs/ruleset-content.md) and
> [deployment.md](./docs/deployment.md#publishing-a-signed-android-release).

## Quick start

```bash
supabase start          # local Postgres/Auth/Realtime; applies migrations + seed
cp .env.example .env    # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Prerequisites, Google sign-in for local dev, and the rest are covered in
[development.md](./docs/development.md).

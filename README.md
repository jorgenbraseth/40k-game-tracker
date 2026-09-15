# 40K Tracker

**Live app:** https://40k-game-tracker-bca.pages.dev
**Repo:** https://github.com/jorgenbraseth/40k-game-tracker

Unofficial fan project. Not affiliated with, endorsed, sponsored, or
specifically approved by Games Workshop Limited.

See [`40k-tracker-plan.md`](./40k-tracker-plan.md) for the full original
design brief and rationale this build follows.

## What this is (the goal)

40K Tracker is a public web app to track a game of Warhammer 40,000 in
real time, from the table. There is no separate "solo mode" -- every
game works the same way: one account can bookkeep the whole scoreboard,
both sides, so a real two-player game never requires the other player to
sign up at all, or the scoreboard can be shared live between two
players' own phones if they'd both rather enter their own numbers.

**The intended experience, end to end:**

- Anyone can sign up -- with Google or with email/password. No invite
  needed, no spectator mode, players only. Signing up registers a display
  name (editable any time from Profile) that's what other players see in
  the waiting room, live scoreboard, and history/stats -- their email
  address is never shown to, or sent to, anyone else.
- One player starts a game (mission pack, deployment, points limit,
  optionally a ladder to tag it to) and gets a short 6-character code.
  Nothing about either player's army goes here -- that's all decided in
  the waiting room next, once both seats actually exist.
- **One account can be the bookkeeper for a whole game.** The point
  isn't a "solo mode" -- it's that getting a real opponent to create an
  account and log in is friction nobody wants mid-game, so it's never
  required. Everyone's setup -- the creator's own included, not just
  Player 2's -- happens in the waiting room, where the creator can also
  fill in Player 2's themselves and run the whole game as bookkeeper,
  entering both sides' scores round by round. Sharing the join code is
  optional: if a second player does enter it, they're simply added as
  another person who can also adjust either side's numbers, the same as
  if they'd been there from the start -- not a required step to use the
  app.
- The waiting room has each seat's own setup (faction, Force Disposition,
  which of Fixed or Tactical they're playing Secondary Missions as, army
  name) side by side, plus one shared **game configuration** section
  below both, covering everything that's a property of the game rather
  than of one seat: terrain layout, and who's Attacker and who went
  first -- none of those are really two people's separate opinions,
  they're one fact decided once (by a roll-off at the table, or picked
  off the mission's recommended layouts) and just entered once, asked by
  name ("[Player 1] or [Player 2]?") rather than shown twice as a toggle
  on each player's own form. Each side's own Force Disposition (their
  army's strategic role) determines their Primary Mission -- the
  *pairing* of both Force Dispositions per the actual 2026-27 ruleset --
  revealed once both are chosen. Attacker/Defender is decided by its own
  roll-off after the Deployment card is drawn -- the app explains in-UI
  what it actually determines: which battlefield edge each side deploys
  from, which Secondary Mission deck each side draws from, and the one
  part with a real rules effect on how the game plays out -- the Defender
  deploys first, then the Attacker deploys second, reacting to it -- since
  it's easy to forget between games. A second, separate roll-off decides
  who takes the first turn -- whoever went first (the "top of round"
  player, as opposed to "bottom of round") shows first on the live
  Scoreboard once both are picked.
- Starting a game requires every one of those setup fields filled in for
  *both* seats -- faction and Force Disposition per seat, plus the shared
  terrain layout, Attacker/Defender, and who-went-first picks -- with one
  deliberate exception: army name, which is flavour text with no
  gameplay effect, stays optional forever. There is no separate "ready"
  step on top of that; once the fields are filled in, either player can
  just start the game.
- Once the game starts, primary VP and secondary objectives are scored
  round by round (5 battle rounds, then an End of Game step -- see
  below). With two players each on their own phone, scores update live
  for both as they're entered -- no refreshing, no "did you get that?"
  across the table -- and either one can enter either side's score,
  since players agree scores verbally at the table anyway. Bookkeeping
  both sides yourself works the same way, just from one phone.
- Scoring is pick-what-you-achieved, not type-a-number: the round
  overview shows a player's primary VP as the actual scoring conditions
  printed on the resolved mission's card, right there -- not hidden
  behind a tap-to-open square -- tap to mark a flat condition achieved,
  or use a counter for a "for each..." one, and the round's total is
  computed from what's ticked. Only the conditions whose printed timing
  window (e.g. "2nd Battle Round onwards") is actually live for the
  round being viewed are shown, so a player is never offered scoring
  that doesn't apply yet. The total still stays directly editable too
  (same "always editable" rule as everything else), for whatever the
  checklist doesn't cover. A handful of missions also award a few more
  VP once, checked only at the very end of the game rather than in any
  particular round -- that's the End of Game step after round 5, where
  those conditions (and only those) become scorable. No matter how a
  mission's own conditions add up, the app holds primary and secondary
  each to the real core-rule caps: 15VP per round, 45VP per game -- the
  round overview always shows a total capped at what's actually still
  achievable, not a raw, uncapped sum. The End of Game step is also
  where each player's army can be marked painted, for a flat +10VP
  bonus each -- its own thing, not counted as primary or secondary.
- Secondaries follow the real Tactical deck flow: each round a player
  draws 2 new secondary cards (manually, or at random), and in any round
  may score any not-yet-scored secondary they've drawn *so far this
  game* -- not just the two from this particular round. The app always
  shows the whole cumulative picture -- what's scored, and what's drawn
  but still sitting there unscored -- not just the current round's two.
  A handful of secondary cards score differently depending on whether a
  player is playing Secondary Missions as Fixed picks or Tactical draws
  -- once a seat has declared which in setup, the round screen only
  shows the scoring conditions that actually apply to them, instead of
  both sets at once.
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
- Any participant can also cancel a game outright, at any stage --
  distinct from ending it early, this removes it completely (for both
  players, from every list) rather than keeping a record, for a game
  that shouldn't exist at all (created by mistake, a test, wrong code
  entered). Gated behind an explicit confirmation so a stray tap can't
  wipe a real game.
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
tournaments/events, an army list builder, in-app chat, push
notifications, rematch chains, CP/painting scoring, offline-first play,
or native mobile apps. See section 11 of `40k-tracker-plan.md` for the
original v1 scoping -- superseded on one point since: ladders/ranking
(below) turned out to be wanted after all, so that line from the
original out-of-scope list no longer holds.

**Ladders:** a ladder is just a named group of players
(`ladders`/`ladder_members`) -- create one, and anyone can browse and
join it, your own or someone else's, from the dedicated Ladders page.
Tagging a game onto a ladder is entirely optional, chosen at creation
time on the "Start a game" screen, and stays editable afterwards like
everything else. Ranking is Elo (see issue #26 for the research behind
picking it over Glicko-2/TrueSkill/Massey-Colley): everyone starts at
1500, and beating a much higher-rated opponent gains a lot while beating
a much lower-rated one barely moves the needle (and the mirror image for
losses) -- that asymmetry falls out of the standard Elo formula, it
isn't a hand-written rule. Computed live by replaying a ladder's whole
game history in chronological order every time standings are viewed --
never stored -- so editing a score or cancelling a game is reflected
correctly the moment the standings are viewed again, with no separate
recalculation step, despite Elo being inherently sequential.
Bookkeeping both sides of a ladder game yourself? The unclaimed seat's
setup form gets a "Player" picker (who on the ladder this seat is for),
so that person's result still counts toward standings even though
they never signed in themselves.
History can be filtered down to a single ladder's games. See
`40k-tracker-plan.md`'s superseded out-of-scope note above, and issue
#18 for the fuller design writeup (including why a stored, sequential
rating like ELO/Glicko was deliberately not used). A ladder's own page
also lists every game that went into its standings -- everyone's, not
just yours -- collapsed until asked for, so a look at the numbers doesn't
have to come with a wall of game rows by default. And wherever a
player's name shows up -- a ladder's standings or game log, your own
game history, the live Scoreboard, a game's summary -- it's a link to
that player's own record: their overall win rate and breakdown by
faction/mission/opponent, scoped to whatever of their games you're
actually allowed to see (their own account's games if it's you, or, for
anyone else, whatever ladder-tagged games you share a ladder with them
on -- the same rule that already governs whether their results show up
in a shared ladder's standings at all).

**Deployment and terrain layout:** picking a deployment shows its actual
map image (one of the 6 Chapter Approved deployment cards), not just a
name in a dropdown. Once a mission is resolved (both players' Force
Dispositions known), the 3 recommended terrain layouts (A/B/C) for that
specific Force Disposition pairing are also pickable, each with its own
image, in the shared `GameConfigPicker` -- a property of the game, not
of either seat's own setup, so it lives there alongside Attacker/Defender
rather than in `PlayerSetupFields`. Picking one is required to start a
game -- but, like every other setup field, stays freely editable
afterwards.

## What's actually in place right now

Everything in "the goal" above is implemented and deployed at the live
app URL, with one caveat worth knowing before you rely on it:

- **Google sign-in needs its OAuth client wired up** in the Supabase
  dashboard (Auth → Providers → Google) before it'll work in production;
  email/password sign-in works today without any extra setup.

Mission/deployment/secondary objective content is the real Chapter
Approved 2026-27 deck, sourced from the public card text -- see "Ruleset
/ mission content" below, including the one deliberate exception to this
repo's usual names-and-VP-only rule (the actual scoring condition text,
for the pick-what-you-achieved checklist) -- not placeholder content.

One-account bookkeeping is implemented: `create_game` seats the creator
and also creates an unclaimed second seat (`game_players.user_id` is
nullable) the creator can fill in and run themselves from the waiting
room; joining by code later claims that same seat rather than adding a
third one, and just grants the joiner the same edit rights the creator
already had. When that unclaimed seat's game is tagged to a ladder, the
bookkeeper can also attribute it to a specific ladder member
(`game_players.represents_user_id`, a picker in `PlayerSetupFields`) so
that player's win/loss counts in standings even though they never
signed in -- see "Ladders" above.

Turn order is implemented: `game_players.turn_order` ('first'/'second')
is modeled exactly like `role` at the schema level (a partial unique
constraint so only one seat can claim each value, optional, always
editable) -- picked via `GameConfigPicker`, see below, not a per-seat
form field. Once both seats have picked, the live Scoreboard's player
grid and the fixed bottom totals bar reorder so whoever went first
renders first; before that (or for older games that never set it) the
display falls back to seat order, unchanged from before this existed.

The pick-what-you-achieved scoring checklist is implemented for both
primary and secondary VP: `mission_objective_lines` and
`secondary_objective_lines` hold each card's real scoring conditions, a
player ticks/counts them, and `primary_objective_ticks`/
`secondary_objective_ticks` record what was ticked while
`round_scores`/`secondary_scores` stay the computed, directly-editable
source of truth. For primary, the checklist is shown directly in the
round overview (`Scoreboard`'s `PrimaryScorePanel`) rather than behind a
tap-to-open square, and only the conditions whose window is actually
live for the round being viewed -- `src/lib/missionWindows.ts` parses
each line's printed `window_label` ("Second Battle Round Onwards",
"First and Second Battle Round", "End of the Battle", ...) into which
round(s) it applies to, so e.g. round 1 never shows "2nd Battle Round
onwards" scoring.

Both primary and secondary now hold to the real core-rule caps -- 15VP
per round, 45VP per game, each -- not just whatever a mission's own
conditions add up to: `PrimaryScorePanel` clamps a round's checklist
total (and its manual override) to whatever's left of both caps, using
each player's own running total from `game_totals`; `SecondaryScores`
does the same across however many secondaries are scored in one round,
on top of each card's own `max_vp`. `round_scores.primary_vp` and
`secondary_scores.vp_scored` also carry a matching `<= 15` check
constraint server-side (added `not valid`, so it can't fail applying
over existing game data, but still enforces on every write from here
on) as defence in depth -- the aggregate round/game caps stay
client-enforced only, same as everywhere else in this app that trusts
the UI to already be clamping rather than adding a database trigger for
it.

A handful of missions also award a few more VP once, checked only at
the very end of the game ("End of the Battle" in
`mission_objective_lines`) rather than in any particular battle round --
that's the **End of Game** step, one past the last real battle round
(`Scoreboard`'s `endOfGameRound`, `total_rounds + 1`; the `Stepper`
shows it as an "End" tab). It reuses the exact same `round_scores`/
`primary_objective_ticks` machinery as a real round, just for
end-of-battle-only lines instead of round-windowed ones --
`round_scores.battle_round`'s check constraint was widened from 1-5 to
1-6 to make room, purely a modelling choice, not a real 6th battle
round. Secondaries aren't scored there (the real Tactical deck has no
end-of-battle timing), so `SecondaryScores` simply isn't shown on that
step. The End of Game step is also where the painted-army bonus lives:
a plain checkbox, own seat only (`game_players.painted_bonus`, a flat
+10VP each via `game_totals.painted_bonus_vp`, folded into `total_vp`
but tracked separately from primary/secondary) -- unlike round/secondary
scores, this one *isn't* bookkeeper-writable for the other side, since
it's a `game_players` column and that table's RLS only allows a seat's
own account (or an unclaimed seat) to write it; a claimed opponent seat
shows it read-only instead.

Secondaries are tracked the way Tactical secondaries actually work: 2
new cards are drawn each round (`secondary_draws`, one row per
player/secondary/game -- a card is drawn at most once), and in any round
a player may score any not-yet-scored secondary drawn *so far this
game*, not just this round's two. `SecondaryScores` shows the whole
cumulative picture regardless of which round is being viewed -- every
**drawn-but-unscored** one first (badged with which round it was drawn,
highlighted when that's the round currently being viewed), then already
**scored** ones below (with which round each was scored in) -- both
groups ordered by draw round, oldest first -- with a "+ Draw a
secondary" picker that either draws a specific card or, via "🎲 Draw
random", picks uniformly at random from whatever's left in that role's
deck.

Fixed vs Tactical is implemented: `secondary_objective_lines.mode`
(`'fixed' | 'tactical' | null`) already tagged which of a card's lines
apply to which -- 4 of the 18 secondaries (A Grievous Blow, Engage on
All Fronts, Assassination, Bring It Down) have every line tagged one way
or the other, the remaining 14 are mode-agnostic throughout -- but
nothing read it before now, so the round screen showed every line for a
split card at once, "(fixed)"/"(tactical)" label and all. A new
`game_players.secondary_mode` column (optional, own seat's own choice,
alongside Faction/Force Disposition in `PlayerSetupFields`, not a shared
GameConfigPicker decision) records which a seat is playing; once set,
`SecondaryScores` filters a card's scoring lines to just that mode (plus
any mode-agnostic ones) -- until set, every line still shows, same as
before this existed, so nothing regresses for a seat that hasn't picked
yet.

Ladders are implemented: the Ladders page lists every ladder (yours and
others'), `create_ladder` makes a new one and seats its creator, joining
or leaving any ladder is a self-service `ladder_members` row (no invite
code), "Start a game" gets an optional ladder picker (only shown once
you're in at least one), and History gets a ladder filter once any of
your games carry one. Standings are computed live in
`src/lib/queries/ladders.ts`, not stored. A ladder-tagged game is
readable by any signed-in user, not just its two players
(`20260310000000_ladder_game_visibility.sql`) -- otherwise a viewer's
standings would silently only reflect games they personally played in,
missing every result between other ladder members. Untagged games stay
participant-only, unchanged.

Ranking is Elo (`src/lib/elo.ts`, K-factor 32, everyone starts at 1500):
`fetchLadderStandings` builds one `{playedAt, playerAId, playerBId,
scoreForA}` entry per game with two identity-resolved seats (a game with
an unattributed opponent still counts toward that player's W/D/L/VP
columns, but can't feed the Elo replay -- there's no rating to exchange
points with), sorts them chronologically, and replays the whole thing
through `computeEloRatings` every time standings are fetched -- no
rating is ever written to the database. See issue #26 for why Elo over
Glicko-2 (simpler, still delivers the core "gain less / lose more
against a weaker opponent" ask; Glicko-2's added confidence-tracking is
a possible later upgrade) and over Massey-Colley (no natural per-game
"you gained/lost N points" story, which is most of the point).

Each ladder's own game log is implemented too, alongside its standings:
a second "Show games" disclosure inside an already-expanded ladder row
(`LaddersPage`'s `GamesList`, `fetchLadderGames` in
`src/lib/queries/ladders.ts`) lists every completed game tagged to that
ladder -- not just the viewer's own, same visibility as standings --
most recent first, each linking to that game's summary. Collapsed by
default, nested one level deeper than the ladder row itself, so opening
a ladder to see its standings doesn't also dump its whole history onto
the screen.

Player names are linked wherever they're shown -- the ladder standings
and games list above, History's opponent, both players' cards and the
result table on the live Scoreboard and the post-game Summary, the
waiting room's "Player 2" -- to a new `/players/:userId` page
(`PlayerNameLink`, `src/components/`; issue #28). It's the same
`StatsPage` as `/stats`, just for someone else's account instead of the
signed-in user's own: `useCompletedGames(targetUserId)` already reads
whichever of *that* user's games RLS lets the *viewer* see, so a
stranger's page naturally comes back scoped to only the ladder-tagged
games they share a ladder with (untagged personal games of theirs stay
invisible, same as everywhere else) -- no new RLS or query logic needed,
just calling the existing history query with someone else's id. A name
only links when there's a stable account behind it (`playerUserId()`):
an unclaimed, unattributed seat's army name stays plain text, since
there's nobody to link to yet. Names inside a button that does something
else (declaring Attacker/turn order, confirming who won) are deliberately
left unlinked -- navigating away isn't what tapping those does.

Deployment map images, terrain layout selection, Attacker/Defender, and
turn order are all implemented. "Start a game"'s deployment picker
(`ImageOptionGrid`) shows each deployment's actual card image instead of
a bare name. The other three are all *game*-level decisions, not a
per-seat one, so none of them live in `PlayerSetupFields` (each seat's
own setup form: Faction, Force Disposition, Army name) -- they live
together in the shared `GameConfigPicker` (`src/features/game/`): once
a game's mission is resolved (so the Force Disposition pairing is
known), the 3 recommended terrain layouts for that pairing become
pickable there; Attacker/Defender and turn order are asked as "who is
Attacker?" and "who went first?" by name, once, rather than shown as a
toggle on both players' own setup forms. `GameConfigPicker` lives in its
own "Game configuration" card in the waiting room, and behind a "Game
configuration" link/sheet in the live Scoreboard. The write-mirroring
logic (`setMirroredField`) didn't need to change for any of this --
picking a name still writes that seat's own field directly and mirrors
the complement onto the other seat when the viewer is allowed to (their
own seat, or an unclaimed one), same permission model as before. All
three fields are **required to start a game**, same as every setup field
except army name (`WaitingRoom`'s `canStart`, and the `start_game` RPC
server-side), but like every other setup field they stay freely editable
for the life of the game once chosen -- required-before-start and
always-editable-after are not in tension.

The Attacker/Defender explainer in `GameConfigPicker` also spells out
the one part of that pick with an actual rules effect: it's not just
flavour text or which battlefield edge/Secondary deck each side gets --
the Defender deploys first, then the Attacker deploys second, reacting
to it, which is the only thing that meaningfully differs between the two
roles under the current ruleset.

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
opponent left) works from any round; canceling a game outright (distinct
from ending it, this deletes it entirely rather than keeping a record)
is available from the Home list, History list, waiting room, and
scoreboard, always behind a confirm step; and `game_players`/`games`
state transitions that used to be enforced only in the UI (starting a
game before its setup is actually complete, cross-game score writes) are
now also checked server-side (`start_game` RPC, RLS).

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
-- lives in `supabase/migrations/20260221000000_apply_real_reference_data.sql`,
**not** `seed.sql`. Missions and secondary objectives specifically have
to be a migration, not a manual seed step: they were originally only in
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

**Copyright note, read this before touching mission content again:**
everywhere else in this repo, "reference data" deliberately means names,
categories and VP values only -- never GW's rules text (how a mission or
secondary actually scores, turn by turn). `mission_objective_lines` and
`secondary_objective_lines` (`supabase/migrations/20260301000000_objective_lines.sql`)
are a **deliberate, informed exception** to that rule, made by the
project owner after being told explicitly what it meant: `condition_text`
in those tables *is* GW's copyrighted scoring text (via wahapedia.ru's
public transcription), stored so a player can tick which conditions they
achieved instead of typing a raw VP number. Don't treat this as license
to relax the no-rules-text policy anywhere else in the app without the
same explicit conversation -- it's still the default everywhere but here.

The same kind of exception, made the same way (explicit, informed,
project-owner sign-off), covers **images**: `public/images/deployments/`
(6 files) and `public/images/layouts/` (45 files -- 15 Force Disposition
pairings x 3 layout variants) are downloaded, committed copies of GW's
own deployment-map and terrain-layout diagrams from wahapedia.ru, not
names/values-only reference data. `deployments.image_path` and
`missions.layout_a_image_path`/`layout_b_image_path`/`layout_c_image_path`
(`supabase/migrations/20260305000000_deployment_and_layout_images.sql`)
point at these local paths -- served from the app's own domain, not
hotlinked. Layout images are keyed by the **Force Disposition pairing**,
not the deployment (wahapedia's own page script resolves them that way,
see the migration's comment) -- a deployment picks the battlefield shape,
a layout picks the terrain piece placement on it, and the two are chosen
independently. Picking a layout (`games.layout_variant`) is required
before a game can start, same as every other setup field except army
name -- but, like those, stays freely editable for the life of the
game once set.

When the next Chapter Approved deck ships: add a new `mission_packs` row
and a new migration with its missions/secondary_objectives (and, if you
want the checklist to keep working, their objective lines too), the same
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

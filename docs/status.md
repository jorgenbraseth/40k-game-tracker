# What's actually in place right now

> **Implementation status.** This page describes what's *true today* and
> how each feature is built -- tables, migrations, components, and the
> reasoning behind non-obvious choices. For what the app is *for*, see
> [goal.md](./goal.md). Back to the [README](../README.md).

Everything in [the goal](./goal.md) is implemented and deployed at the
live app URL, with the [caveats below](#known-caveats) worth knowing
before you rely on it. Sign-in (Google and email/password) is verified
working in production, both on the web and in the Android app.

## Contents

- [Known caveats](#known-caveats)
- [Overview](#overview)
- [Navigation and layout](#navigation-and-layout)
- [Accounts and profile](#accounts-and-profile)
  - [Display names](#display-names)
  - [Avatars](#avatars)
  - [Themes, crest and light/dark mode](#themes-crest-and-lightdark-mode)
- [Creating and joining games](#creating-and-joining-games)
  - [One-account bookkeeping](#one-account-bookkeeping)
  - [Shareable invite links](#shareable-invite-links)
  - [Logging a game after the fact](#logging-a-game-after-the-fact)
- [Game setup and configuration](#game-setup-and-configuration)
  - [Terrain layout, Attacker/Defender, turn order](#terrain-layout-attackerdefender-turn-order)
  - [Turn order display](#turn-order-display)
  - [Fixed vs. Tactical](#fixed-vs-tactical)
  - [Editing a game's ladder tags](#editing-a-games-ladder-tags)
- [Scoring](#scoring)
  - [Pick-what-you-achieved checklist](#pick-what-you-achieved-checklist)
  - [VP caps](#vp-caps)
  - [End of Game step and painted bonus](#end-of-game-step-and-painted-bonus)
  - [Secondaries](#secondaries)
  - [Command Points](#command-points)
  - [`game_totals` and the fan-out bug](#game_totals-and-the-fan-out-bug)
- [Post-game summary](#post-game-summary)
- [Editing a finished game](#editing-a-finished-game)
- [Spectating](#spectating)
- [Contesting and invalidating ladder games](#contesting-and-invalidating-ladder-games)
- [History and player stats](#history-and-player-stats)
- [Ladders](#ladders)
- [URL-addressable view state](#url-addressable-view-state)
- [Installable PWA](#installable-pwa)

---

## Known caveats

- **The Android app-store wrapper (issue #125) is scaffolding, not a
  shipped app yet.**
  - *Done:* `capacitor.config.ts` and the generated `android/` native
    project are in the repo, wired up with:
    - a native-aware Google sign-in flow (`src/lib/nativeAuth.ts`) -- routes
      OAuth through the system browser and picks the redirect back up via
      a `com.fortyktracker.app://` deep link, since Google blocks sign-in
      from inside an embedded WebView;
    - a native keep-awake fallback (`src/lib/useWakeLock.ts`, via
      `@capacitor-community/keep-awake`) for the same mid-game screen-on
      behavior the web build already has.

    It's been tested on a real device with real Google sign-in working end
    to end. A `/privacy` page exists (linked from the landing page and the
    signed-in footer) with real, code-grounded content, and
    `android/app/build.gradle` has a release-signing config ready to read
    a keystore once one exists.
  - *Not done:* the upload keystore itself (a local, by-hand `keytool`
    step -- see [deployment.md](./deployment.md#publishing-a-signed-android-release)),
    the Google Play Developer account, and the rest of the store listing
    (screenshots, description, content rating, Data Safety form) -- see
    #125 for the full remaining checklist.
  - **iOS (#126) hasn't been started.**

## Overview

Auth, live game creation/joining, the Force Disposition/mission-pairing
flow, live round-by-round scoring, realtime sync, game history, and
win/loss stats are all built, deployed, and functional today -- not
aspirational.

Mission/deployment/secondary objective content is the real Chapter
Approved 2026-27 deck, sourced from the public card text -- not
placeholder content. See [ruleset-content.md](./ruleset-content.md),
including the one deliberate exception to this repo's usual
names-and-VP-only rule (the actual scoring condition text, for the
pick-what-you-achieved checklist).

So is the **always-editable bookkeeping model**:

- Score/secondary edits apply **optimistically** -- a tap shows up
  immediately, including while offline; it sends once back online, no
  separate offline queue needed -- with rollback and an error toast if a
  save genuinely fails.
- **Ending a game early** (concede / opponent left) works from any round.
- **Cancelling a game** outright (distinct from ending it -- this deletes
  it entirely rather than keeping a record) is available from the New
  game lobby's in-progress list, History list, waiting room, and
  scoreboard, always behind a confirm step.
- `game_players`/`games` state transitions that used to be enforced only
  in the UI (starting a game before its setup is actually complete,
  cross-game score writes) are now also **checked server-side**
  (`start_game` RPC, RLS).

## Navigation and layout

**Home vs. New game.** Home is a proper landing page rather than the
"start/join a game" hub it used to be.

- `HomePage` (`src/features/lobby/HomePage.tsx`) is just the prominent
  `BrandLogo`, the tagline, `InstallHint`, and a `SHORTCUTS` grid linking
  to every section.
- Everything Home used to render directly -- the Start/Join/Log-a-game
  buttons and the in-progress games list -- moved unchanged into
  `GameLobbyPage` (`src/features/lobby/GameLobbyPage.tsx`), at its own
  route (`/game/lobby`) and nav item ("New game", `src/app/Layout.tsx`'s
  `navItems`, placed right after Home).
- Nothing about that content itself changed, only where it lives. That's
  also why a "Cancel this game" redirect or a Summary page's "Home"
  button still just goes to `/home` -- landing on the new dashboard after
  finishing or cancelling a game is a perfectly good place to end up.

**Responsive header nav.** `Layout`'s header nav (5 links plus Sign out)
is shown inline from the `sm:` breakpoint up, and collapsed behind a "☰"
button at phone width, opening the same bottom `Sheet` used everywhere
else in the app rather than a bespoke dropdown. (The 6-item row used to
force a horizontal zoom-out on a real phone screen instead of wrapping.)
The footer also picked up the same `max-w-3xl` centering the header and
main content already had, so it no longer stretches wider than the rest
of the page on a wide screen.

**Scoreboard top row.** There's no top row of links or a "⋯" menu any
more -- an active game you're playing opens straight onto the round
header (below). What used to live up there:

- **Opponent online/offline** is a small colored dot next to the
  opponent's own name in the round header (participants only, and only
  for a claimed seat -- an unclaimed one has nobody to be online).
- **Game configuration** is a plain link under the End game button.
- **Summary** has no link from here; it's where ending a game lands
  you, and History links to it for finished games.
- **Status text** ("Game complete"/"Game abandoned", "Spectating",
  "Scores stay editable") still shows above the header, only when it
  applies.

**Round screen layout.** The Scoreboard is trimmed down to just the
scoring, laid out for a phone:

- **Sticky round header.** The running totals (what used to be a fixed
  bottom bar) now sit in a header pinned just under the app header
  (`Layout` publishes its own height as `--app-header-height` for this).
  Each player's total/VP split/CP sits on either side of a `RoundNav`
  control -- just previous/next, no jumping straight to an arbitrary
  round. It's two rows ("Round 2" on top; "‹ of 5 ›" underneath, "End" /
  "of game" for the End step) so it stays narrow enough for the totals
  either side to show their VP split and CP untruncated on a phone.
- **Stepping rounds.** "›" from the game's own current round (while it's
  active) is what advancing the game means, so it also moves
  `games.current_round` forward. Going back, or forward through rounds
  already reached, only changes what's on screen (`?round=N`) -- revisiting
  an earlier round to fix a score never rewinds the game for the other
  player. There are no separate Advance/Back-to-round buttons any more;
  the flip side is that an accidental advance can't be undone, only
  navigated back from.
- **Per-seat colors.** Each seat's card and its half of the header carry
  a faint tint so it's clear whose scores are on screen: seat 1 a wash of
  the theme's own accent (`blood`), seat 2 a plain neutral wash. Keyed to
  seat, so it doesn't swap when turn order reorders the cards.
- **Pinned names.** Each card's name bar sticks just under the round
  header while that card is on screen.
- **Sections, not nested frames.** Inside a card, CP (first, right
  under the name), Primary VP and Secondary VP are full-width sections
  split by hairlines; scoring lines
  and secondaries are edge-to-edge rows rather than individually framed
  boxes. Already-scored secondaries are faded so what's still left to
  score stands out. The primary "set total directly" override is a ✎
  next to the round's Primary VP number.
- **Less text.** Faction, army, mission, Attacker/Defender and "went
  first" no longer show on the cards, and neither does the layout line --
  all of it (plus each seat's "Edit setup") lives in the Game
  configuration sheet, which lists both players' setup under a "Players"
  section.

## Accounts and profile

### Display names

Display names never derive from email:

- `handle_new_user()`'s fallback (when a signup provides no name at all)
  generates a generic placeholder, never the email's local part.
- The signup form requires a display name for email/password accounts,
  so that fallback is rarely even hit.
- Realtime presence -- broadcast to everyone subscribed to a game's
  channel -- sends the profile display name, never the raw email (fixed
  alongside).

### Avatars

Player avatars are implemented (issue #73).

- **Schema.** `profiles.avatar_url` already existed (Google sign-in was
  already populating it from the provider's own picture). What was
  missing was a manual upload path and anywhere that actually rendered
  it.
- **Resizing** (`src/lib/resizeImage.ts`, entirely client-side, no edge
  function): center-crops to a square, downsamples to 256px, and
  compresses to WebP (falling back to whatever format a browser's canvas
  actually emits, per spec, if it doesn't support WebP encoding), stepping
  quality down until it's under ~200KB or hits a floor.
- **Storage.** Uploads to an `avatars` Supabase Storage bucket
  (`20260401000000_player_avatars.sql`) at a fixed `<user id>/avatar.<ext>`
  path -- a re-upload just overwrites it (`upsert: true`) rather than
  accumulating orphaned files. Gated by storage RLS so a user can only
  write inside their own folder. The bucket's own 500KB `file_size_limit`
  is a backstop, not the primary control.
- **Rendering.** `Avatar` (`src/components/Avatar.tsx`) renders the
  image, or a plain initial on a neutral background when there isn't one.
  `PlayerNameLink` takes an optional `avatarUrl` and renders a small
  `Avatar` inline before the name when given one -- omitted entirely, it
  renders exactly as before, so not every call site had to change at
  once.
- **Wired up:** ladder standings and game lists, History (both its "mine"
  and generic row layouts), and a player's own stats page header.
- **Deliberately not wired up (yet):** Scoreboard/WaitingRoom/SummaryPage's
  own name displays. Those are tighter, more overflow-sensitive layouts
  where a 1-on-1 scoreboard gets less benefit from an avatar than a list
  of many names does. `PlayerNameLink`'s optional prop means adding it
  there later is a small, isolated follow-up, not a redesign.

### Themes, crest and light/dark mode

**One combined pick for theme + crest.** A single `profiles.theme` drives
both. This collapses what was originally two independent pickers --
`profiles.theme` (four generic looks, then twelve faction palettes added
alongside them) and a separate `profiles.logo` (thirteen crests, going
through several rename/mislabeling fixes of its own as the real faction
was identified -- `'mechanicus'`→`'votann'`, `'custodes'`→`'tau'`, etc.)
-- into one, after it turned out nobody wanted to mix-and-match a
faction's colors with a different faction's crest in practice.

**The collapse migration** (`20260922000000_collapse_theme_and_logo.sql`),
for each existing profile:

1. an explicitly-picked non-default logo wins as the new combined `theme`
   (a deliberate crest pick beats a possibly-still-default generic
   theme);
2. otherwise a generic `'astartes'`/`'aeldari'`/`'parchment'` theme --
   dropped, since none of those three ever had a matching crest -- falls
   back to `'grimdark'`;
3. then `profiles.logo` and its check constraint are dropped outright, and
   `profiles_theme_check` is narrowed to the resulting thirteen-value
   union (`Theme` in `src/lib/database.types.ts`): `'grimdark'` (the
   original Aquila+palette, now one choice instead of two) plus one per
   faction -- `'votann'`, `'tyranid'`, `'tau'`, `'orks'`, `'chaos'`,
   `'sororitas'`, `'greyknights'`, `'mechanicus'`, `'thousandsons'`,
   `'darkangels'`, `'worldeaters'`, `'spacewolves'`.

**Necrons** was added afterwards as a fourteenth theme
(`20261002000000_profile_theme_necrons.sql`) -- a purely additive widening
of `profiles_theme_check` to include `'necrons'`, with its own palette in
`index.css` and crest (`logo-necrons.webp`) in `THEMES`.

This narrows and drops a column outright rather than
expand-then-contract -- see the migration's own `-- breaking-change-ok:`
comment: no native app has a real store release yet, only
`android-apk.yml`'s debug-APK CI artifact, so nothing installed depends on
the old two-column shape.

**`src/lib/theme.ts`'s `THEMES` table is the single source of truth per
theme** -- id, label, description, the crest's own `src`/intrinsic
`width`/`height` (the fourteen don't share one aspect ratio) and
in-universe `quote`, *and* two color-preview swatch sets (see below).
It replaces what used to be a separate `logo.ts`.

**Light/dark mode.** Independent of *which* theme, `profiles.color_mode`
(`'light' | 'dark' | 'system'`, `ColorMode` in `database.types.ts`,
defaulting new profiles to `'system'`, added by the same migration) picks
*how bright* it renders.

- Every one of the fourteen themes ships both a light and a dark palette
  in `src/index.css` (not just one fixed mode each, as the original
  sixteen-theme version did).
- Selection is a compound `[data-theme='x'][data-mode='y']` attribute
  selector per combination -- 27 explicit blocks: 14 × 2, minus
  grimdark-dark, which needs none of its own since it's still the base
  `@theme` values, rather than the single `[data-theme='...']` the earlier version
  used.
- **Every color a component uses is a semantic Tailwind v4 `@theme`
  token**: `ink`/`paper`, `blood`/`blood-dark`, `gold`, `steel`, the
  `veil`/`veil-strong`/`veil-loud` subtle-fill/hairline scale,
  `danger`/`danger-dark`, `success`, and the fixed `onfill` used only for
  text sitting on a solid `blood`/`steel`/`danger` fill. Picking a theme
  and picking a mode never touches component code, only which pair of
  attributes is on `<html>`.
- **How the missing modes were derived** (nine of the twelve faction
  themes were dark-only, three light-only, before this):
  `blood`/`blood-dark`/`steel`/`danger`/`danger-dark` are kept identical
  between a theme's two modes, since their only contrast requirement is
  against the fixed `onfill`, which never moves. Only
  `ink`/`paper`/`veil*`/`gold`/`success` are recomputed -- `gold` and
  `success` are checked against that theme+mode's own `ink`, which does
  move, so they can't be shared the same way. Every derived value still
  clears **WCAG AA (≥4.5:1)**.
- `color-scheme` (native scrollbars/form controls) lives in two mode-only
  rules (`[data-mode='dark']`/`[data-mode='light']`) instead of being
  repeated inside every theme block, since it only ever depended on the
  mode.

**Applying it.**

- `ThemeSync` (`src/app/ThemeSync.tsx`, mounted once in `App.tsx`)
  applies the signed-in user's `profiles.theme` and `profiles.color_mode`
  to `<html>` whenever either loads or changes, caches both to
  `localStorage` (`40k-theme`/`40k-color-mode`), and re-resolves
  `'system'` live if the OS preference changes while the app is open (a
  `matchMedia('(prefers-color-scheme: dark)')` change listener).
- **No flash of the wrong theme:** a small inline script in `index.html`,
  running before React, reads those same cached keys (resolving
  `'system'` itself, since React hasn't loaded yet) so a returning visitor
  never sees the wrong theme or mode first. This absorbed what used to be
  a separate fallback path for the crest alone (`LogoSync`, now gone -- a
  single `<img>` swap used to be cheap enough to skip the bootstrap
  script, but theme and crest are the same field now, so there's only one
  fallback path to maintain).

**The picker** (`ProfilePage`).

- The fourteen themes render as one combined swatch grid. Each button
  shows that theme's crest thumbnail plus three small ink/blood/gold
  preview dots, both sourced from `theme.ts`'s own copy of those values
  (the picker has to show themes that aren't active, so it can't just
  read the live CSS variables).
- Which preview-dot set a swatch shows (`previewDark` or `previewLight`)
  follows the *current* resolved mode, so the grid always reflects what
  picking that theme would actually look like right now.
- A separate **Appearance** control (Light/Dark/System, three buttons)
  sits above it for the `color_mode` pick.
- Picking either applies instantly (`applyTheme`/`applyColorMode`,
  mutating `<html>` directly) and saves through `useUpdateProfile`, which
  applies every patch optimistically (`onMutate` merges it into the
  cached profile before the write lands, rolled back on failure) -- so
  the picker's selected state and `BrandLogo`'s header instance update
  the moment either is clicked, not once Postgres responds.

**The crest** (`BrandLogo`, `src/components/BrandLogo.tsx`) resolves
`theme.ts`'s `getTheme(profile?.theme ?? getCachedTheme())`.

- It's the single component `Layout`'s header, `LandingPage`'s sign-in
  hero, and `HomePage`'s hero all use, so there's one place resolving
  "whose crest is this" rather than three copies.
- `Layout` skips its own copy on `/home`
  (`useLocation().pathname === '/home'`), since Home already renders the
  same crest full-size right below the header. Every other page still
  shows it, as the app's one consistent "back to Home" anchor.
- Each theme's `quote` is what `BrandLogo`'s `altVariant="quote"` prop
  swaps in as the landing page logo's alt text. The header's own
  `BrandLogo` keeps the plain "40K Tracker" default, since its `NavLink`
  wrapper already names the app for a screen reader; the landing page's
  logo has no such wrapper.

## Creating and joining games

### One-account bookkeeping

- `create_game` seats the creator and also creates an **unclaimed second
  seat** (`game_players.user_id` is nullable) the creator can fill in and
  run themselves from the waiting room.
- Joining by code later **claims that same seat** rather than adding a
  third one, and just grants the joiner the same edit rights the creator
  already had.
- **Ladder attribution.** When that unclaimed seat's game is tagged to a
  ladder, the bookkeeper can attribute it to a specific ladder member
  (`game_players.represents_user_id`, a picker in `PlayerSetupFields`),
  so that player's win/loss counts in standings even though they never
  signed in.
- `fetchCompletedGames` (History, and `StatsPage`/`/players/:userId`)
  resolves a user's own games the same way `fetchLadderStandings` does --
  `user_id` **or** `represents_user_id`, not just `user_id` -- so a
  solo-entered, attributed game shows up in that player's own history and
  stats too, not only in ladder standings.

### Shareable invite links

Implemented for both ladders and games, on top of their existing codes
rather than replacing them. A code typed into a form still works exactly
as before, but the same code can also be shared as a URL
(`/ladders/join/<code>`, `/game/join/<code>`) that joins automatically
the moment it's opened. `WaitingRoom` (games) and the Ladders page's
invite-code section both offer "Copy code"/"Copy link" side by side.

- **Games** needed no schema change -- `join_game_by_code` already
  resolves a game from the code alone (it's globally unique), so
  `/game/join/:code` is purely a new route on the existing
  `JoinGamePage`, which auto-submits when a code arrives via the URL
  instead of the manual field, then redirects into the game.
- **Ladders** needed one new RPC, `join_ladder_by_invite_code(p_code)`
  (`20260918010000_ladder_invite_links.sql`). The existing
  `join_ladder_by_code(p_ladder_id, p_code)` needs a ladder id the client
  doesn't have from a bare link (`invite_code` is deliberately not part
  of the public "browse ladders" read path -- see [Ladders](#ladders)), so
  the new function resolves the ladder from the code itself server-side
  before inserting the membership row, with the same
  `on conflict do nothing` idempotency. `LadderJoinPage`
  (`/ladders/join/:code`) calls it on arrival and redirects to the Ladders
  page.
- **Signed-out invitees.** Both join routes sit behind `ProtectedRoute`,
  so opening one signed out bounces through the landing page first.
  `ProtectedRoute` already stashed the original URL in router state, but
  until this nothing read it back, so sign-in always landed on `/home`.
  Now:
  - `LandingPage` resolves that stashed location into a `next` path
    (defaulting to `/home`) and redirects there once signed in;
  - for the two flows that leave the SPA and come back (Google OAuth, and
    email confirmation on signup), `next` is round-tripped as a query
    param on the `/auth/callback` redirect URL, since router state doesn't
    survive that round trip;
  - `AuthCallback` only trusts it back if it looks like an in-app path
    (starts with `/`, not `//`).

  Net effect: a brand-new invitee who isn't signed in yet can follow an
  invite link straight through sign-up/sign-in and land exactly on the
  ladder/game they were invited to.

### Logging a game after the fact

A separate creation path from `create_game`/`join_game_by_code`, added
as its own RPC, `log_completed_game()`
(`20260403000000_log_completed_game.sql`). One call takes a brand new
game straight to `status: 'complete'`, skipping `lobby`/`active` and the
whole live Scoreboard.

- **The schema wrinkle.** `game_totals.total_vp` has no direct-write
  column of its own -- it's always `SUM(round_scores.primary_vp) +
  SUM(secondary_scores.vp_scored)` (plus painted bonus). So "just enter a
  final score" has to land as `round_scores` rows underneath like
  everything else that feeds that view: chunked into ≤15VP pieces to
  respect the existing per-row cap (`round_scores_primary_vp_max`), up to
  6 rounds/90VP total. The RPC rejects anything higher rather than
  truncating it silently.
- **No fake round-by-round.** None of that chunking is a real round
  record, so `games.is_retroactive` flags it, and `SummaryPage` skips its
  round-by-round table for a game with that flag rather than render the
  split misleadingly.
- **Seats.** The logger is always seat 1 (same as every other creation
  path). The opponent seat reuses the exact same solo-entry attribution as
  a live bookkept game (`represents_user_id` to a real ladder member, or a
  free-text name with no account at all). The result counts straight
  away; an attributed ladder member who disagrees can contest it like any
  other ladder game. (`log_completed_game()` still writes a verification
  row for the logger's seat -- harmless, see below.)
- **UI.** `src/features/lobby/LogGamePage.tsx` is the one form for all of
  this, reachable from the New game lobby alongside "Start a game"/"Join
  a game".

## Game setup and configuration

### Terrain layout, Attacker/Defender, turn order

All three are implemented, and all three are **game-level** decisions,
not per-seat ones -- so none of them live in `PlayerSetupFields` (each
seat's own setup form: Faction, Force Disposition, Army name). They live
together in the shared **`GameConfigPicker`** (`src/features/game/`),
which appears:

- in its own "Game configuration" card in the waiting room, and
- behind the "Game configuration" link under the live Scoreboard's End
  game button.

**Terrain layout.** Once a game's mission is resolved (so the Force
Disposition pairing is known), the 3 recommended terrain layouts for that
pairing become pickable there.

**No separate deployment picker any more**
(`20260323000000_deployment_optional.sql`):

- `games.deployment_id` is nullable and `create_game` no longer takes it
  as a parameter. The 3 terrain layout alternatives already fully
  determine (and visually show) the deployment, so asking for one
  independently, before either player had even picked a Force
  Disposition, was never a real choice on top of that.
- `useDeployments` and the "Deployment" `ImageOptionGrid` that used to
  live on `NewGamePage` are gone.
- The `deployments` table and existing games' `deployment_id` stay
  untouched -- the same "never touch old history" rule this app applies
  to every other schema change. New games just don't set it.

**Attacker/Defender and turn order** are asked as "who is Attacker?" and
"who went first?" by name, once, rather than shown as a toggle on both
players' own setup forms.

- Picking a name sets **both seats at once**, through the
  `set_role`/`set_turn_order` RPCs
  (`20260324000000_shared_role_and_turn_order.sql`). Either participant's
  pick is final, like an actual roll-off at the table -- the other player
  doesn't have to separately confirm on their own device.
- These replaced an earlier client-side mirroring helper
  (`setMirroredField`) that could only write the *other* seat when it was
  unclaimed or the caller's own. A real second player's already-claimed
  seat was invisible to a plain client update under `game_players`' "own
  seat only" RLS policy, so picking a role/turn order silently left their
  side unset until they picked it themselves too.
- The RPCs are `security definer`, gated only by `is_game_participant`
  (same trust level as round/secondary scores -- "either player may enter
  either seat's score"), so they can write both rows regardless of who
  owns which. Direct client writes to `role`/`turn_order` are revoked from
  `authenticated` now that the RPCs are the only path.

**Required to start, editable after.** All three fields are required to
start a game, same as every setup field except army name
(`WaitingRoom`'s `canStart`, and the `start_game` RPC server-side). Like
every other setup field, they stay freely editable for the life of the
game once chosen -- required-before-start and always-editable-after are
not in tension.

**Explainer text is deliberately terse.** Attacker gets one line -- "The
Defender deploys first, then the Attacker" -- the only part of that pick
with an actual rules effect, and the only thing that meaningfully differs
between the two roles under the current ruleset. Went first gets no
explainer at all -- just the label and the two name buttons -- on the
assumption a player asking to set it already knows it's decided by its
own roll-off.

**Faster mission resolution.** Picking a Force Disposition resolves the
mission (and unlocks the layout picker) without waiting for the server
round trip -- see [ruleset-content.md](./ruleset-content.md#client-side-mission-resolution).

### Turn order display

`game_players.turn_order` (`'first'`/`'second'`) is modeled exactly like
`role` at the schema level: a partial unique constraint so only one seat
can claim each value, optional, always editable. Picked via
`GameConfigPicker` (above), not a per-seat form field.

Once both seats have picked, the live Scoreboard's player grid and the
sticky round header's totals reorder so whoever went first renders first.
Before that (or for older games that never set it) the display falls
back to seat order, unchanged from before this existed.

### Fixed vs. Tactical

- `secondary_objective_lines.mode` (`'fixed' | 'tactical' | null`)
  already tagged which of a card's lines apply to which. 4 of the 18
  secondaries (A Grievous Blow, Engage on All Fronts, Assassination,
  Bring It Down) have every line tagged one way or the other; the
  remaining 14 are mode-agnostic throughout. Nothing read it before, so
  the round screen showed every line for a split card at once,
  "(fixed)"/"(tactical)" label and all.
- `game_players.secondary_mode` (own seat's own choice, alongside
  Faction/Force Disposition in `PlayerSetupFields`, not a shared
  `GameConfigPicker` decision) records which a seat is playing. Once set,
  `SecondaryScores` filters a card's scoring lines to just that mode
  (plus any mode-agnostic ones).
- Picked via a two-button Fixed/Tactical toggle, not a dropdown with an
  "undecided" option.
- Like faction, Force Disposition, role, and turn order, **both seats
  must pick one before the game can start** (`WaitingRoom`'s `canStart`,
  and `start_game` server-side via
  `20260318000000_require_secondary_mode.sql`), so a game can no longer be
  played all the way through without either seat ever declaring one.

### Editing a game's ladder tags

Which ladder a game's tagged to stays editable for the life of the game,
not just a one-time pick at creation:

- `useSetLadder` is a plain `games.ladder_id` write, using the same
  "participants can update their games" policy every other game-level
  field already relies on -- no new policy needed.
- UI: a "Ladder game?" `Select` in `GameConfigPicker`, alongside
  layout/Attacker/turn order, in both the waiting room and the live
  Scoreboard's "Game configuration" sheet.
- The dropdown only offers ladders the viewer's currently a non-archived
  member of, plus whichever one's already set (even if archived, or the
  viewer's since left it) so a stale selection never just disappears from
  the list.

## Scoring

### Pick-what-you-achieved checklist

Implemented for both primary and secondary VP.

- `mission_objective_lines` and `secondary_objective_lines` hold each
  card's real scoring conditions.
- A player ticks/counts them; `primary_objective_ticks` /
  `secondary_objective_ticks` record what was ticked.
- `round_scores` / `secondary_scores` stay the computed,
  **directly-editable source of truth**.
- For primary, the checklist is shown directly in the round overview
  (`Scoreboard`'s `PrimaryScorePanel`) rather than behind a tap-to-open
  square.
- **Timing windows.** Only conditions whose window is actually live for
  the round being viewed are shown. `src/lib/missionWindows.ts` parses
  each line's printed `window_label` ("Second Battle Round Onwards",
  "First and Second Battle Round", "End of the Battle", ...) into which
  round(s) it applies to, so e.g. round 1 never shows "2nd Battle Round
  onwards" scoring.

### VP caps

Primary and secondary each hold to the real core-rule caps -- **15VP per
round, 45VP per game** -- not just whatever a mission's own conditions
add up to.

- **Client (primary):** `PrimaryScorePanel` clamps a round's checklist
  total (and its manual override) to whatever's left of both caps, using
  each player's own running total from `game_totals`.
- **Client (secondary):** `SecondaryScores` does the same across however
  many secondaries are scored in one round, on top of each card's own
  `max_vp`.
- **Server (defence in depth):** `round_scores.primary_vp` and
  `secondary_scores.vp_scored` carry a matching `<= 15` check constraint,
  added `not valid` so it can't fail applying over existing game data,
  but still enforced on every write from here on.
- The aggregate round/game caps stay **client-enforced only**, same as
  everywhere else in this app that trusts the UI to already be clamping,
  rather than adding a database trigger for it.

### End of Game step and painted bonus

A handful of missions award a few more VP once, checked only at the very
end of the game ("End of the Battle" in `mission_objective_lines`)
rather than in any particular battle round.

- That's the **End of Game** step, one past the last real battle round
  (`Scoreboard`'s `endOfGameRound`, `total_rounds + 1`; the header's
  `RoundNav` shows it as "End of game"). Each player panel there shows
  just end-of-battle primary and the painted bonus -- no CP section,
  since nothing's spent after the last round.
- It reuses the exact same `round_scores`/`primary_objective_ticks`
  machinery as a real round, just for end-of-battle-only lines instead of
  round-windowed ones.
- `round_scores.battle_round`'s check constraint was widened from 1-5 to
  1-6 to make room -- purely a modelling choice, not a real 6th battle
  round.
- Secondaries aren't scored there (the real Tactical deck has no
  end-of-battle timing), so `SecondaryScores` simply isn't shown on that
  step.

**Painted-army bonus.** Also lives on the End of Game step: a plain
checkbox, own seat only (`game_players.painted_bonus`, a flat +10VP each
via `game_totals.painted_bonus_vp`, folded into `total_vp` but tracked
separately from primary/secondary). Unlike round/secondary scores, this
one *isn't* bookkeeper-writable for the other side: it's a `game_players`
column, and that table's RLS only allows a seat's own account (or an
unclaimed seat) to write it. A claimed opponent seat shows it read-only
instead.

### Secondaries

Tracked the way Tactical secondaries actually work:

- **Draws.** 2 new cards are drawn each round (`secondary_draws`, one row
  per player/secondary/game -- a card is drawn at most once).
- **Scoring.** In any round a player may score any not-yet-scored
  secondary drawn *so far this game*, not just this round's two.

`SecondaryScores` layout, top to bottom:

1. A small "Secondary VP" header (same as `PrimaryScorePanel` uses for
   primary) -- this round's total, and what it's still capped at (same
   15VP-per-round/45VP-per-game rule).
2. The whole cumulative picture, regardless of which round is viewed:
   - **drawn-but-unscored** cards first, badged with which round they
     were drawn, badged "Drawn this round" when that's the round currently
     being viewed;
   - then already **scored** cards, faded, badged with both which round
     they were drawn *and* which round they were scored in (those can
     differ).

   Both groups are ordered by draw round, oldest first.
3. Two side-by-side buttons:
   - **"+ Select secondary"** -- opens a picker to draw a specific card by
     name;
   - **"Random"** -- draws uniformly at random from whatever's left in
     that role's deck, immediately, no extra tap.

### Command Points

- A `command_points` table (`20260322000000_command_points.sql`) holds
  `cp_gained`/`cp_spent` per seat per battle round (1-5, not the End of
  Game pseudo-round -- no CP-related scoring happens there).
- Written manually via `CommandPointsPanel`'s +/- counters, with the same
  "either participant can enter either side's" RLS as round/secondary
  scores.
- There's no SQL view the way `game_totals` has one for VP -- CP doesn't
  feed Elo/standings, so `remainingCp()` (`src/lib/queries/games.ts`) just
  sums `GameDetail.commandPoints` client-side wherever it's shown:
  - live next to the counters on `Scoreboard` (a running "N remaining"
    figure, updating every round);
  - as a final total on `SummaryPage`'s per-player card.

### `game_totals` and the fan-out bug

`game_totals` had a serious bug from its very first definition until
`20260321000000_fix_game_totals_fanout.sql`. Worth knowing about if you
touch any aggregate view:

- **What went wrong.** It left-joined `round_scores` *and*
  `secondary_scores` onto `game_players` in one query and summed both
  there. Joining two one-to-many relationships in a single query returns
  their *cross product* per player, not two independent row sets -- so
  `sum(primary_vp)` counted each round once per secondary scored, and
  `sum(vp_scored)` counted each secondary once per round played. Both were
  wrong by different multipliers that grew with every round and every
  secondary.
- **Blast radius.** Every consumer inherited it: the live running-total
  bar, Summary, History, ladder standings and Elo, and the round/game VP
  caps (clamping against an already-inflated total).
- **Fix.** Aggregate `round_scores` and `secondary_scores` to one row per
  player each in their own subquery *before* joining, so nothing
  downstream can multiply.
- **No backfill needed** -- the view is computed live, not stored, so
  every consumer was correct again the next time it was queried.

## Post-game summary

`SummaryPage` shows which terrain layout was actually used, image
included -- so the permanent record covers the battlefield setup, not
just the score.

- Just the layout, not the deployment too: the layout image already shows
  the deployment's battlefield shape underneath the terrain, so a separate
  deployment card would just be a duplicate, blanker view of the same
  board.
- The image comes from either seat's own resolved mission (both carry the
  same 3 image paths for a shared Force Disposition pairing -- the same
  reasoning `GameConfigPicker`'s `layoutMission` prop relies on). No new
  query needed; it's already-fetched reference data.

## Editing a finished game

A finished (complete or abandoned) game opens read-only on the
Scoreboard; a player taps **Edit**, changes things, then **Save** or
**Cancel**. Live games are unaffected -- every tap still saves straight
away.

- **How it works: a client-side draft** (`src/lib/queries/gameDraft.ts`).
  Every game mutation hook in `games.ts` already patched the query cache
  optimistically before writing. While a draft is open, the hooks still
  patch the cache but pass their database write to `writeOrQueue`, which
  queues it instead of running it. The screen shows the edited game;
  nothing has reached the server.
- **Save** replays the queued writes in the order they were made, then
  refetches the game, history and ladder standings. If a write fails, it
  and everything after it stay queued and edit mode stays open, so Save
  can just be retried.
- **Cancel** drops the queue and refetches, discarding the optimistic
  edits (with a confirm if there were any).
- **No refetch over a draft.** While drafting, the hooks' post-write
  invalidation (`settleGame`), the realtime channel's invalidation, and
  `useGame`'s focus/reconnect/stale refetches are all switched off.
- **Leaving.** In-app navigation away with unsaved changes asks first
  (`useBlocker`; round changes are only a `?round=` change, so they're
  allowed). Reload/tab close gets the browser's own `beforeunload`
  prompt. Unmounting the Scoreboard discards any open draft, so queued
  writes never fire from another screen.
- **Entry points.** The Edit button on the Scoreboard, or "Edit scores /
  result" on `SummaryPage`, which links with `state: { edit: true }` and
  lands already in edit mode. Edit mode is local, not a URL param -- it's
  unsubmitted draft input, which `CLAUDE.md` excludes from URL state.
- **Change result** is part of the draft too. `useFinishGame` /
  `useAbandonGame` now patch the cache optimistically and keep a game's
  existing `ended_at`, so correcting a result later doesn't move the game
  to the top of History.
- **Caveats.** The other player's edits made while you're drafting
  aren't shown until you Save or Cancel, and Save writes your values over
  theirs (the same last-write-wins as live editing). This is a UI guard,
  not a server-side lock -- RLS still lets a participant write to a
  finished game directly, as before. Cancelling the whole game (delete)
  still happens immediately, behind its own confirm.

## Spectating

Any signed-in user can open `/game/:id` and watch its current state,
participant or not.

- **Backend.** `20260320000000_spectating.sql` widens every game-related
  table's `SELECT` policy to `using (true)` for any authenticated user.
  Write policies are untouched -- still gated on
  `is_game_participant`/seat ownership -- so a spectator can see
  everything and change nothing.
- **`GamePage`** no longer hard-blocks a non-participant behind a "you're
  not a participant" error; it computes `isParticipant` and threads it
  into `WaitingRoom` and `Scoreboard`.
- **`WaitingRoom`** renders an entirely separate read-only branch for a
  spectator: same primary-mission and setup info, no join code, no
  editable forms, no Start/Cancel buttons.
- **`Scoreboard`** reuses its existing markup for everyone, but every
  control that would write something -- advancing the game's round, End
  game/Change result, Edit setup, the painted-bonus checkbox -- is gated
  behind `isParticipant` on top of whatever per-seat check it already
  had. `PrimaryScorePanel`/`SecondaryScores`/`GameConfigPicker` all have
  an `editable`/`disabled` prop, so a spectator sees the exact same
  checklist, draws, and Attacker/turn-order/layout picks with nothing
  tappable, rather than an interactive control that would just fail
  server-side.
- **Realtime presence** tags each viewer `player` or `spectator`, so a
  spectator showing up never flips the real opponent's "online" indicator
  on.
- **`SummaryPage`** needed no changes -- its controls were already gated
  on the viewer actually being a seat.

## Contesting and invalidating ladder games

Results are trusted by default; a player in a ladder game can contest it
and the ladder's admin (its creator) can invalidate it. All of it lives
in `20260928000000_game_contests.sql`. This **replaced** the earlier
"verify, then lock" model (issues #46/#72), which people forgot to use
and which made every unconfirmed game look suspect.

### Contests

- **`game_contests`** -- one row per (game, ladder) contested, with the
  contester, their reason (required, ≤1000 chars) and a status:
  `pending` → `dismissed` / `withdrawn` / `upheld`. A partial unique index
  allows one open contest per game per ladder.
- **Who can contest** (`contest_game` RPC): a seat holder --
  `is_game_seat_holder()`, i.e. `user_id` *or* `represents_user_id` is
  the caller -- in a game tagged to at least one ladder. Any game status,
  any time. It opens a contest on every tagged ladder that doesn't already
  have one open or an invalidation.
- **Who can read contests (RLS):** the game's seat holders (so the
  opponent sees it too) and the contested ladder's admin. Nobody else --
  a contest is an open question, not a verdict.
- **Withdraw** (`withdraw_game_contest`): the contester closes their own
  open contests on a game.
- **Dismiss** (`dismiss_game_contest`): the ladder admin; optional note.
- A contested game **still counts** in standings until it's invalidated.

### Invalidations

- **`ladder_game_invalidations`** -- (game, ladder) → admin, reason
  (required), timestamp. Readable by any signed-in user, like the
  standings themselves.
- **Its own table, not columns on `game_ladders`:** `set_game_ladders()`
  replaces a game's tags by delete-then-insert, which would wipe an
  invalidation stored on the tag (and let a participant clear one by
  untagging and re-tagging).
- **`invalidate_ladder_game`** (admin only) inserts the row and closes
  any open contest on that ladder as `upheld`, with the reason as its
  note. **`reinstate_ladder_game`** (admin only) deletes it again.
- **Effect:** `fetchLadderStandings` skips invalidated games entirely (no
  W/D/L, VP or rating change). `fetchLadderGames` still lists them, with
  the reason. History and stats are unaffected -- the game still
  happened.

### UI

- **`GameContestPanel`** (`src/components/`), on `SummaryPage`: shows any
  invalidation (with reason and admin), any open contest you can see, a
  "Withdraw my contest" button for the contester, and "Contest this
  result" (opens a `ReasonSheet`) for a seat holder while some ladder can
  still be contested. The admin gets a pointer to the Ladders page.
- **`LaddersPage`**: the admin's ladder row shows "N contested" even when
  collapsed; expanded, a `ContestedGames` block lists each open contest
  with **Invalidate** (required comment) and **Dismiss** (optional note).
  The game log shows invalidated games struck through with the reason,
  and a **Reinstate** link for the admin.
- **`HistoryPage`** tags rows "· Contested" / "· Invalidated".
- Realtime: `useGameChannel` subscribes to `game_contests` and
  `ladder_game_invalidations`, so the other player sees a contest land
  live.

### What happened to verification and locking

- **Nothing locks any more.** `is_game_fully_verified()` was re-declared
  (same signature) to always return `false`, which lifts the lock from
  every write policy that referenced it without re-declaring them.
- **Kept for released-app compatibility** (see `CLAUDE.md`):
  `game_player_verifications`, `game_unlock_requests` and their RPCs
  (`request_game_unlock`, `approve_…`, `reject_…`, `cancel_…`,
  `is_ladder_admin_for_game`) still exist but nothing in the app reads or
  writes them. Dropping them is a later "contract" migration.
- **Known gap:** a native build from before this change would still show
  the old verify/lock UI and would count invalidated games in standings
  (it doesn't know about `ladder_game_invalidations`). No native build has
  been published yet (#125), so in practice this only affects local
  debug APKs.

## History and player stats

### Player pages and name links (issue #28)

Player names are linked wherever they're shown -- ladder standings and
games list, History's opponent, both players' cards and the result table
on the live Scoreboard and the post-game Summary, the waiting room's
"Player 2" -- to a `/players/:userId` page (`PlayerNameLink`,
`src/components/`).

- It's the same `StatsPage` as `/stats`, just for someone else's account.
  `useCompletedGames(targetUserId)` reads every one of that user's
  *finished* games (complete or abandoned), full stop -- any signed-in
  user can see them.
- **Backend:** `20260314000000_finished_game_visibility.sql` widens
  `games`/`game_players`/`round_scores`/`secondary_scores` accordingly. A
  game still in the lobby or being played stays participant-only until it
  finishes. No new query logic was needed beyond that RLS widening --
  calling the existing history query with someone else's id already comes
  back right.
- **When a name doesn't link:**
  - when there's no stable account behind it (`playerUserId()`) -- an
    unclaimed, unattributed seat's army name stays plain text, since
    there's nobody to link to yet;
  - inside a button that does something else (declaring Attacker/turn
    order, confirming who won) -- navigating away isn't what tapping those
    does.

### History: every finished game

History shows every finished game from everyone, via
`fetchAllCompletedGames` (`src/lib/queries/history.ts`).

- **No migration needed.** The RLS backing a player's stats page already
  let any signed-in user read any finished game's rows
  (`20260314000000_finished_game_visibility.sql`); History's old
  participant-only scoping turned out to be a query-layer choice, not a
  backend restriction.
- **Row shape.** Returns games in a generic seat1/seat2 shape
  (`HistoryGameRow`/`AllGamesRow`) -- same "no single viewer to be
  relative to" reasoning as `fetchLadderGames` -- rather than
  `fetchCompletedGames`'s my/opponent framing. `fetchCompletedGames` stays
  exactly as it was, since `StatsPage`/`computeStats` still depend on it
  for a single player's own record.
- **Rendering.** `HistoryPage` renders every row the same way regardless
  of whether the viewer played in it -- the same "seat1 vs seat2, winner
  bolded" layout `LaddersPage`'s game list uses, deliberately not
  personalized into a "vs opponent"/mine-first framing. Within a row, the
  **matchup** (which armies fought) leads and is bolded for the winner,
  with the two players' names as a smaller, dimmer line underneath --
  History is a browse-all-games view, so which factions played is the
  primary thing being scanned for.
- **Cancel** is shown only when the viewer actually holds one of the
  game's two seats (their own account, or someone they solo-entered on
  behalf of). Not a framing choice -- just not offering an action that
  would fail server-side anyway (it's participant-gated via RLS).
- **Contested / Invalidated** tags on a row -- see [Contesting and
  invalidating ladder games](#contesting-and-invalidating-ladder-games).
- **Filters.** "My games only", Ladder, Faction, and Force Disposition
  are all filters over that one full set (Faction/Force Disposition match
  either seat, so "every game anyone's played as Necrons" works). Like
  the ladder filter, they live in the URL rather than component state.

## Ladders

### Basics

- The Ladders page lists every ladder (yours and others').
- `create_ladder` makes a new one, seats its creator, and mints its
  invite code.
- "Start a game" gets an optional ladder picker (only shown once you're
  in at least one); History gets a ladder filter once any of your games
  carry one.
- Standings are computed live in `src/lib/queries/ladders.ts`, not
  stored.
- **Visibility.** A ladder-tagged game is readable by any signed-in user,
  not just its two players (`20260310000000_ladder_game_visibility.sql`)
  -- otherwise a viewer's standings would silently only reflect games they
  personally played in, missing every result between other ladder
  members. Untagged games stay participant-only (though see also the
  later [finished-game](#history-and-player-stats) and
  [spectating](#spectating) widenings).

### Invite codes (issue #70)

`20260325000000_ladder_invite_codes.sql`.

- **Leaving** any ladder is still a self-service `ladder_members` delete.
- **Joining** requires that ladder's invite code: `join_ladder_by_code`
  (security definer) checks the code server-side and inserts the
  membership row itself. The old self-service "insert yourself into any
  ladder" policy is gone, so a direct client insert can no longer bypass
  the check.
- **Keeping the code private.** The code is deliberately not part of
  `fetchLadders`' own result -- that query, and the general `ladders`
  select grant, both explicitly leave `invite_code` out. Otherwise it'd
  sit right there in the same response the browse list already fetches
  for everyone.
  - It's read through `get_ladder_invite_code`, gated to current members
    (any member can see and share it, not just the creator -- same as
    sharing a game's own join code).
  - It's reset through `regenerate_ladder_invite_code`, creator-only like
    archiving/deleting the ladder itself.
- **Grandfathering.** Existing ladders and their membership were left
  untouched by the migration -- every ladder got a code backfilled, but
  nobody already in one had to re-join.
- Invite *links* are covered under
  [Shareable invite links](#shareable-invite-links).

### Archiving

- `ladders.archived_at` (null = active), settable only by that ladder's
  `created_by` via a creator-only update policy
  (`20260316000000_archive_ladder.sql`) and `useArchiveLadder`, toggled
  from an "Archive ladder"/"Restore ladder" action in the ladder's
  expanded row on the Ladders page.
- **Purely a visibility flag, not a cascade.** `fetchLadders` and the "tag
  this game" pickers on both the Ladders page and "Start a game" filter it
  out client-side, and `create_game`'s own membership check also rejects
  an archived ladder id server-side (so the client-side filtering can't be
  bypassed by calling the RPC directly). But standings, game log, and
  every game's own `ladder_name` keep resolving normally regardless of
  archived status, since none of those read the flag.
- The Ladders page has a third **"Archived"** section (only shown for
  ladders the viewer's a member of, or created) alongside "Your
  ladders"/"Other ladders", so an archived ladder's history stays
  reachable and it can be restored any time.

### Deleting

- A creator-only delete policy (`20260317000000_delete_ladder.sql`,
  `useDeleteLadder`) and a "Delete ladder permanently" action in the same
  expanded row, behind a `ConfirmSheet` since -- unlike archiving --
  there's no undo.
- No extra cleanup needed: `ladder_members` already cascades and
  `games.ladder_id` is already `on delete set null` (both from the
  original ladders migration), so a tagged game just becomes untagged
  rather than losing its own history.

### Ranking type: Elo or Glicko-2 (issue #68)

- `ladders.ranking_type` (`'elo' | 'glicko2'`, defaults to `'elo'` so
  existing ladders are unaffected), settable only by the creator via the
  same creator-only update policy archiving/deleting use, and picked from
  a `Select` in the ladder's expanded row (alongside Archive/Delete).
- **How standings are computed** (`fetchLadderStandings`):
  1. Build one `{playedAt, playerAId, playerBId, scoreForA}` entry per
     game with two identity-resolved seats. (A game with an unattributed
     opponent still counts toward that player's W/D/L/VP columns, but
     can't feed either rating replay -- there's no rating to exchange
     points with.)
  2. Sort them chronologically.
  3. Replay the whole thing through `computeEloRatings`
     (`src/lib/elo.ts`, K-factor 32) or `computeGlicko2Ratings`
     (`src/lib/glicko2.ts`), whichever the ladder's `ranking_type` picks.

  No rating is ever written to the database, so switching types takes
  effect the next time standings are fetched, same as any other edit.
- **Glicko-2 details:** rating + RD "confidence" + volatility per player,
  each game treated as its own single-game rating period rather than
  batching a season into one update, since this app has no natural period
  boundary (see the module's own doc comment). Verified against the
  worked numerical example in Glickman's "Example of the Glicko-2 system"
  paper.
- **Massey-Colley remains out of scope** (see issue #26): no natural
  per-game "you gained/lost N points" story, which is most of the point of
  showing a rating at all.

### Standings include every member

`fetchLadderStandings` seeds one row per `ladder_members` row at that
ranking type's starting rating (1500, 0-0-0) before folding in game
history, so a newly joined member is visible on their own ladder
immediately instead of only after their first result. A game's own
participants still get a row too even when they aren't (or are no longer)
a member.

### Ladder game log

A second "Show games" disclosure inside an already-expanded ladder row
(`LaddersPage`'s `GamesList`, `fetchLadderGames` in
`src/lib/queries/ladders.ts`) lists every completed game tagged to that
ladder -- not just the viewer's own, same visibility as standings -- most
recent first, each linking to that game's summary. Collapsed by default,
nested one level deeper than the ladder row itself, so opening a ladder
to see its standings doesn't also dump its whole history onto the screen.
Invalidated games stay in the list, struck through with the admin's
reason (and a Reinstate link for the admin) -- see [Contesting and
invalidating ladder games](#contesting-and-invalidating-ladder-games).

## URL-addressable view state

In-page view state lives in the URL, not local component state:

- `Scoreboard`'s viewed round is `?round=N` -- **pushes** a history entry
  per change, so back/forward steps between rounds (exactly what makes it
  bookmarkable and shareable).
- `HistoryPage`'s ladder filter is `?ladder=<id>` -- **replaces** in
  place, so picking a different ladder doesn't clutter back/forward with
  one entry per selection. (Its other filters live in the URL too.)

See `CLAUDE.md`'s "In-page view state belongs in the URL" for the general
rule and what's deliberately excluded from it (a `Sheet`/modal's
open-or-closed-ness, an accordion toggle, an unsubmitted form draft,
transient feedback).

## Installable PWA

Implemented (issue #97) via `vite-plugin-pwa` (`vite.config.ts`).

- **Manifest:** icons generated from the existing brand emblem,
  `display: standalone`, theme colors matching `ink`/`gold`.
- **Service worker precaches only the app shell** -- JS/CSS/HTML and the
  small brand/icon/result assets.
  - It explicitly excludes the ~30MB deployment/layout reference image
    library (still loaded and cached normally via the browser's regular
    HTTP cache on first view, just never pre-downloaded upfront).
  - It never intercepts Supabase REST/Realtime calls -- they always hit
    the network exactly as without a service worker.
  - This is an installable shell, **not offline-first data entry** -- see
    [goal.md's out-of-scope note](./goal.md#out-of-scope).
- **Updates** use `registerType: 'prompt'`: a new deploy's service worker
  sits ready in the background until `UpdatePrompt`
  (`src/app/UpdatePrompt.tsx`) shows a dismissible "Reload" banner, rather
  than silently reloading someone out from under a live game.
- **Install hint.** `InstallHint` (`src/components/InstallHint.tsx`),
  shown once on the Home page until dismissed, offers a real "Install" button
  on Android/Chrome (via the captured `beforeinstallprompt` event) and
  static Share-sheet instructions on iOS/Safari, which has no equivalent
  event.

# 40K Tracker

**Live app:** https://www.40ktracker.com
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

- Anyone can sign up -- with Google or with email/password, no invite
  needed. Signing up registers a display name (editable any time from
  Profile) that's what other players see in the waiting room, live
  scoreboard, and history/stats -- their email address is never shown
  to, or sent to, anyone else. A player can also add a profile photo
  from Profile (issue #73), shown as a small avatar wherever their name
  shows up (ladder/tournament standings and game lists, History, their
  own stats page) -- optional, and falls back to a plain initial when
  not set, same as a Google account's own picture already does for
  anyone who signed up that way. Profile also has a **theme** picker --
  a purely cosmetic, per-account choice of color scheme that applies
  everywhere the signed-in player looks, on every device they sign into,
  with no effect on anyone else's game or on how anything scores. Sixteen
  options: the original grimdark look, three lighter/brighter generic
  alternatives, and twelve faction-specific themes, one per crest below,
  each grounded in that faction's real palette and iconography rather
  than a generic recolor. The app's own crest is a separate, matching
  per-account choice: the header logo and the prominent one on the
  sign-in screen both follow whichever of thirteen the signed-in player
  picked from Profile -- the original Aquila, or twelve faction-flavored
  alternatives (Votann, Tyranid, T'au, Orks, Chaos, Sororitas, Grey
  Knights, Mechanicus, Thousand Sons, Dark Angels, World Eaters, Space
  Wolves) -- same "purely cosmetic, no effect on scoring" shape as the
  theme picker right next to it. Theme and crest stay two fully
  independent pickers -- picking a faction's theme doesn't change your
  crest, and vice versa -- even though most people will probably pick
  the matching pair.
- Signing in lands on a proper Home page, not straight into "start a
  game": the same prominent crest as the sign-in screen up top, and a
  shortcut to every section underneath (New game, History, Ladders,
  Tournaments, Stats, Profile) -- a front door, not a single-purpose
  lobby. Starting, joining, or logging a game, plus whatever's already
  in progress, lives one tap away behind its own "New game" nav item.
- One player starts a game (points limit, optionally a ladder to tag it
  to) and gets a short 6-character code, shareable either as that code
  (typed into a "Join a game" form) or as a link that joins
  automatically the moment it's opened, no typing needed. Nothing about
  either player's army -- or the terrain layout -- goes here -- that's
  all decided in the waiting room next, once both seats actually exist
  and, for the layout, once a Force Disposition pairing is known.
- A game already played somewhere else -- at a store, a tournament,
  before this app existed for a group -- can be **logged after the
  fact** instead: one form for both sides' faction, Force Disposition
  and army name, plus just the final score, no round-by-round play.
  It's recorded as a finished game immediately and counts toward
  standings/stats/Elo exactly like a live one -- there's no "round by
  round" history to show for it, just the final numbers.
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
- When a game finishes, each seat -- its own real occupant, or, for a
  solo-entered seat nobody's joined yet, the ladder member it was
  attributed to -- can confirm the result is correct with a one-tap
  "Verify this result", offered wherever that game shows up for them
  (its own summary, their history list). A single seat's confirmation
  is informational, not a gate: standings and stats already count the
  game either way, and if a score's wrong before both sides have
  confirmed, it's fixed the same way every other value in this app is,
  by editing it directly.
- Once **both** seats have confirmed, though, the game locks: neither
  player can unilaterally edit or delete it any more (a real trust
  boundary, enforced server-side, not just hidden buttons). Undoing that
  needs the other player's sign-off -- one player requests permission to
  edit, and the other approves or rejects it; approving just clears both
  confirmations, dropping the game back to its normal, editable state,
  which it leaves again the next time both sides re-confirm. If the
  other player won't respond, a creator of any ladder the game's tagged
  to can step in and approve the request themselves, as a
  dispute-resolution override.
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
  roll-off after the Deployment card is drawn -- the app's only explainer
  text for it is the one part with a real rules effect on how the game
  actually plays out: the Defender deploys first, then the Attacker. A
  second, separate roll-off decides who takes the first turn -- no
  explainer there, just asked by name -- whoever went first (the "top of
  round" player, as opposed to "bottom of round") shows first on the live
  Scoreboard once both are picked.
- Faction can also be filled in by pasting a NewRecruit
  (newrecruit.eu) list share link instead of picking from the dropdown --
  fetched server-side (an edge function, since NewRecruit's page has no
  CORS headers a browser could fetch directly) and matched against this
  app's own faction list. This only ever resolves Faction, never Force
  Disposition: NewRecruit has no equivalent field for that, since Force
  Disposition is a per-game strategic-role pick this app's own ruleset
  invents, not an army-list attribute any list builder would export --
  so Force Disposition still always needs picking by hand, import or not.
  Falls back to the manual dropdown, with a clear reason shown, on any
  bad link, unreachable NewRecruit, or unrecognized faction name. The
  link itself (`game_players.army_list_url`) is kept once NewRecruit
  answers with *a* faction name, even one that didn't match this app's
  own list -- it's still a real army list worth linking to -- and shows
  as "View army list" on that seat's card on the game summary
  afterwards, for either player or a spectator to open. There's also a
  plain "Army list link" field, independent of NewRecruit import, so a
  player using a different list builder (WarOrgan, anything else) can
  paste their own list link with no parsing involved -- it's the same
  `army_list_url` field either way.
- Faction *and* Force Disposition can both be filled in at once by
  pasting a plain-text army list export instead -- purely client-side,
  no backend fetch needed. Scans the pasted text for a line that's
  *exactly* one of this app's own Faction or Force Disposition names,
  not a fixed-position or per-tool structural parse -- true of every
  export format seen so far (NewRecruit, WTC, BattleScribe, the GW
  app), so this needs no per-tool branching. Force Disposition really
  is present in a NewRecruit plain-text export (confirmed against a
  real one), unlike NewRecruit's own *link* import above, which only
  ever resolves Faction. Whichever of the two it can't find just stays
  for the manual pickers, same partial-success fallback as everywhere
  else in this flow -- and the pasted text itself is never stored,
  only used to extract these two ids.
- Starting a game requires every one of those setup fields filled in for
  *both* seats -- faction, Force Disposition, and which of Fixed or
  Tactical they're playing Secondary Missions as, per seat, plus the
  shared terrain layout, Attacker/Defender, and who-went-first picks --
  with one deliberate exception: army name, which is flavour text with
  no gameplay effect, stays optional forever. There is no separate
  "ready" step on top of that; once the fields are filled in, either
  player can just start the game.
- Once the game starts, primary VP and secondary objectives are scored
  round by round (5 battle rounds, then an End of Game step -- see
  below), and whichever round is on screen is part of the URL -- so
  jumping back to check an earlier round is bookmarkable/shareable, and
  the browser's own back/forward moves between rounds, the same as any
  other distinct view in the app: what a page is currently showing is
  never state a URL alone can't reproduce (a modal's open-or-closed-ness
  is the one deliberate exception). With two players each on their own
  phone, scores update live for both as they're entered -- no
  refreshing, no "did you get that?" across the table -- and either one
  can enter either side's score, since players agree scores verbally at
  the table anyway. Bookkeeping
  both sides yourself works the same way, just from one phone.
- Any signed-in user can also just open a game and watch -- the waiting
  room's setup, or the live scoreboard round by round, exactly as its
  two players see it, updating live the same way. There's no separate
  spectator account type or invite for this: watching is just opening
  the link, same as playing is. The only thing that differs is that
  nothing on screen is tappable -- a spectator sees the same state as
  the players, but only the game's own two seats can ever change
  anything about it.
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
  -- every seat has to declare which, in setup, before the game can
  start (a two-button toggle, not a dropdown with a no-op "undecided"
  option), so the round screen always knows to show only the scoring
  conditions that actually apply to them, instead of both sets at once.
- Command Points are tracked too, round by round: how many a player
  gained and how many they spent that round, entered the same
  pick-what-happened way as everything else here -- the well-known "+1
  CP per round" isn't auto-granted, since this is a bookkeeping tool,
  not a rules engine that plays the game for you. Each player's
  remaining CP (everything gained so far, minus everything spent) is
  shown alongside, live, so nobody has to do the running maths
  mid-game, and the post-game summary keeps the final remaining total
  as part of the permanent record.
- The app knows the actual current missions, deployments, and secondary
  objectives for whichever Chapter Approved mission pack is active --
  this isn't a generic point counter, it understands the ruleset. When a
  new mission pack ships, the content updates without breaking the
  history of games played under the old one.
- At the end, either player can close out the game (a winner is
  suggested from the totals, or record a draw), and both players get a
  permanent record of it: a round-by-round breakdown, which terrain
  layout was played, and it folds into their history. The round-by-round
  table's combined per-round number can be expanded ("Show secondaries")
  into which specific secondary objective(s) each player scored that
  round and for how much, not just the lumped total -- collapsed by
  default, same as every other optional detail panel in this app. A
  game can also be ended early -- conceded, or the opponent had to
  leave -- from any round, not just the last one.
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
  broken down by faction played, Force Disposition, and opponent -- so
  "how do I do against Necrons?" or "what's my record playing Purge the
  Foe?" has a real answer instead of a memory. (The mission breakdown
  this had briefly -- each player has their own, so it read more like
  noise than a useful split -- is on hold for now; Force Disposition
  fills that slot instead.)
- The History page itself shows every finished game from everyone, not
  just the viewer's own -- filterable down to "my games only", a single
  ladder, a Faction, or a Force Disposition (any combination at once),
  so "show me every game anyone's played as Necrons" is a real view, not
  just a per-player stat.
- It's built to be used one-handed, on a phone, mid-game, with dice in
  the other hand -- not at a desk afterward. Large tap targets, no tiny
  number inputs, the screen stays on during an active game, and it copes
  with a flaky venue wifi connection dropping and reconnecting. It's also
  installable straight from the browser (issue #97) -- "Add to Home
  Screen" on Android or iOS gets a real home-screen icon and a
  full-screen launch with no browser chrome eating screen space, and the
  app shell (not your game data -- see "What's actually in place right
  now") loads instantly even over that same flaky venue wifi, since it's
  cached on the device rather than re-fetched every visit. Beyond that
  browser-install path, the same web app is also meant to ship as a real
  Google Play / App Store listing -- not a rewrite, a Capacitor wrapper
  around this same build (issue #97's research, issues #125/#126 for the
  per-platform plans) -- Android first, iOS once Android's proven out.

**What this deliberately is not (out of scope):**
tournaments/events, an army list builder, in-app chat, push
notifications, rematch chains, CP/painting scoring, or offline-first play
(a persisted local write queue that lets you keep entering scores with
no connection at all -- distinct from the installable app shell above,
which still needs a connection to actually save anything). See section
11 of `40k-tracker-plan.md` for the original v1 scoping -- superseded on
four points since: ladders/ranking (below), spectating (above),
installability (above), and an app-store-distributed native wrapper
(above) all turned out to be wanted after all, so those lines from the
original out-of-scope list no longer hold.

**Ladders:** a ladder is just a named group of players
(`ladders`/`ladder_members`) -- create one from the dedicated Ladders
page. Every ladder stays browsable by anyone signed in (name, member
count, standings, game log), but actually joining one -- your own or
someone else's -- requires that ladder's invite code, so a ladder's
membership isn't open to whoever happens to find it in the browse
list. Any current member can see and share the code, either as the
code itself or as a link that joins automatically once it's opened;
only the creator can regenerate it, invalidating whatever the old one
(code and link alike) was. The creator
can't leave their own ladder the way any other member can -- archiving
or deleting it (below) is the only way to step away from one they
made, since leaving would otherwise strand it with no one left who can
reach its settings. Tagging a
game onto a ladder is entirely optional, chosen at creation
time on the "Start a game" screen from a checklist alongside
tournaments (below) -- a game can be tagged to any combination of
ladders and/or tournaments at once (issue #75), not just one grouping
total, so two players who share more than one ladder together don't
have to pick which one a given game counts toward. Stays editable
afterwards like everything else. A ladder's creator can archive it once it's run its
course -- a season that's over, a group that's disbanded -- which drops
it out of the browse list and the "tag this game" picker without
touching anything it already recorded: standings, its game log, and
every affected game's own ladder name in History/stats all keep working
exactly as before. Archiving is fully reversible, no confirmation
needed, same as every other non-destructive toggle in this app. For the
other case -- a ladder created by mistake, a duplicate, a one-off test
-- the creator can also delete it outright, permanently: games tagged
to it aren't deleted, they just become untagged, same as if they'd
never been tagged to a ladder at all. Unlike archiving, this can't be
undone, so it's gated behind an explicit confirmation. Each ladder picks
its own ranking type, Elo or Glicko-2 (issue #68; see issue #26 for the
research behind these two specifically, and why TrueSkill/Massey-Colley
weren't a fit): everyone starts at 1500, and beating a much
higher-rated opponent gains a lot while beating a much lower-rated one
barely moves the needle (and the mirror image for losses) -- that
asymmetry falls out of the formula, it isn't a hand-written rule.
Glicko-2 additionally factors in how established each player's rating
currently is, which suits irregular, bursty tabletop play better than
Elo's flat per-game movement. Computed live by replaying a ladder's
whole game history in chronological order every time standings are
viewed -- never stored -- so editing a score, cancelling a game, or
switching which ranking type a ladder uses is reflected correctly the
moment the standings are viewed again, with no separate recalculation
step, despite both being inherently sequential.
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
faction/mission/opponent, across every game they've finished, full stop
-- every player's stats are open to anyone signed in, not limited to a
shared ladder or a game the viewer happened to be part of. A game still
in the lobby or being played is a different matter -- that stays visible
only to its own participants until it actually finishes, same as always.

**Tournaments:** a bounded pool of games -- a single weekend, an event
-- with its own standings, separate from a ladder's open-ended ongoing
history (issue #74). Modeled just like a ladder (own dedicated
Tournaments page, browsable by anyone signed in, invite-code-gated
joining, archive/delete, creator-only settings) with two differences:
an optional start/end date pair, purely descriptive -- shown on the
card, never enforced against when a game can be tagged to it, same
"bookkeeping tool, not guided workflow" philosophy as everything else
here -- and standings are a plain W/D/L + VP-diff tally rather than a
rating. A one-off bounded event has no ongoing skill to track between
events the way an open-ended ladder does, so Elo/Glicko-2 doesn't
apply here. A game can be tagged to a tournament, a ladder, both, or
neither, all from the same checklist at creation (or edited
afterwards from Game configuration) -- see Ladders above for the
shared multi-tagging mechanics.

**Terrain layout:** once a mission is resolved (both players' Force
Dispositions known), the 3 recommended terrain layouts (A/B/C) for that
specific Force Disposition pairing become pickable, each with its own
map image, in the shared `GameConfigPicker` -- a property of the game,
not of either seat's own setup, so it lives there alongside
Attacker/Defender rather than in `PlayerSetupFields`. Picking one is
required to start a game -- but, like every other setup field, stays
freely editable afterwards. There's no separate "deployment" choice
before this: each layout image already shows its own deployment
battlefield shape with the terrain placed on it, so asking which of the
6 named deployment maps to use, independently and before either
player's Force Disposition is even known, was never really a free
choice of its own -- just an earlier, blanker view of the same fact the
layout pick already covers. Each layout thumbnail is a physical-setup
reference as much as a picker, so it can be tapped open fullscreen (a
corner expand button) to read while setting up terrain across the
table -- and the screen is kept from sleeping for as long as that
fullscreen view stays open, since board setup takes a while and phones
otherwise lock mid-way through.

## What's actually in place right now

Everything in "the goal" above is implemented and deployed at the live
app URL, with two caveats worth knowing before you rely on them:

- **Google sign-in needs its OAuth client wired up** in the Supabase
  dashboard (Auth → Providers → Google) before it'll work in production;
  email/password sign-in works today without any extra setup.
- **The Android app-store wrapper (issue #125) is scaffolding, not a
  shipped app yet.** `capacitor.config.ts` and the generated `android/`
  native project are in the repo, wired up with a native-aware Google
  sign-in flow (`src/lib/nativeAuth.ts` -- routes OAuth through the
  system browser and picks the redirect back up via a
  `com.fortyktracker.app://` deep link, since Google blocks sign-in from
  inside an embedded WebView) and a native keep-awake fallback
  (`src/lib/useWakeLock.ts`, via `@capacitor-community/keep-awake`) for
  the same mid-game screen-on behavior the web build already has, and
  it's been tested on a real device with real Google sign-in working end
  to end. A `/privacy` page exists (linked from the landing page and the
  signed-in footer) with real, code-grounded content, and
  `android/app/build.gradle` has a release-signing config ready to read
  a keystore once one exists. Still not done: the upload keystore itself
  (a local, by-hand `keytool` step -- see README's "Publishing a real
  (signed) Android release" below), the Google Play Developer account,
  and the rest of the store listing (screenshots, description, content
  rating, Data Safety form) -- see #125 for the full remaining
  checklist. iOS (#126) hasn't been started.

Home is a proper landing page rather than the "start/join a game" hub it used to be: `HomePage`
(`src/features/lobby/HomePage.tsx`) is now just the prominent `BrandLogo`, the tagline, `InstallHint`,
and a `SHORTCUTS` grid linking to every section. Everything Home used to render directly -- the
Start/Join/Log-a-game buttons and the in-progress games list -- moved unchanged into
`GameLobbyPage` (`src/features/lobby/GameLobbyPage.tsx`), at its own route (`/game/lobby`) and nav
item ("New game", `src/app/Layout.tsx`'s `navItems`, placed right after Home). Nothing about that
content itself changed, only where it lives -- same reason a "Cancel this game" redirect or a
Summary page's "Home" button still just goes to `/home`, since landing on the new dashboard after
finishing or cancelling a game is a perfectly good place to end up too.

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
signed in -- see "Ladders" above. `fetchCompletedGames` (History, and
`StatsPage`/`/players/:userId`) resolves a user's own games the same
way fetchLadderStandings does -- `user_id` or `represents_user_id`, not
just `user_id` -- so a solo-entered, represents_user_id-attributed game
shows up in that player's own history and stats too, not only in ladder
standings.

Solo-entered-game verification (issue #46) is implemented via a
dedicated `game_player_verifications` table
(`20260315000000_seat_verification.sql`), not a column on
`game_players`: Postgres RLS ORs multiple permissive policies together
per-row, not per-column, so a `verified_at`/`verified_by` column there
would end up writable by the bookkeeper too (via the existing broader
"players can update their own seat, or claim/fill an unclaimed one"
policy), defeating the point. The table's own INSERT policies are the
sole gatekeeper instead: originally just the represented account, for a
seat still unclaimed (`user_id is null`) and attributed to them, on a
game that's actually finished -- issue #72
(`20260402000000_verified_game_lock.sql`) added a second policy letting
a claimed seat's own occupant confirm their own result the same way, so
"verified" now has a real meaning for a normal two-real-account game,
not just a solo-entered one. `needsVerification()` (`src/lib/gameLock.ts`,
re-exported from `src/lib/queries/games.ts` -- split into its own
module so it's importable from a unit test without pulling in
`supabase.ts`, which throws if the Supabase env vars aren't set, as
they deliberately aren't for the plain `npm run test` CI step) is the
shared predicate for "does this seat still need it" -- owned (either
way), finished, no verification row yet -- used by `SummaryPage` (a
"Verify this result" button on a seat the viewer owns, or a read-only
"awaiting confirmation" pill for the other seat) and `HistoryPage` (the
same button/pill inline per row, via `useVerifySeat`). Verifying a
single seat never blocks or changes anything else -- Elo/standings/
stats already count the game either way -- it only records that
whoever's behind that seat looked at it and confirmed it's right. Games
solo-entered before this shipped aren't backfilled: they simply show as
unverified like any other qualifying game rather than fabricating a
confirmation that was never actually given.

Once *every* seat in a game has verified it (`isGameLocked()`, mirroring
`is_game_fully_verified()` server-side), issue #72 locks it: every write
policy that lets a participant change a finished game's recorded result
-- round/secondary scores, primary/secondary objective ticks, secondary
draws, Command Points, `game_players` (faction/Force Disposition/army/
painted bonus/etc.), and `games` itself (update and delete) -- gets an
added `not is_game_fully_verified(game_id)` clause
(`20260402000000_verified_game_lock.sql`), always true and so a no-op
until a game actually finishes and both sides confirm it. This is the
real security boundary; nothing about it lives only in the client.
Unlocking is propose/approve, not a diff-level edit request: a
`game_unlock_requests` table (one pending row per game at a time, a
partial unique index enforces that) holds a participant's request, and
either the *other* participant or a creator of any ladder the game's
tagged to (`is_ladder_admin_for_game()`, a dispute-resolution override
for when the other player simply won't respond) approves or rejects it
via a security-definer RPC -- `request_game_unlock`/
`approve_game_unlock_request`/`reject_game_unlock_request`/
`cancel_game_unlock_request`, all in `src/lib/queries/games.ts`.
Approval's only effect is deleting both seats' verification rows --
that's the entire "unlock", since it just makes
`is_game_fully_verified` false again and every gated policy drops back
to its ordinary participant check; there's no separate "unlocked until
when" state tracked anywhere. `GameLockBanner`
(`src/components/GameLockBanner.tsx`) is the one UI surface for all of
this -- shown in both `Scoreboard` (where an edit would otherwise just
silently fail to save) and `SummaryPage` (where the confirm-result
action itself lives) -- and `HistoryPage` hides its per-row delete
button once a row is locked rather than offering an action that would
fail. Retagging a game's ladders/tournaments and the End of Game
layout-variant pick are deliberately *not* gated by the lock (a
documented scope trim): neither changes the recorded result itself, so
locking them didn't seem worth the added surface for this pass.

Logging a game after the fact (feature request) is a separate creation
path from `create_game`/`join_game_by_code`, added as its own RPC,
`log_completed_game()` (`20260403000000_log_completed_game.sql`) --
one call takes a brand new game straight to `status: 'complete'`,
skipping `lobby`/`active` and the whole live Scoreboard entirely. The
one real schema wrinkle: `game_totals.total_vp` has no direct-write
column of its own, it's always `SUM(round_scores.primary_vp) +
SUM(secondary_scores.vp_scored)` (plus painted bonus) -- so "just enter
a final score" has to land as `round_scores` rows underneath like
everything else that feeds that view, chunked into <=15VP pieces to
respect the existing per-row cap (`round_scores_primary_vp_max`), up to
6 rounds/90VP total (the RPC rejects anything higher rather than
truncating it silently). None of that chunking is a real "round by
round" record, so `games.is_retroactive` flags it and `SummaryPage`
skips its round-by-round table for a game with that flag rather than
render the split misleadingly. The logger is always seat 1 (same as
every other creation path) and is auto-verified immediately -- they
typed the result in themselves, there's no separate confirmation moment
to ask them for -- while the opponent seat reuses the exact same
solo-entry attribution as a live bookkept game (`represents_user_id` to
a real ladder member who can later confirm or dispute it, or a free-text
name with no account at all) and goes through the normal verification
flow. `src/features/lobby/LogGamePage.tsx` is the one form for all of
this, reachable from the New game lobby alongside "Start a game"/"Join a game".

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

`game_totals` itself had a serious bug from its very first definition
until `20260321000000_fix_game_totals_fanout.sql`: it left-joined
`round_scores` *and* `secondary_scores` onto `game_players` in one
query and summed both there -- joining two one-to-many relationships
in a single query returns their *cross product* per player, not two
independent row sets, so `sum(primary_vp)` counted each round once per
secondary scored, and `sum(vp_scored)` counted each secondary once per
round played, both wrong by different multipliers that grew with every
round and every secondary. Every consumer inherited it: the live
running-total bar, Summary, History, ladder standings and Elo, and the
round/game VP caps above (clamping against an already-inflated total).
Fixed by aggregating `round_scores` and `secondary_scores` to one row
per player each in their own subquery *before* joining, so nothing
downstream can multiply. No backfill needed -- the view is computed
live, not stored, so every consumer is correct again the next time it's
queried.

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
game*, not just this round's two. `SecondaryScores` leads with the same
small "Secondary VP" header `PrimaryScorePanel` uses for primary --
this round's total, and what it's actually still capped at (same
15VP-per-round/45VP-per-game rule) -- then shows the whole cumulative
picture regardless of which round is being viewed -- every
**drawn-but-unscored** one first (badged with which round it was drawn,
highlighted when that's the round currently being viewed), then already
**scored** ones below (badged with both which round it was drawn *and*
which round it was scored in, since those can differ) -- both
groups ordered by draw round, oldest first -- with two side-by-side
buttons below, "🎲 Random secondary" (draws uniformly at random from
whatever's left in that role's deck, immediately, no extra tap) and "+
Select secondary" (opens a picker to draw a specific card by name).

Fixed vs Tactical is implemented: `secondary_objective_lines.mode`
(`'fixed' | 'tactical' | null`) already tagged which of a card's lines
apply to which -- 4 of the 18 secondaries (A Grievous Blow, Engage on
All Fronts, Assassination, Bring It Down) have every line tagged one way
or the other, the remaining 14 are mode-agnostic throughout -- but
nothing read it before now, so the round screen showed every line for a
split card at once, "(fixed)"/"(tactical)" label and all. A
`game_players.secondary_mode` column (own seat's own choice, alongside
Faction/Force Disposition in `PlayerSetupFields`, not a shared
GameConfigPicker decision) records which a seat is playing; once set,
`SecondaryScores` filters a card's scoring lines to just that mode (plus
any mode-agnostic ones). It's picked via a two-button Fixed/Tactical
toggle, not a dropdown with an "undecided" option -- and, like faction,
Force Disposition, role, and turn order, both seats have to have picked
one before the game can start (`WaitingRoom`'s `canStart`, and
`start_game` server-side via `20260318000000_require_secondary_mode.sql`),
so a game can no longer be played all the way through without either
seat ever having actually declared one.

Command Points are implemented: a new `command_points` table
(`20260322000000_command_points.sql`) holds `cp_gained`/`cp_spent` per
seat per battle round (1-5, not the End of Game pseudo-round -- no
CP-related scoring happens there), written manually via
`CommandPointsPanel`'s +/- counters, same "either participant can enter
either side's" RLS as round/secondary scores. There's no matching SQL
view the way `game_totals` has one for VP -- CP doesn't feed
Elo/standings, so `remainingCp()` (`src/lib/queries/games.ts`) just sums
`GameDetail.commandPoints` client-side wherever it's shown: live next to
the counters on `Scoreboard` (a running "N remaining" figure, updating
every round), and as a final total on `SummaryPage`'s per-player card.

Ladders are implemented: the Ladders page lists every ladder (yours and
others'), `create_ladder` makes a new one, seats its creator, and mints
its invite code, "Start a game" gets an optional ladder picker (only
shown once you're in at least one), and History gets a ladder filter
once any of your games carry one. Leaving any ladder is still a
self-service `ladder_members` delete, but joining now requires that
ladder's invite code (issue #70,
`20260325000000_ladder_invite_codes.sql`): `join_ladder_by_code`
(security definer) checks the code server-side and inserts the
membership row itself -- the old self-service "insert yourself into any
ladder" policy is gone, so a direct client insert can no longer bypass
the check. The code is deliberately not part of `fetchLadders`' own
result (that query, and the general `ladders` select grant, both
explicitly leave `invite_code` out) -- otherwise it'd sit right there in
the same response the browse list already fetches for everyone,
defeating the point of gating it. Instead it's read through
`get_ladder_invite_code`, gated to current members (any member can see
and share it, not just the creator, same as sharing a game's own join
code), and reset through `regenerate_ladder_invite_code`, creator-only
like archiving/deleting the ladder itself. Existing ladders and their
membership were grandfathered in untouched by the migration -- every
ladder got a code backfilled, but nobody already in one had to
re-join. Standings are computed live in
`src/lib/queries/ladders.ts`, not stored. A ladder-tagged game is
readable by any signed-in user, not just its two players
(`20260310000000_ladder_game_visibility.sql`) -- otherwise a viewer's
standings would silently only reflect games they personally played in,
missing every result between other ladder members. Archiving a ladder
is implemented too: `ladders.archived_at` (null = active), settable
only by that ladder's `created_by` via a new creator-only update policy
(`20260316000000_archive_ladder.sql`) and `useArchiveLadder`, toggled
from a "Archive ladder"/"Restore ladder" action in the ladder's own
expanded row on the Ladders page. Purely a visibility flag, not a
cascade: `fetchLadders` and the "tag this game" pickers on both the
Ladders page and "Start a game" filter it out client-side, and
`create_game`'s own membership check now also rejects an archived
ladder id server-side (so the client-side filtering can't be bypassed
by calling the RPC directly) -- but standings, game log, and every
game's own `ladder_name` keep resolving normally regardless of archived
status, since none of those read the flag. The Ladders page adds a
third "Archived" section (only shown for ladders the viewer's a member
of, or created) alongside "Your ladders"/"Other ladders", so an
archived ladder's history stays reachable and it can be restored any
time. Permanent deletion is implemented too, alongside archiving: a new
creator-only delete policy (`20260317000000_delete_ladder.sql`,
`useDeleteLadder`) and a "Delete ladder permanently" action in the same
expanded row, behind a `ConfirmSheet` since -- unlike archiving --
there's no undo. No extra cleanup needed for what a deleted ladder
leaves behind: `ladder_members` already cascades and `games.ladder_id`
is already `on delete set null` (both from the original ladders
migration), so a tagged game just becomes untagged rather than losing
its own history. Untagged games stay
participant-only, unchanged.

Shareable invite links are implemented for both ladders and games, on
top of their existing codes rather than replacing them: a code typed
into a form still works exactly as before, but the same code can also
be shared as a URL (`/ladders/join/<code>`, `/game/join/<code>`) that
joins automatically the moment it's opened. Games needed no schema
change for this -- `join_game_by_code` already resolves a game from the
code alone (it's globally unique), so `/game/join/:code` is purely a
new route on the existing `JoinGamePage`, which auto-submits when a
code arrives via the URL instead of the manual field, then redirects
into the game. Ladders needed one new RPC,
`join_ladder_by_invite_code(p_code)`
(`20260918010000_ladder_invite_links.sql`): the existing
`join_ladder_by_code(p_ladder_id, p_code)` needs a ladder id the client
doesn't have from a bare link (`invite_code` is deliberately not part
of the public "browse ladders" read path -- see above), so the new
function resolves the ladder from the code itself server-side before
inserting the membership row, same `on conflict do nothing` idempotency
as the id-based version. `LadderJoinPage` (`/ladders/join/:code`) calls
it on arrival and redirects to the Ladders page. Both `WaitingRoom`
(games) and the Ladders page's invite-code section now offer "Copy
code"/"Copy link" side by side. Since both join routes sit behind
`ProtectedRoute`, opening one signed out bounces through the landing
page first -- `ProtectedRoute` already stashed the original URL in
router state, but until now nothing read it back, so sign-in always
landed on `/home` regardless of what brought you there. `LandingPage`
now resolves that stashed location into a `next` path (defaulting to
`/home` when there isn't one) and redirects there once signed in;
for the two flows that leave the SPA and come back (Google OAuth,
and email confirmation on signup) `next` is round-tripped as a query
param on the `/auth/callback` redirect URL, since router state doesn't
survive that round trip, and `AuthCallback` only trusts it back if it
looks like an in-app path (starts with `/`, not `//`). Net effect: a
brand-new invitee who isn't signed in yet can still follow an invite
link straight through sign-up/sign-in and land exactly on the
ladder/game they were invited to, not on the home screen.

Which ladder a game's tagged to also stays editable for the life of the
game, not just a one-time pick at creation: `useSetLadder` (a plain
`games.ladder_id` write, same "participants can update their games"
policy every other game-level field already relies on -- no new policy
needed) and a "Ladder game?" `Select` in `GameConfigPicker`, alongside
layout/Attacker/turn order, in both the waiting room and the live
Scoreboard's "Game configuration" sheet. The dropdown only offers
ladders the viewer's currently a non-archived member of, plus whichever
one's already set (even if archived, or the viewer's since left it) so
a stale selection never just disappears from the list.

Ranking type is a per-ladder choice, implemented (issue #68): every
ladder has a `ladders.ranking_type` column (`'elo' | 'glicko2'`,
defaults to `'elo'` so existing ladders are unaffected), settable only
by that ladder's creator via the same creator-only update policy
archiving/deleting already use, and picked from a `Select` in the
ladder's own expanded row (alongside Archive/Delete). `fetchLadderStandings`
builds one `{playedAt, playerAId, playerBId, scoreForA}` entry per game
with two identity-resolved seats (a game with an unattributed opponent
still counts toward that player's W/D/L/VP columns, but can't feed
either rating replay -- there's no rating to exchange points with),
sorts them chronologically, and replays the whole thing through
whichever of `computeEloRatings` (`src/lib/elo.ts`, K-factor 32) or
`computeGlicko2Ratings` (`src/lib/glicko2.ts`) that ladder's
`ranking_type` picks -- no rating is ever written to the database, so
switching types takes effect the next time standings are fetched, same
as any other edit. Glicko-2's implementation (rating + RD "confidence"
+ volatility per player, each game treated as its own single-game
rating period rather than batching a season into one update, since this
app has no natural period boundary -- see the module's own doc comment)
is verified against the worked numerical example in Glickman's "Example
of the Glicko-2 system" paper. Massey-Colley remains out of scope (see
issue #26): no natural per-game "you gained/lost N points" story, which
is most of the point of showing a rating at all.

Standings show every current ladder member, not just the ones who've
played a tagged game yet: `fetchLadderStandings` seeds one row per
`ladder_members` row at that ranking type's starting rating (1500,
0-0-0) before folding in game history, so a newly joined member is
visible on their own ladder immediately instead of only appearing after
their first result. A game's own participants still get a row too even
when they aren't (or are no longer) a member, same as before.

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
signed-in user's own: `useCompletedGames(targetUserId)` reads every one
of that user's *finished* games (complete or abandoned), full stop --
any signed-in user can see them, not just ones shared with a ladder in
common or personally played in
(`20260314000000_finished_game_visibility.sql` widens `games`/
`game_players`/`round_scores`/`secondary_scores` accordingly; a game
still in the lobby or being played stays participant-only until it
finishes). No new query logic needed beyond that RLS widening -- calling
the existing history query with someone else's id already comes back
right. A name only links when there's a stable account behind it
(`playerUserId()`): an unclaimed, unattributed seat's army name stays
plain text, since there's nobody to link to yet. Names inside a button
that does something else (declaring Attacker/turn order, confirming who
won) are deliberately left unlinked -- navigating away isn't what
tapping those does.

Terrain layout selection, Attacker/Defender, and turn order are all
implemented. There's no separate "deployment" picker at game creation
any more (`20260323000000_deployment_optional.sql`): `games.deployment_id`
is nullable now and `create_game` no longer takes it as a parameter --
the 3 terrain layout alternatives, picked once a Force Disposition
pairing is known, already fully determine (and visually show) the
deployment, so asking for one independently, before either player had
even picked a Force Disposition, was never a real choice on top of
that. `useDeployments` and the "Deployment" `ImageOptionGrid` that used
to live on `NewGamePage` are gone; the `deployments` table and existing
games' `deployment_id` stay untouched, same "never touch old history"
rule this app applies to every other schema change -- new games just
don't set it. All three of terrain layout/Attacker/turn order are all
*game*-level decisions, not a per-seat one, so none of them live in
`PlayerSetupFields` (each seat's own setup form: Faction, Force
Disposition, Army name) -- they live together in the shared
`GameConfigPicker` (`src/features/game/`): once
a game's mission is resolved (so the Force Disposition pairing is
known), the 3 recommended terrain layouts for that pairing become
pickable there; Attacker/Defender and turn order are asked as "who is
Attacker?" and "who went first?" by name, once, rather than shown as a
toggle on both players' own setup forms. `GameConfigPicker` lives in its
own "Game configuration" card in the waiting room, and behind a "Game
configuration" row inside the live Scoreboard's "⋯" menu (see below).
Picking a name for Attacker/turn order sets both seats at once, through
the `set_role`/`set_turn_order` RPCs
(`20260324000000_shared_role_and_turn_order.sql`) -- either participant's
pick is final, like an actual roll-off at the table, not something the
other player has to separately go confirm on their own device before a
game can start. These replaced an earlier client-side mirroring helper
(`setMirroredField`) that could only ever write the *other* seat when it
was unclaimed or the caller's own -- a real second player's already-
claimed seat was invisible to a plain client update under
`game_players`' "own seat only" RLS policy, so picking a role/turn order
silently left their side unset until they went and picked it themselves
too. The RPCs are `security definer`, gated only by `is_game_participant`
(same trust level as round/secondary scores, "either player may enter
either seat's score"), so they can write both rows regardless of who
owns which; direct client writes to `role`/`turn_order` are revoked from
`authenticated` now that the RPCs are the only path. All three fields
are **required to start a game**, same as every setup field
except army name (`WaitingRoom`'s `canStart`, and the `start_game` RPC
server-side), but like every other setup field they stay freely editable
for the life of the game once chosen -- required-before-start and
always-editable-after are not in tension.

The post-game `SummaryPage` shows which terrain layout was actually
used, image included -- so the permanent record a game leaves behind
covers the battlefield setup, not just the score. Just the layout, not
the deployment too: the layout image already shows the deployment's
own battlefield shape underneath the terrain, so a separate deployment
card next to it would just be a duplicate, blanker view of the same
board. The image comes from either seat's own resolved mission (both
carry the same 3 image paths for a shared Force Disposition pairing,
same reasoning `GameConfigPicker`'s own `layoutMission` prop already
relies on) -- no new query needed, already-fetched reference data.

`GameConfigPicker`'s explainer text is deliberately terse: Attacker gets
one line -- "The Defender deploys first, then the Attacker" -- the only
part of that pick with an actual rules effect, and the only thing that
meaningfully differs between the two roles under the current ruleset.
Went first gets no explainer at all -- just the label and the two name
buttons -- on the assumption a player asking to set it already knows
it's decided by its own roll-off.

Display names never derive from email: `handle_new_user()`'s fallback
(when a signup provides no name at all) generates a generic placeholder,
never the email's local part, and the signup form requires a display
name for email/password accounts so that fallback is rarely even hit.
Realtime presence -- broadcast to everyone subscribed to a game's channel
-- sends the profile display name, never the raw email, fixed alongside.

`Layout`'s header nav (5 links plus Sign out) is responsive: shown
inline from `sm:` breakpoint up, collapsed behind a "☰" button at phone
width, opening the same bottom `Sheet` used everywhere else in the app
rather than a bespoke dropdown -- the 6-item row used to force a
horizontal zoom-out on a real phone screen instead of wrapping. The
footer also picked up the same `max-w-3xl` centering the header and
main content already had, so it no longer stretches wider than the rest
of the page on a wide screen.

The live Scoreboard's own round header had the same problem, worse
after spectating (above) added a "Spectating" badge and an "opponent
online" indicator alongside the existing "Game configuration"/"Summary"
links -- up to four non-wrapping inline items was again enough to force
a phone-width zoom-out. Collapsed the same way: those become rows
inside a single "⋯" `Sheet` ("Game"), leaving just a small colored dot
(opponent online/offline, participants only) next to the "⋯" button
itself in the header row. "Spectating" moved to its own line under the
round/status text instead (vertical stacking, not another item fighting
for width in that row) -- `Scores stay editable`/`Layout X` already did
the same there.

In-page view state lives in the URL, not local component state --
`Scoreboard`'s viewed round is `?round=N` (pushes a history entry per
change, so back/forward steps between rounds -- exactly what made it
bookmarkable and shareable in the first place) and `HistoryPage`'s
ladder filter is `?ladder=<id>` (replaces in place, so picking a
different ladder doesn't clutter back/forward with one entry per
selection). See `CLAUDE.md`'s "In-page view state belongs in the URL"
for the general rule this follows and what's deliberately excluded from
it (a `Sheet`/modal's open-or-closed-ness, an accordion toggle, an
unsubmitted form draft, transient feedback).

Spectating is implemented: any signed-in user can open `/game/:id` and
watch its current state, participant or not
(`20260320000000_spectating.sql` widens every game-related table's
`SELECT` policy to `using (true)` for any authenticated user -- write
policies are untouched, still gated on `is_game_participant`/seat
ownership, so a spectator can see everything and change nothing).
`GamePage` no longer hard-blocks a non-participant behind a "you're not
a participant" error; it computes `isParticipant` and threads it into
`WaitingRoom` and `Scoreboard`. `WaitingRoom` renders an entirely
separate read-only branch for a spectator (same primary-mission and
setup info, no join code, no editable forms, no Start/Cancel buttons).
`Scoreboard` reuses its existing markup for everyone, but every control
that would write something -- the round-advance buttons, End
game/Change result, Edit setup, the painted-bonus checkbox -- is gated
behind `isParticipant` on top of whatever per-seat check it already
had, and `PrimaryScorePanel`/`SecondaryScores`/`GameConfigPicker` all
gained an `editable`/`disabled` prop so a spectator sees the exact same
checklist, draws, and Attacker/turn-order/layout picks with nothing
tappable, rather than an interactive control that would just fail
server-side. Realtime presence now tags each viewer `player` or
`spectator`, so a spectator showing up never flips the real opponent's
"online" indicator on. `SummaryPage` needed no changes -- its own
controls were already gated on the viewer actually being a seat.

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
is available from the New game lobby's in-progress list, History list, waiting room, and
scoreboard, always behind a confirm step; and `game_players`/`games`
state transitions that used to be enforced only in the UI (starting a
game before its setup is actually complete, cross-game score writes) are
now also checked server-side (`start_game` RPC, RLS).

The app is installable as a PWA (issue #97), via `vite-plugin-pwa`
(`vite.config.ts`): a web manifest (icons generated from the existing
brand emblem, `display: standalone`, theme colors matching `ink`/`gold`)
plus a service worker that precaches only the app shell -- JS/CSS/HTML
and the small brand/icon/result assets, explicitly excluding the ~30MB
deployment/layout reference image library (still loaded and cached
normally via the browser's regular HTTP cache on first view, just never
pre-downloaded upfront) and every Supabase REST/Realtime call, which are
never intercepted by the service worker and always hit the network
exactly as without one. This is an installable shell, not offline-first
data entry -- see the out-of-scope note above for that distinction.
Updates use `registerType: 'prompt'`: a new deploy's service worker sits
ready in the background until `UpdatePrompt` (`src/app/UpdatePrompt.tsx`)
shows a dismissible "Reload" banner, rather than silently reloading
someone out from under a live game. `InstallHint`
(`src/components/InstallHint.tsx`), shown once on the Home page until
dismissed, offers a real "Install" button on Android/Chrome (via the
captured `beforeinstallprompt` event) and static Share-sheet
instructions on iOS/Safari, which has no equivalent event.

History shows every finished game from everyone, not just the viewer's
own, via a new `fetchAllCompletedGames` (`src/lib/queries/history.ts`) --
no migration needed, since the RLS backing a player's stats page
already let any signed-in user read any finished game's rows
(`20260314000000_finished_game_visibility.sql`); History's old
participant-only scoping turned out to be a query-layer choice, not a
backend restriction. That function returns games in a generic
seat1/seat2 shape (`HistoryGameRow`/`AllGamesRow`), same "no single
viewer to be relative to" reasoning as `fetchLadderGames`, rather than
the existing `fetchCompletedGames`'s my/opponent framing -- which stays
exactly as it was, since `StatsPage`/`computeStats` still depend on it
for a single player's own record. `HistoryPage` renders every row the
same way regardless of whether the viewer played in it -- the same
"seat1 vs seat2, winner bolded" layout `LaddersPage`/`TournamentsPage`'s
own game lists use, deliberately not personalized into a "vs opponent"/
mine-first framing for the viewer's own games. Within a row, the
matchup (which armies fought) leads and is bolded for the winner, with
the two players' names as a smaller, dimmer line underneath -- History
is a browse-all-games view, so which factions played is the primary
thing being scanned for, not who played them. Cancel and Verify are the
one exception, shown only when the viewer actually holds one of the
game's two seats (their own account, or someone they solo-entered on
behalf of) -- not a framing choice, just not offering an action that
would fail server-side anyway (both are participant-gated via RLS
regardless). "My games only", Ladder, Faction, and Force
Disposition are all filters over that one full set (Faction/Force
Disposition matching either seat, so "show me every game anyone's
played as Necrons" works), and -- like the pre-existing ladder filter --
live in the URL rather than component state.

Player avatars are implemented (issue #73). `profiles.avatar_url` already
existed (Google sign-in was already populating it from the provider's
own picture) -- what was missing was a manual upload path and anywhere
that actually rendered it. Uploading goes through
`src/lib/resizeImage.ts`: center-crops to a square, downsamples to
256px, and compresses to WebP (falling back to whatever format a
browser's canvas actually emits, per spec, if it doesn't support WebP
encoding), stepping quality down until it's under ~200KB or hits a
floor -- entirely client-side, no edge function involved. The result
uploads to a new `avatars` Supabase Storage bucket
(`20260401000000_player_avatars.sql`) at a fixed `<user id>/avatar.<ext>`
path (a re-upload just overwrites it, `upsert: true`, rather than
accumulating orphaned files), gated by storage RLS so a user can only
write inside their own folder; the bucket's own 500KB `file_size_limit`
is a backstop, not the primary control. `Avatar`
(`src/components/Avatar.tsx`) renders the image, or a plain initial on
a neutral background when there isn't one. `PlayerNameLink` takes an
optional `avatarUrl` and renders a small `Avatar` inline before the
name when given one -- omitted entirely, it renders exactly as before,
so this didn't require touching every existing call site at once, only
the ones actually wired up: ladder/tournament standings and game lists,
History (both its "mine" and generic row layouts), and a player's own
stats page header. Scoreboard/WaitingRoom/SummaryPage's own name
displays weren't wired up in this pass -- deliberately trimmed, since
those are tighter, more overflow-sensitive layouts where a 1-on-1
scoreboard gets less benefit from an avatar than a list of many names
does; `PlayerNameLink`'s optional prop means adding it there later is a
small, isolated follow-up, not a redesign.

Theming is implemented: `profiles.theme`
(`20260918000000_profile_theme.sql` for the original four,
`20260921000000_profile_theme_factions.sql` widening the same check
constraint to add twelve more; `Theme` in `src/lib/database.types.ts` is
the full sixteen-value union, `'grimdark' | 'astartes' | 'aeldari' |
'parchment' | 'votann' | 'tyranid' | 'tau' | 'orks' | 'chaos' |
'sororitas' | 'greyknights' | 'mechanicus' | 'thousandsons' |
'darkangels' | 'worldeaters' | 'spacewolves'`, defaulting existing and
new profiles to `'grimdark'`, the original look) drives a `data-theme`
attribute on `<html>`. Every color a component uses is a semantic
Tailwind v4 `@theme` token (`ink`/`paper`, `blood`/`blood-dark`, `gold`,
`steel`, the `veil`/`veil-strong`/`veil-loud` subtle-fill/hairline
scale, `danger`/`danger-dark`, `success`, and the fixed `onfill` used
only for text sitting on a solid `blood`/`steel`/`danger` fill) rather
than a literal color anywhere in a component -- `src/index.css`
redefines those same variable names once per theme under a
`[data-theme='...']` selector per non-default theme (grimdark needs no
selector, it's the base `@theme` values), so no component changed to
add the other fifteen. That ruled out literal `white/black`-at-N%-opacity
utilities too, since a translucent white wash is invisible on a light
theme's background -- every `bg-white/5`-style utility across the app
was replaced with the `veil` scale, and `text-red-400`/`text-green-400`
with `danger`/`success`, so panels, dividers, error/online-status text,
and the modal/photo-viewer scrims all still read correctly under the
light themes (`aeldari`/`parchment`/`tau`/`sororitas`/`spacewolves`),
not just the dark ones. The twelve faction themes (`votann`, `tyranid`,
`tau`, `orks`, `chaos`, `sororitas`, `greyknights`, `mechanicus`,
`thousandsons`, `darkangels`, `worldeaters`, `spacewolves`) pair with
the matching crest below by id, each grounded in that faction's real
palette rather than a generic recolor, with every `blood`/`steel`/
`danger` value checked for WCAG AA contrast (>=4.5:1) against `onfill`
and every `gold` against that theme's own `ink`. `ThemeSync`
(`src/app/ThemeSync.tsx`, mounted once in `App.tsx`) applies the
signed-in user's `profiles.theme` to `<html>` whenever it loads or
changes, and caches it to `localStorage` (`40k-theme`); a small inline
script in `index.html`, running before React, reads that same cached
value so a returning visitor never sees a flash of the default theme
before their real one applies. `ProfilePage` renders all sixteen as a
swatch grid (ink/blood/gold preview dots per theme, sourced from
`src/lib/theme.ts`'s own copy of those hex values, since the picker has
to show themes that aren't the active one); picking one applies
instantly (`applyTheme`) and saves through the same `useUpdateProfile`
mutation display name/avatar already use.

The app's crest is a matching per-account pick, implemented the same shape as theming:
`profiles.logo` (`20260918020000_profile_logo.sql`, originally `'default' | 'mechanicus' |
'tyranid' | 'custodes' | 'orks' | 'chaos'`, widened to add `'sororitas'` in
`20260918030000_profile_logo_sororitas.sql` -- a check constraint can't just be extended in place,
so that migration drops and recreates `profiles_logo_check`, a pattern reused again in
`20260918040000_rename_logo_mechanicus_to_votann.sql` to rename the mislabeled `'mechanicus'` value
to `'votann'` once it turned out that crest was actually Leagues of Votann, migrating any profile
that had already picked it along with it, and four more times in
`20260918050000_profile_logo_greyknights.sql`, `20260918060000_profile_logo_mechanicus.sql`,
`20260918070000_profile_logo_thousandsons.sql`, and `20260918080000_profile_logo_chapter_pack.sql`
to add `'greyknights'`, then (once a genuine Mechanicus crest replaced the mislabeled one) a proper
`'mechanicus'`, then `'thousandsons'`, then `'darkangels'`/`'worldeaters'`/`'spacewolves'` together
in one batch, and once more in `20260918090000_rename_logo_custodes_to_tau.sql` -- the same
mislabeling shape as the Votann rename, this time for the white/red robotic crest, which turned
out to be T'au Empire iconography rather than Adeptus Custodes -- to rename `'custodes'` to `'tau'`,
again migrating any profile that had already picked it -- defaulting existing and new profiles to
`'default'`, the original Aquila)
resolves through `src/lib/logo.ts`'s `LOGOS` table (each entry's own `src` plus its
intrinsic `width`/`height`, since the thirteen crests don't share one aspect ratio) to whichever image
`BrandLogo` (`src/components/BrandLogo.tsx`) renders -- the single component `Layout`'s header,
`LandingPage`'s sign-in hero, and `HomePage`'s own hero all use, so there's one place resolving
"whose logo is this" rather than three copies. `Layout` skips its own copy specifically on `/home`
(`useLocation().pathname === '/home'`), since Home already renders the same crest full-size right
below the header -- a second, small one up there would just be redundant; every other page still
shows it, as the app's one consistent "back to Home" anchor. Resolution prefers the signed-in
user's live `profiles.logo`, falling
back to whatever was last cached to `localStorage` (`40k-logo`) for that device -- covering the
signed-out landing page and the moment before a signed-in user's profile has loaded -- the same
two-tier fallback theming uses, just without theme's inline `index.html` bootstrap script, since a
single swapped `<img>` is a far smaller flash than a whole page repainting under the wrong colors.
`LogoSync` (`src/app/LogoSync.tsx`, mounted in `App.tsx` alongside `ThemeSync`) keeps that cache in
sync with the loaded profile. `ProfilePage` renders all thirteen as an image-thumbnail grid, the same
selected/unselected swatch-button styling the theme picker uses. Picking one calls
`cacheLogo` for the immediate localStorage-backed fallback and `useUpdateProfile({ logo })` --
which now applies every patch optimistically (`onMutate` merges it into the cached profile before
the write lands, rolled back on failure) rather than waiting on a round trip, so a picked logo
updates everywhere it's shown -- the picker's own selected state and the header's `BrandLogo`
alike -- the instant it's clicked, not once Postgres responds. Theme didn't need this (`applyTheme`
already mutates `<html>` directly, independent of the query cache), but logo reads the profile
straight from cache, so without it the header would lag a network round trip behind the picker.
Each `LOGOS` entry also carries a `quote` -- an in-universe flavor line for that crest -- which
`BrandLogo`'s `altVariant="quote"` prop swaps in as the landing page logo's alt text (the header's
own `BrandLogo` keeps the plain "40K Tracker" default, since its `NavLink` wrapper already names
the app for a screen reader; the landing page's logo has no such wrapper).

## Stack

Vite + React + TypeScript (strict), React Router, TanStack Query, Tailwind
CSS, Zod, `vite-plugin-pwa` (installability, see "What's actually in
place right now"), and Supabase (Postgres + Auth + Realtime) as the
serverless backend. Deployed to Cloudflare Pages via GitHub Actions.

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
  /features        auth, lobby, game, history, ladders, tournaments, stats, profile
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

Picking a Force Disposition resolves its mission (and, once both are
resolved, unlocks the terrain layout picker) without waiting on the
`resolve_game_mission` round trip: `useUpdatePlayerSetup` now predicts
the same result client-side (`src/lib/missionResolution.ts`'s
`resolveMissionId`, an exact mirror of the RPC's own lookup) the moment
a Force Disposition patch lands, seeding both the resolved mission id
*and* `useMission`'s own cache entry for it (from the whole pack, already
fetched via `useMissionsForPack` -- reference-scale, ~25 rows, fetched
once) -- so the mission's name and layout images show up the same render
as the id does, not a further fetch later. Same "patch now, reconcile
on settle" pattern as every other mutation in this app; the RPC still
runs and is still what actually gets written, this is purely a client-
side head start on it. `LayoutVariantPicker` also renders a same-sized
skeleton (`LayoutVariantSkeleton`, three pulsing placeholder cells)
instead of nothing while a mission genuinely isn't resolved yet (still
waiting on the *other* player's Force Disposition, which the above can't
shortcut) -- so its card doesn't visibly grow the instant it does
resolve.

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
see the migration's comment) -- a deployment is the battlefield shape, a
layout is the terrain piece placement on top of one, and each layout
image already shows both together, which is exactly why this app
dropped asking for a deployment as a separate, independent pick (see
"What's actually in place right now" above,
`20260323000000_deployment_optional.sql`). Picking a layout
(`games.layout_variant`) is required before a game can start, same as
every other setup field except army name -- but, like those, stays
freely editable for the life of the game once set.

When the next Chapter Approved deck ships: add a new `mission_packs` row
and a new migration with its missions/secondary_objectives (and, if you
want the checklist to keep working, their objective lines too), the same
way -- don't touch the old pack's migration, existing games keep pointing
at it.

## Deployment

`deploy.yml` runs on every push to `main`: typecheck, test, build,
`supabase db push` against the linked project, `supabase functions deploy`
(edge functions -- currently just `import-newrecruit-list`), then deploy
`dist/` to Cloudflare Pages. It expects these repository secrets:

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

`android-apk.yml` (issue #125) is separate from that deploy pipeline and
never pushes anywhere -- it builds a debug `.apk` from the Capacitor
Android project (same `VITE_SUPABASE_*` secrets as above, so the build
talks to the real backend) and uploads it as a downloadable Actions
artifact, so a sideloadable test build exists without touching `main`.
Runs automatically on every PR (posting/updating a comment with the
download link) and on demand for any branch via `workflow_dispatch`.

Because that APK is a frozen snapshot rather than a live view of
`www.40ktracker.com`, and because a real store release will lag behind
`main` by however long a Play/App Store rollout takes, `ci.yml` runs
`scripts/check-migration-compat.sh` on every PR to catch migrations that
would break an already-released native build -- see CLAUDE.md's "Backend
changes must stay compatible with released native app builds" for the
actual rule this enforces a tripwire for.

**Publishing a real (signed) Android release**, as opposed to the debug
APK above, needs an upload keystore -- generated once, locally
(`keytool -genkeypair ...`, see `android/keystore.properties.example`
for the exact command), and never committed to this repo
(`android/.gitignore` excludes it). From there, two ways to produce the
signed `.aab`:

- **Locally**: copy `android/keystore.properties.example` to
  `android/keystore.properties`, fill in the real path/passwords, then
  `npm run android:bundle` produces it at
  `android/app/build/outputs/bundle/release/`.
- **`android-release.yml`**, manual-`workflow_dispatch`-only (never runs
  on a merge to `main`, unlike `deploy.yml`) -- takes `versionCode` and
  `versionName` as run inputs (Play rejects a re-upload with the same
  `versionCode`, so `android/app/build.gradle`'s `defaultConfig` reads
  both from Gradle `-P` properties when the workflow passes them,
  falling back to `1`/`"1.0"` for local/debug builds that don't), and
  needs the keystore's contents living in this repo's Actions secrets
  instead of only on a developer's machine -- a real trust trade-off
  the workflow's own comments spell out, not a free upgrade. Needs four
  secrets: `ANDROID_KEYSTORE_BASE64` (the keystore file, base64-encoded
  -- e.g. `base64 -i upload-keystore.jks` or, on Windows,
  `certutil -encode` with the header/footer lines stripped),
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Either way, without `keystore.properties` present at build time,
`assembleDebug`/`android-apk.yml` build exactly as before; only
`bundleRelease`/`assembleRelease` need it, and fail with a clear message
if it's missing rather than Gradle's own confusing one. See issue #125
for the rest of the Play Store submission checklist (developer account,
store listing, privacy policy, content rating, Data Safety form).

**Before the first deploy**, you need to create the actual Supabase
project and the production Google OAuth client by hand -- see
"First thing to do" in `40k-tracker-plan.md`. Everything else in this repo
is ready to run once those exist and the secrets above are set.

`public/_headers` sets a couple of baseline hardening headers Cloudflare
Pages applies to every response -- `Strict-Transport-Security` (the site
is already HTTPS-only via Cloudflare's own redirect; this just makes that
explicit to returning browsers) and `X-Frame-Options: DENY` (nothing here
is meant to be embedded in someone else's iframe). No
Content-Security-Policy yet -- getting one right without breaking the
Google OAuth redirect, Supabase API/Storage calls, or avatar/layout
images needs its own careful pass.

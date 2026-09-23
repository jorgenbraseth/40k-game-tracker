# What this is (the goal)

> **Product vision.** This page describes what 40K Tracker is *for* and
> how it's meant to work. For what's actually built today (and how), see
> [status.md](./status.md). Back to the [README](../README.md).

40K Tracker is a public web app for tracking a game of Warhammer 40,000
in real time, from the table.

There is no separate "solo mode" -- every game works the same way:

- **One account can bookkeep the whole scoreboard**, both sides, so a real
  two-player game never requires the other player to sign up at all; or
- **the scoreboard can be shared live** between two players' own phones,
  if they'd both rather enter their own numbers.

## Contents

- [Guiding principles](#guiding-principles)
- [Accounts and profile](#accounts-and-profile)
- [Home](#home)
- [Starting, joining, or logging a game](#starting-joining-or-logging-a-game)
- [The waiting room (game setup)](#the-waiting-room-game-setup)
- [Terrain layout](#terrain-layout)
- [Importing an army list](#importing-an-army-list)
- [Playing: scoring round by round](#playing-scoring-round-by-round)
- [Spectating](#spectating)
- [Finishing, ending early, or cancelling a game](#finishing-ending-early-or-cancelling-a-game)
- [Verifying and locking a result](#verifying-and-locking-a-result)
- [History and stats](#history-and-stats)
- [Ladders](#ladders)
- [Phone-first, installable, and native apps](#phone-first-installable-and-native-apps)
- [Out of scope](#out-of-scope)

---

## Guiding principles

**This is a bookkeeping tool, not a guided workflow.** Its job is to end
up with the correct score, keep a clean round-by-round record of primary
+ secondary VP, and track which objectives were drawn and scored each
round -- not to police how you got there.

- **Everything stays editable.** Every value a player enters -- score,
  secondary picked, faction, army name, Force Disposition, role, even the
  declared winner -- stays editable for the life of the game, including
  after it's marked complete or abandoned. Fat-fingered a tap, picked the
  wrong secondary, realized your army name was wrong three rounds in? Fix
  it in place, no reset required. (The one exception is a game both
  players have verified -- see [Verifying and locking a
  result](#verifying-and-locking-a-result).)
- **Not a rules engine.** Nothing is auto-granted or auto-played for you
  (e.g. the "+1 CP per round" isn't automatic).
- **It understands the ruleset.** The app knows the actual current
  missions, deployments, and secondary objectives for whichever Chapter
  Approved mission pack is active -- this isn't a generic point counter.
  When a new mission pack ships, the content updates without breaking the
  history of games played under the old one. See
  [ruleset-content.md](./ruleset-content.md).
- **What a page shows lives in the URL.** Whichever round is on screen,
  which filters are applied, etc. is bookmarkable/shareable and works
  with browser back/forward. A modal's open-or-closed-ness is the one
  deliberate exception. (See `CLAUDE.md`'s "In-page view state belongs in
  the URL".)

## Accounts and profile

- **Anyone can sign up** -- with Google or with email/password, no invite
  needed.
- **Display name.** Signing up registers a display name (editable any
  time from Profile). That's what other players see in the waiting room,
  live scoreboard, and history/stats. A player's **email address is never
  shown to, or sent to, anyone else.**
- **Profile photo** (issue #73). Optional, added from Profile, shown as a
  small avatar wherever their name shows up (ladder standings and game
  lists, History, their own stats page). Falls back to a plain initial
  when not set -- same as a Google account's own picture already does for
  anyone who signed up that way.
- **Theme.** A purely cosmetic, per-account choice that applies
  everywhere the signed-in player looks, on every device they sign into,
  with no effect on anyone else's game or on how anything scores.
  Thirteen options:
  - the original **grimdark** look (the app's original crest included), or
  - twelve **faction** themes -- Votann, Tyranid, T'au, Orks, Chaos,
    Sororitas, Grey Knights, Mechanicus, Thousand Sons, Dark Angels, World
    Eaters, Space Wolves -- each grounded in that faction's real palette
    and iconography rather than a generic recolor.

  Picking a theme picks its **crest** too -- the header logo and the
  prominent one on the sign-in screen both follow it -- so there's one
  choice to make, not two that can drift apart.
- **Appearance** (separate from *which* theme) picks *how bright* it
  renders: **Light**, **Dark**, or **System** (follows the device's
  OS-level preference, and keeps following it live if that changes while
  the app's open). Every theme ships both a light and a dark palette, so
  all thirteen work either way -- faction and Light/Dark are two fully
  independent choices.

## Home

Signing in lands on a proper Home page, not straight into "start a game":
the same prominent crest as the sign-in screen up top, and a shortcut to
every section underneath (New game, History, Ladders, Stats, Profile) --
a front door, not a single-purpose lobby.

Starting, joining, or logging a game, plus whatever's already in
progress, lives one tap away behind its own **"New game"** nav item.

## Starting, joining, or logging a game

**Starting a live game.** One player starts a game (points limit,
optionally ladders to tag it to) and gets a short **6-character code**,
shareable either:

- as that code (typed into a "Join a game" form), or
- as a link that joins automatically the moment it's opened, no typing
  needed.

Nothing about either player's army -- or the terrain layout -- goes here.
That's all decided in the waiting room next, once both seats actually
exist and, for the layout, once a Force Disposition pairing is known.

**One account can be the bookkeeper for a whole game.** The point isn't a
"solo mode" -- it's that getting a real opponent to create an account and
log in is friction nobody wants mid-game, so it's never required.

- Everyone's setup -- the creator's own included, not just Player 2's --
  happens in the waiting room, where the creator can also fill in Player
  2's themselves and run the whole game as bookkeeper, entering both
  sides' scores round by round.
- Sharing the join code is optional. If a second player does enter it,
  they're simply added as another person who can also adjust either
  side's numbers, the same as if they'd been there from the start -- not
  a required step to use the app.

**Logging a game after the fact.** A game already played somewhere else
-- at a store, a tournament, before this app existed for a group -- can
be logged instead:

- one form for both sides' faction, Force Disposition and army name,
  plus just the final score -- no round-by-round play;
- recorded as a finished game immediately, and counts toward
  standings/stats/Elo exactly like a live one;
- there's no round-by-round history to show for it, just the final
  numbers.

## The waiting room (game setup)

The waiting room has two parts.

**1. Each seat's own setup**, side by side:

- Faction
- Force Disposition (the army's strategic role)
- Secondary Missions mode: **Fixed** or **Tactical**
- Army name

**2. One shared "game configuration" section** below both, covering
everything that's a property of the game rather than of one seat:

- terrain layout (see [Terrain layout](#terrain-layout))
- who's Attacker
- who went first

None of those shared ones are really two people's separate opinions --
they're one fact decided once (by a roll-off at the table, or picked off
the mission's recommended layouts) and just entered once, asked by name
("[Player 1] or [Player 2]?") rather than shown twice as a toggle on each
player's own form.

**Primary Mission.** Each side's own Force Disposition determines their
Primary Mission -- the *pairing* of both Force Dispositions, per the
actual 2026-27 ruleset -- revealed once both are chosen.

**Attacker/Defender** is decided by its own roll-off after the Deployment
card is drawn. The app's only explainer text for it is the one part with
a real rules effect on how the game plays out: *the Defender deploys
first, then the Attacker.*

**Who went first** is a second, separate roll-off -- no explainer there,
just asked by name. Whoever went first (the "top of round" player, as
opposed to "bottom of round") shows first on the live Scoreboard once
both are picked.

**Fixed vs. Tactical.** A handful of secondary cards score differently
depending on which a player is using, so every seat has to declare one
before the game can start -- a two-button toggle, not a dropdown with a
no-op "undecided" option. The round screen then shows only the scoring
conditions that actually apply to them, instead of both sets at once.

**Starting the game** requires every setup field filled in for *both*
seats -- faction, Force Disposition, Fixed/Tactical per seat, plus the
shared terrain layout, Attacker/Defender, and who-went-first picks --
with one deliberate exception: **army name**, which is flavour text with
no gameplay effect, stays optional forever. There is no separate "ready"
step on top of that; once the fields are filled in, either player can
just start the game.

## Terrain layout

Once a mission is resolved (both players' Force Dispositions known), the
**3 recommended terrain layouts (A/B/C)** for that specific Force
Disposition pairing become pickable, each with its own map image, in the
shared game configuration -- a property of the game, not of either seat.

- Picking one is required to start a game, but stays freely editable
  afterwards, like every other setup field.
- **There's no separate "deployment" choice.** Each layout image already
  shows its own deployment battlefield shape with the terrain placed on
  it. Asking which of the 6 named deployment maps to use -- independently,
  and before either player's Force Disposition is even known -- was never
  really a free choice of its own, just an earlier, blanker view of the
  same fact the layout pick already covers.
- **Fullscreen reference.** Each layout thumbnail is a physical-setup
  reference as much as a picker, so it can be tapped open fullscreen (a
  corner expand button) to read while setting up terrain across the
  table. The screen is kept from sleeping for as long as that fullscreen
  view stays open, since board setup takes a while and phones otherwise
  lock mid-way through.

## Importing an army list

Two optional shortcuts for filling in a seat's setup:

**NewRecruit share link → Faction.** Paste a NewRecruit (newrecruit.eu)
list share link instead of picking from the dropdown.

- Fetched server-side (an edge function, since NewRecruit's page has no
  CORS headers a browser could fetch directly) and matched against this
  app's own faction list.
- Only ever resolves **Faction, never Force Disposition**: NewRecruit has
  no equivalent field, since Force Disposition is a per-game
  strategic-role pick this app's own ruleset invents, not an army-list
  attribute any list builder would export. Force Disposition still always
  needs picking by hand, import or not.
- Falls back to the manual dropdown, with a clear reason shown, on any
  bad link, unreachable NewRecruit, or unrecognized faction name.
- The link itself (`game_players.army_list_url`) is kept once NewRecruit
  answers with *a* faction name, even one that didn't match this app's
  own list -- it's still a real army list worth linking to. It shows as
  **"View army list"** on that seat's card on the game summary
  afterwards, for either player or a spectator to open.
- There's also a plain **"Army list link"** field, independent of
  NewRecruit import, so a player using a different list builder
  (WarOrgan, anything else) can paste their own list link with no parsing
  involved -- it's the same `army_list_url` field either way.

**Plain-text army list export → Faction *and* Force Disposition.** Paste
a plain-text export instead -- purely client-side, no backend fetch.

- Scans the pasted text for a line that's *exactly* one of this app's own
  Faction or Force Disposition names -- not a fixed-position or per-tool
  structural parse. That's true of every export format seen so far
  (NewRecruit, WTC, BattleScribe, the GW app), so it needs no per-tool
  branching.
- Force Disposition really is present in a NewRecruit plain-text export
  (confirmed against a real one), unlike NewRecruit's *link* import
  above.
- Whichever of the two it can't find just stays for the manual pickers --
  same partial-success fallback as everywhere else in this flow.
- The pasted text itself is never stored, only used to extract these two
  ids.

## Playing: scoring round by round

**Rounds.** Primary VP and secondary objectives are scored round by round
-- 5 battle rounds, then an **End of Game** step. Whichever round is on
screen is part of the URL, so jumping back to check an earlier round is
bookmarkable/shareable, and browser back/forward moves between rounds.

**Live sync.** With two players each on their own phone, scores update
live for both as they're entered -- no refreshing, no "did you get that?"
across the table. Either player can enter either side's score, since
players agree scores verbally at the table anyway. Bookkeeping both sides
yourself works the same way, just from one phone.

### Primary VP: pick what you achieved

Scoring is pick-what-you-achieved, not type-a-number:

- The round overview shows a player's primary VP as the actual scoring
  conditions printed on the resolved mission's card, right there -- not
  hidden behind a tap-to-open square.
- Tap to mark a flat condition achieved, or use a counter for a "for
  each..." one. The round's total is computed from what's ticked.
- Only conditions whose printed timing window (e.g. "2nd Battle Round
  onwards") is actually live for the round being viewed are shown, so a
  player is never offered scoring that doesn't apply yet.
- The total stays **directly editable** too (same "always editable" rule
  as everything else), for whatever the checklist doesn't cover.

### Caps

No matter how a mission's own conditions add up, the app holds primary
and secondary each to the real core-rule caps: **15VP per round, 45VP per
game**. The round overview always shows a total capped at what's actually
still achievable, not a raw, uncapped sum.

### End of Game step

- A handful of missions award a few more VP once, checked only at the
  very end of the game rather than in any particular round. That's the
  End of Game step after round 5, where those conditions (and only those)
  become scorable.
- It's also where each player's army can be marked **painted**, for a
  flat **+10VP** bonus each -- its own thing, not counted as primary or
  secondary.

### Secondaries

Secondaries follow the real Tactical deck flow:

- Each round a player **draws 2 new secondary cards** (manually, or at
  random).
- In any round they may score **any not-yet-scored secondary drawn *so
  far this game*** -- not just the two from this particular round.
- The app always shows the whole cumulative picture -- what's scored, and
  what's drawn but still sitting there unscored -- not just the current
  round's two.
- Only the scoring lines for the seat's declared Fixed/Tactical mode are
  shown (see [the waiting room](#the-waiting-room-game-setup)).

### Command Points

Tracked round by round: how many a player **gained** and how many they
**spent** that round, entered the same pick-what-happened way as
everything else.

- The well-known "+1 CP per round" isn't auto-granted -- this is a
  bookkeeping tool, not a rules engine that plays the game for you.
- Each player's **remaining CP** (everything gained so far, minus
  everything spent) is shown alongside, live, so nobody has to do the
  running maths mid-game.
- The post-game summary keeps the final remaining total as part of the
  permanent record.

## Spectating

Any signed-in user can open a game and watch -- the waiting room's setup,
or the live scoreboard round by round, exactly as its two players see it,
updating live the same way.

- No separate spectator account type or invite: watching is just opening
  the link, same as playing is.
- The only difference is that nothing on screen is tappable. A spectator
  sees the same state as the players, but only the game's own two seats
  can ever change anything about it.

## Finishing, ending early, or cancelling a game

**Finishing.** Either player can close out the game (a winner is
suggested from the totals, or record a draw). Both players get a
permanent record of it:

- a round-by-round breakdown;
- which terrain layout was played;
- it folds into their history.

The round-by-round table's combined per-round number can be expanded
("Show secondaries") into which specific secondary objective(s) each
player scored that round and for how much -- collapsed by default, same
as every other optional detail panel in this app.

**Ending early.** A game can be ended early -- conceded, or the opponent
had to leave -- from any round, not just the last one.

**Cancelling.** Any participant can cancel a game outright, at any stage.
Distinct from ending it early, this **removes it completely** (for both
players, from every list) rather than keeping a record -- for a game that
shouldn't exist at all (created by mistake, a test, wrong code entered).
Gated behind an explicit confirmation so a stray tap can't wipe a real
game.

## Verifying and locking a result

**Verifying.** When a game finishes, each seat can confirm the result is
correct with a one-tap **"Verify this result"**, offered wherever that
game shows up for them (its own summary, their history list). "Each
seat" means its own real occupant, or -- for a solo-entered seat nobody's
joined yet -- the ladder member it was attributed to.

A single seat's confirmation is **informational, not a gate**: standings
and stats already count the game either way. If a score's wrong before
both sides have confirmed, it's fixed the same way every other value in
this app is, by editing it directly.

**Locking.** Once **both** seats have confirmed, the game locks: neither
player can unilaterally edit or delete it any more. This is a real trust
boundary, enforced server-side, not just hidden buttons.

**Unlocking** needs the other player's sign-off:

1. One player requests permission to edit.
2. The other approves or rejects it.
3. Approving just clears both confirmations, dropping the game back to
   its normal, editable state -- which it leaves again the next time both
   sides re-confirm.

If the other player won't respond, a creator of any ladder the game's
tagged to can step in and approve the request themselves, as a
dispute-resolution override.

## History and stats

**Stats.** Over time, each player builds up game history and win/loss
stats, broken down by **faction played, Force Disposition, and
opponent** -- so "how do I do against Necrons?" or "what's my record
playing Purge the Foe?" has a real answer instead of a memory.

(The mission breakdown this had briefly -- each player has their own, so
it read more like noise than a useful split -- is on hold for now; Force
Disposition fills that slot instead.)

**Every player's stats are public to signed-in users.** Wherever a
player's name shows up -- a ladder's standings or game log, your own game
history, the live Scoreboard, a game's summary -- it's a link to that
player's own record: their overall win rate and breakdown across every
game they've finished. Not limited to a shared ladder or a game the
viewer happened to be part of. A game still in the lobby or being played
is different -- that stays visible only to its own participants until it
actually finishes.

**History** shows every finished game from everyone, not just the
viewer's own, filterable (any combination at once) by:

- "my games only"
- a single ladder
- a Faction
- a Force Disposition

So "show me every game anyone's played as Necrons" is a real view, not
just a per-player stat.

## Ladders

A ladder is just a **named group of players** (`ladders` /
`ladder_members`), created from the dedicated Ladders page.

### Membership and invite codes

- **Browsing is open.** Every ladder stays browsable by anyone signed in
  (name, member count, standings, game log).
- **Joining needs the invite code** -- your own ladder or someone else's
  -- so membership isn't open to whoever happens to find it in the browse
  list.
- Any current member can see and share the code, either as the code
  itself or as a link that joins automatically once it's opened.
- Only the creator can **regenerate** it, invalidating the old code and
  link alike.
- The creator **can't leave** their own ladder the way any other member
  can -- archiving or deleting it (below) is the only way to step away
  from one they made, since leaving would otherwise strand it with no one
  left who can reach its settings.

### Tagging games

- Tagging a game onto a ladder is entirely optional, chosen at creation
  time on the "Start a game" screen from a checklist.
- A game can be tagged to **any combination of ladders** at once (issue
  #75), not just one, so two players who share more than one ladder don't
  have to pick which one a given game counts toward.
- Stays editable afterwards like everything else.
- **Bookkeeping both sides of a ladder game yourself?** The unclaimed
  seat's setup form gets a "Player" picker (who on the ladder this seat is
  for), so that person's result still counts toward standings even though
  they never signed in themselves.

### Archiving and deleting

- **Archive** (creator only) once a ladder has run its course -- a season
  that's over, a group that's disbanded. It drops out of the browse list
  and the "tag this game" picker without touching anything it already
  recorded: standings, its game log, and every affected game's own ladder
  name in History/stats keep working exactly as before. Fully reversible,
  no confirmation needed, same as every other non-destructive toggle in
  this app.
- **Delete** (creator only) for a ladder created by mistake, a duplicate,
  a one-off test. Permanent: games tagged to it aren't deleted, they just
  become untagged, same as if they'd never been tagged at all. Can't be
  undone, so it's gated behind an explicit confirmation.

### Ranking: Elo or Glicko-2

Each ladder picks its own ranking type, **Elo** or **Glicko-2** (issue
#68; see issue #26 for the research behind these two specifically, and
why TrueSkill/Massey-Colley weren't a fit).

- Everyone starts at **1500**.
- Beating a much higher-rated opponent gains a lot, while beating a much
  lower-rated one barely moves the needle (and the mirror image for
  losses). That asymmetry falls out of the formula, it isn't a
  hand-written rule.
- Glicko-2 additionally factors in how established each player's rating
  currently is, which suits irregular, bursty tabletop play better than
  Elo's flat per-game movement.
- **Computed live, never stored.** Ratings are computed by replaying a
  ladder's whole game history in chronological order every time standings
  are viewed. So editing a score, cancelling a game, or switching which
  ranking type a ladder uses is reflected correctly the moment standings
  are viewed again -- no separate recalculation step, despite both being
  inherently sequential. (See issue #18 for the fuller design writeup,
  including why a stored, sequential rating was deliberately not used.)

### Ladder page

- Standings (see above).
- Every game that went into its standings -- everyone's, not just yours
  -- collapsed until asked for, so a look at the numbers doesn't come
  with a wall of game rows by default.
- History can also be filtered down to a single ladder's games.

## Phone-first, installable, and native apps

**Built for one hand, mid-game, with dice in the other** -- not at a desk
afterward:

- large tap targets, no tiny number inputs;
- the screen stays on during an active game;
- copes with flaky venue wifi dropping and reconnecting.

**Installable from the browser** (issue #97). "Add to Home Screen" on
Android or iOS gets a real home-screen icon and a full-screen launch with
no browser chrome eating screen space. The app shell (not your game data
-- see [status.md](./status.md#installable-pwa)) loads instantly even
over that same flaky venue wifi, since it's cached on the device rather
than re-fetched every visit.

**Real app-store listings.** Beyond the browser-install path, the same
web app is also meant to ship as a real Google Play / App Store listing
-- not a rewrite, a Capacitor wrapper around this same build (issue #97's
research; issues #125/#126 for the per-platform plans). Android first,
iOS once Android's proven out.

## Out of scope

What this deliberately is **not**:

- tournaments/events
- an army list builder
- in-app chat
- push notifications
- rematch chains
- CP/painting scoring
- offline-first play -- i.e. a persisted local write queue that lets you
  keep entering scores with no connection at all. (Distinct from the
  installable app shell above, which still needs a connection to actually
  save anything.)

**History of this list.** See section 11 of
[`40k-tracker-plan.md`](../40k-tracker-plan.md) for the original v1
scoping. It's been superseded on four points since -- ladders/ranking,
spectating, installability, and an app-store-distributed native wrapper
all turned out to be wanted after all, so those lines from the original
out-of-scope list no longer hold.

**Tournaments** -- a bounded, one-off pool of games with its own W/D/L
standings, separate from a ladder's open-ended history -- were actually
built and shipped for a while (issues #74/#75), but have since been pulled
back out. That ground is back to out of scope for now, not a line item
ruled out from the start. They were removed cleanly enough that bringing
them back later is a real option, not a rewrite.

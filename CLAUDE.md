# Project memory

## Keep README.md's description current

`README.md`'s "What this is (the goal)" and "What's actually in place
right now" sections must stay accurate after every change that affects
them. When you make a change:

- If it changes or extends the intended **goal/vision** of the app (a
  new feature the app should do, a change to how the core flow is
  meant to work), update the "What this is (the goal)" section.
- If it changes what's **actually implemented** (a feature shipped, a
  caveat resolved, a new gap introduced), update "What's actually in
  place right now" to match.
- Don't let the two drift out of sync with reality: the goal section
  describes what the app is *for*, the status section describes what's
  *true today*. A reader should be able to tell the difference between
  "this is how it's supposed to work" and "this part isn't done yet"
  without digging through code or commit history.

This applies whether the change comes from this repo's own session or a
fresh one -- treat README.md as living documentation of the product, not
a one-time snapshot from when the app was first built.

## In-page view state belongs in the URL

Any state that determines *what a page is showing* -- which round of a
game is on screen, which ladder a list is filtered to, which item in a
list is selected, a page number, a search/sort choice -- must live in
the URL (`useSearchParams`, or a route param for a whole separate
resource like `/players/:userId`), not in a plain `useState`. The bar:
if a user would reasonably want to bookmark, share, or hit browser
back/forward to return to a particular view, it needs to be
URL-addressable. `Scoreboard`'s `viewRound` (`?round=N`) and
`HistoryPage`'s `ladderFilter` (`?ladder=<id>`) are the reference
examples.

Excluded -- these stay local `useState`, not URL params:
- A modal/sheet's open-or-closed-ness (`Sheet`, `ConfirmSheet`) and
  which record it's currently open for (e.g. `editingPlayerId`,
  `scoringObjectiveId`) -- transient UI, not a distinct page view.
- An accordion/disclosure toggle showing or hiding a block of content
  already on the page (e.g. a ladder row's expanded standings) -- same
  reasoning as a modal, and multiple independent toggles on one page
  don't have a clean single-value URL encoding.
- Draft/in-progress form input not yet submitted (text fields, a
  password, an unconfirmed pick) -- putting a draft in the URL is
  wrong even when the *submitted* result of that form would belong
  there once it exists.
- Purely transient feedback (a "Copied!" flash, a saving/saved
  indicator, an inline error message).

When a URL param change represents genuinely moving between distinct
views the user might step back through (Scoreboard's round), push a new
history entry (`setSearchParams`'s default). When it's closer to
refining the current view in place (a filter dropdown), pass `{ replace:
true }` so back/forward isn't cluttered with one entry per keystroke or
selection.

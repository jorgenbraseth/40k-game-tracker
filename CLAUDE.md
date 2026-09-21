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

## Backend changes must stay compatible with released native app builds

Once the Android/iOS apps exist (issues #125/#126), a schema or RPC
change can't assume it ships alongside the frontend that uses it the way
a web deploy does. `deploy.yml` pushes migrations and the web frontend
together on every merge to `main`, but the native apps bundle a frozen
copy of the web build at release time (Capacitor's `webDir`, not a live
fetch from www.40ktracker.com) -- see #125. A user's installed app can
be weeks behind whatever's on `main`, with no way to get a fix until the
next store release reaches them. This is a stricter, longer-lived
version of the "old frontend briefly live against the new schema"
window `deploy.yml`'s comments and `40k-tracker-plan.md` already design
migrations around (expand-then-contract) -- treat that gap as spanning
the whole period until a native release has shipped past the change,
not just the few seconds of a web deploy.

**The rule:** a migration must not remove or narrow anything an
already-released native app build might still depend on -- no dropping
or renaming a column/table/function, no narrowing a column's type, no
adding a `NOT NULL` to an existing column, that an app already out in
the world could still be reading, writing, or calling. Add the new
shape alongside the old one (expand); only drop/rename/narrow the old
shape (contract) once you know a native release has shipped past it --
in practice, once #125/#126 exist, expect the "later migration, once a
release has shipped" side of expand-then-contract to be a real wait for
a store rollout, not the next commit.

`scripts/check-migration-compat.sh` (run by `ci.yml` on every PR) is a
tripwire for this, not a substitute for thinking about it: it greps new
migrations for these shapes and fails unless the migration has a
`-- breaking-change-ok: <reason>` comment explaining why it's actually
safe (e.g. nothing has ever shipped past this column). It can't tell
whether a native release has actually shipped past what it's flagging,
so writing that comment is a real judgment call, not a formality to
silence CI -- if you're not sure, don't add it, expand instead.

This applies to Supabase RPC functions (`supabase.rpc(...)` calls) just
as much as tables/columns -- a function's name and parameter shape are
part of the same client-facing contract. It does *not* apply to RLS
policies (drop-then-recreate is the normal way to update one) or to
anything purely additive (a new table/column/function is invisible to,
not broken by, a client that predates it).

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

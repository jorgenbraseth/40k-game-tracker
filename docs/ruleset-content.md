# Ruleset / mission content

> How missions, deployments, secondaries, factions and Force
> Dispositions are stored, where the real deck content comes from, and
> the copyright exceptions that apply to it. Back to the
> [README](../README.md).

**Read the [copyright note](#copyright-exceptions-read-before-touching-mission-content)
before touching mission content.**

## Contents

- [Versioned reference data](#versioned-reference-data)
- [Asymmetric Primary Missions (2026-27)](#asymmetric-primary-missions-2026-27)
- [Client-side mission resolution](#client-side-mission-resolution)
- [Where the real deck content lives (migration, not seed)](#where-the-real-deck-content-lives-migration-not-seed)
- [Copyright exceptions: read before touching mission content](#copyright-exceptions-read-before-touching-mission-content)
- [When the next Chapter Approved deck ships](#when-the-next-chapter-approved-deck-ships)

---

## Versioned reference data

Missions, deployments, secondary objectives, factions and Force
Dispositions are **versioned reference data** (`mission_packs` and its
children), never hardcoded -- see the comment at the top of
`supabase/migrations/20260101000000_reference_tables.sql`.

Existing games keep pointing at the pack they were played under, so a
new deck never rewrites old history.

## Asymmetric Primary Missions (2026-27)

The 2026-27 deck's Primary Mission is **asymmetric per player**, not a
single mission shared by both.

1. Each player picks a **Force Disposition** (`force_dispositions` -- the
   five real, GW-confirmed role names: Take and Hold, Purge the Foe,
   Reconnaissance, Disruption, Priority Assets).
2. Each player then finds their **own** Primary Mission on their **own**
   Force Disposition card, indexed by their *opponent's* choice.

So two players with different Force Dispositions play two different
Primary Missions (same 15VP cap, different cards) in the same game.

**Schema:**

- `game_players.mission_id`, not `games.mission_id` -- resolved per-seat
  by the `resolve_game_mission` RPC once both players have picked, in the
  waiting room.
- `missions.force_disposition_id` is the mission owner's own Force
  Disposition; `missions.opponent_force_disposition_id` is the
  opponent's. It's an **ordered pair**: e.g. Take and Hold-facing-Purge
  the Foe and Purge the Foe-facing-Take and Hold are different mission
  cards.
- Secondary objectives are also split into separate Attacker/Defender
  decks (`secondary_objectives.role`), though the 18 cards in each are
  identical.

See `supabase/migrations/20260201000000_asymmetric_primary_missions.sql`.

## Client-side mission resolution

Picking a Force Disposition resolves its mission (and, once both are
resolved, unlocks the terrain layout picker) **without waiting on the
`resolve_game_mission` round trip**:

- `useUpdatePlayerSetup` predicts the same result client-side
  (`src/lib/missionResolution.ts`'s `resolveMissionId`, an exact mirror
  of the RPC's own lookup) the moment a Force Disposition patch lands.
- It seeds both the resolved mission id *and* `useMission`'s own cache
  entry for it (from the whole pack, already fetched via
  `useMissionsForPack` -- reference-scale, ~25 rows, fetched once), so
  the mission's name and layout images show up the same render as the id
  does, not a further fetch later.
- Same "patch now, reconcile on settle" pattern as every other mutation
  in this app. The RPC still runs and is still what actually gets
  written; this is purely a client-side head start.

`LayoutVariantPicker` also renders a same-sized skeleton
(`LayoutVariantSkeleton`, three pulsing placeholder cells) instead of
nothing while a mission genuinely isn't resolved yet (still waiting on
the *other* player's Force Disposition, which the above can't shortcut),
so its card doesn't visibly grow the instant it does resolve.

## Where the real deck content lives (migration, not seed)

The real Chapter Approved 2026-27 deck content -- names, Force
Disposition pairings and VP values, sourced from the public card text
and mission generator at
[wahapedia.ru](https://wahapedia.ru/wh40k11ed/the-rules/mission-deck-2026-27/)
-- lives in
`supabase/migrations/20260221000000_apply_real_reference_data.sql`,
**not** `seed.sql`.

**Why a migration:** missions and secondary objectives were originally
only in `seed.sql`, which `deploy.yml` deliberately never runs against
production (by design, for review before touching real reference data).
Nobody ran it by hand after the Force Disposition redesign landed -- so
production silently kept the very first scaffold's placeholder missions,
with `force_disposition_id`/`role` left null, and **every game's Primary
Mission resolution failed forever, for months, with no error.** A
migration can't be forgotten the same way; it runs automatically, every
deploy.

`seed.sql` still seeds deployments, factions, and the
rulesets/mission_packs rows themselves (all safe to apply idempotently,
unlike content that needs a clean replace) for local dev.

## Copyright exceptions: read before touching mission content

**The default rule.** Everywhere else in this repo, "reference data"
deliberately means **names, categories and VP values only** -- never GW's
rules text (how a mission or secondary actually scores, turn by turn).

There are two deliberate, informed exceptions, each made by the project
owner after being told explicitly what it meant. **Don't treat either as
license to relax the no-rules-text policy anywhere else in the app
without the same explicit conversation** -- it's still the default
everywhere but here.

### Exception 1: scoring condition text

`mission_objective_lines` and `secondary_objective_lines`
(`supabase/migrations/20260301000000_objective_lines.sql`): `condition_text`
in those tables *is* GW's copyrighted scoring text (via wahapedia.ru's
public transcription), stored so a player can tick which conditions they
achieved instead of typing a raw VP number.

### Exception 2: deployment and layout images

- `public/images/deployments/` (6 files) and `public/images/layouts/` (45
  files -- 15 Force Disposition pairings × 3 layout variants) are
  downloaded, committed copies of GW's own deployment-map and
  terrain-layout diagrams from wahapedia.ru, not names/values-only
  reference data.
- `deployments.image_path` and
  `missions.layout_a_image_path`/`layout_b_image_path`/`layout_c_image_path`
  (`supabase/migrations/20260305000000_deployment_and_layout_images.sql`)
  point at these local paths -- served from the app's own domain, not
  hotlinked.
- **Layout images are keyed by the Force Disposition pairing, not the
  deployment** (wahapedia's own page script resolves them that way -- see
  the migration's comment). A deployment is the battlefield shape; a
  layout is the terrain piece placement on top of one; and each layout
  image already shows both together. That's exactly why this app dropped
  asking for a deployment as a separate, independent pick (see
  [status.md](./status.md#terrain-layout-attackerdefender-turn-order),
  `20260323000000_deployment_optional.sql`).
- Picking a layout (`games.layout_variant`) is required before a game can
  start, same as every other setup field except army name -- but, like
  those, stays freely editable for the life of the game once set.

## When the next Chapter Approved deck ships

1. Add a new `mission_packs` row and its children in a **new migration**
   -- missions, secondary_objectives, and (if you want the checklist to
   keep working) their objective lines too.
2. **Don't touch the old pack's migration.** Existing games keep pointing
   at it.

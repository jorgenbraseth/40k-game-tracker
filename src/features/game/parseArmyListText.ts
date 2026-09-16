/** Case/apostrophe-insensitive line-equality normalize -- same rule `matchFaction` uses, kept as
 * its own copy here since it's a one-line rule, not worth a shared module for. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/['’]/g, "'").trim()
}

export interface ArmyListParseResult {
  factionId: string | null
  forceDispositionId: string | null
}

/**
 * Scans a pasted army-list text dump for a line that's *exactly* one of this app's known Faction
 * or Force Disposition names (trimmed, case/apostrophe-insensitive) -- not a fixed-position or
 * regex-on-structure parse of any one tool's export format. Deliberately format-agnostic: a plain
 * "Faction name on its own line somewhere near the top" is true of every export format seen so far
 * (NewRecruit, WTC, BattleScribe, the GW app), so this needs no per-tool branching and degrades
 * gracefully (returns nulls, never throws) on a format that doesn't do that at all -- the caller
 * falls back to the manual pickers exactly as if nothing were pasted.
 *
 * Force Disposition is genuinely present in a NewRecruit text export (confirmed against a real
 * example during this issue's implementation -- it appears as its own bare line, e.g. "Take and
 * Hold", distinct from the list's own free-text title line even when that title happens to *start*
 * with the same words), unlike the NewRecruit *link* import (#86), which only ever resolves
 * Faction -- the web share page's server-rendered meta tags don't carry it, but the plain-text
 * export apparently does.
 */
export function parseArmyListText(
  text: string,
  factions: Array<{ id: string; name: string }>,
  forceDispositions: Array<{ id: string; name: string }>,
): ArmyListParseResult {
  const lines = new Set(
    text
      .split('\n')
      .map((line) => normalize(line))
      .filter(Boolean),
  )

  const faction = factions.find((f) => lines.has(normalize(f.name)))
  const forceDisposition = forceDispositions.find((fd) => lines.has(normalize(fd.name)))

  return {
    factionId: faction?.id ?? null,
    forceDispositionId: forceDisposition?.id ?? null,
  }
}

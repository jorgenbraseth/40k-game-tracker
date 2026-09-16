/** Case/apostrophe-insensitive match against this app's own `factions` reference data -- forgiving
 * of curly vs straight apostrophes (T'au Empire) without needing a fuzzier match than that, since
 * NewRecruit's faction names are the same official GW names this app's own list was seeded from. */
export function matchFaction(factions: Array<{ id: string; name: string }>, name: string) {
  const normalize = (s: string) => s.toLowerCase().replace(/['’]/g, "'").trim()
  const target = normalize(name)
  return factions.find((f) => normalize(f.name) === target)
}

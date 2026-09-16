// Fetches a NewRecruit (newrecruit.eu) shared army-list page server-side -- the page has no CORS
// headers, so the browser can't fetch it directly -- and extracts the Faction from its
// social-preview meta tags. NewRecruit server-renders those for every public share link
// (`/app/list/<code>`, viewable by anyone with no account, confirmed via their own docs) even
// though the rest of the page is a client-side SPA shell with no other server-rendered data.
//
// There is no NewRecruit field corresponding to this app's own "Force Disposition" (a per-game
// strategic-role pick, not an army-list attribute any list-builder would export -- see the
// 20260115000000_force_disposition_missions migration) -- so this only ever resolves a Faction,
// never a disposition. Callers fall back to manual picking for both when this can't confidently
// resolve a faction, per issue #78/#86.
//
// Always responds 200 with either `{ factionName }` or `{ error }` for any *expected* outcome (bad
// URL, unreachable, unparseable) -- see this function's caller (useImportNewRecruitList) for why:
// keeps the common "well, that didn't work" paths as plain data instead of thrown
// FunctionsHttpErrors the client would have to unwrap. A non-2xx here means the request itself was
// malformed, not that NewRecruit had nothing useful to say.

const NEWRECRUIT_LIST_URL = /^https:\/\/(?:www\.)?newrecruit\.eu\/app\/list\/[A-Za-z0-9_-]+\/?(?:\?.*)?$/

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let url: unknown
  try {
    ;({ url } = await req.json())
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (typeof url !== 'string' || !NEWRECRUIT_LIST_URL.test(url)) {
    return json({ error: "That doesn't look like a NewRecruit list link (expected newrecruit.eu/app/list/...)." })
  }

  let html: string
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 40kTracker/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`NewRecruit returned ${res.status}`)
    html = await res.text()
  } catch {
    return json({ error: "Couldn't reach NewRecruit -- try again, or pick Faction manually." })
  }

  const factionName = extractFactionName(html)
  if (!factionName) {
    return json({ error: "Couldn't find a faction on that list -- pick it manually below." })
  }

  return json({ factionName })
})

/**
 * NewRecruit's `og:description`/`twitter:description` meta content is two lines: "<grand
 * alliance> - <faction>" then "Warhammer 40,000 <edition>" -- e.g. "Imperium - Adepta Sororitas".
 * Takes whatever's after the *last* " - " on the first line, without needing to know NewRecruit's
 * own alliance taxonomy (Imperium/Chaos/Xenos/...) -- the caller fuzzy-matches this candidate
 * string against this app's own `factions` table, so an unrecognized prefix or a faction absent
 * from that table both just fail the match there rather than needing to be anticipated here.
 */
function extractFactionName(html: string): string | null {
  const match = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/)
  if (!match) return null
  const firstLine = decodeHtmlEntities(match[1]).split('\n')[0]?.trim()
  if (!firstLine) return null
  const segments = firstLine.split(' - ')
  const faction = segments[segments.length - 1]?.trim()
  return faction || null
}

function decodeHtmlEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

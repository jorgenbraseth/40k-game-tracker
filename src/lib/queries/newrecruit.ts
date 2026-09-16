import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Imports a NewRecruit (newrecruit.eu) shared list link and resolves it to a Faction name --
 * fetching the page has to happen server-side (the `import-newrecruit-list` edge function; see its
 * own doc comment), since NewRecruit doesn't send CORS headers a browser would allow. Only ever
 * resolves a Faction, never a Force Disposition -- NewRecruit has no equivalent field for that (a
 * per-game strategic-role pick this app invents on its own, not an army-list attribute), so the
 * caller leaves Force Disposition to the existing manual picker regardless of import outcome.
 *
 * The edge function always answers 200 with either `{ factionName }` or `{ error }` for any
 * *expected* outcome (bad link, NewRecruit unreachable, no faction on the page) -- those become
 * this mutation's thrown Error, same shape as every other error path here, so the caller only ever
 * needs to handle one kind of failure. A thrown `error` from `functions.invoke` itself means
 * something broke before the edge function could even answer (network to our own backend, a 5xx).
 */
export function useImportNewRecruitList() {
  return useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.functions.invoke<{ factionName?: string; error?: string }>(
        'import-newrecruit-list',
        { body: { url } },
      )
      if (error) throw new Error("Couldn't reach the import service. Try again, or pick Faction manually.")
      if (!data?.factionName) throw new Error(data?.error ?? "Couldn't read that list. Pick Faction manually.")
      return data.factionName
    },
  })
}

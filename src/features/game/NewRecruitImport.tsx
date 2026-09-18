import { useState } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useImportNewRecruitList } from '@/lib/queries/newrecruit'
import { matchFaction } from './matchFaction'

/**
 * Optional, collapsed-by-default alternative to picking Faction from the dropdown by hand -- paste
 * a NewRecruit share link (`newrecruit.eu/app/list/...`) and this resolves it to a Faction via the
 * `import-newrecruit-list` edge function. Deliberately does *not* touch Force Disposition -- there
 * is no NewRecruit field for it (see that edge function's own doc comment) -- so `onImported` only
 * ever carries a faction id (`null` if the returned faction name didn't match anything in this
 * app's own list); Force Disposition stays exactly as manual as it already was.
 *
 * The link itself is kept (via `armyListUrl`, `game_players.army_list_url`) once NewRecruit
 * actually answered with *a* faction name, even when that name didn't match this app's own list --
 * it's still a real, reachable army list worth surfacing on the game summary afterwards, whether or
 * not the faction auto-fill worked.
 */
export function NewRecruitImport({
  factions,
  onImported,
}: {
  factions: Array<{ id: string; name: string }>
  onImported: (result: { url: string; factionId: string | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [matchedName, setMatchedName] = useState<string | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const importList = useImportNewRecruitList()

  const onImport = async (e: React.FormEvent) => {
    e.preventDefault()
    setMatchedName(null)
    setMatchError(null)
    try {
      const factionName = await importList.mutateAsync(url)
      const match = matchFaction(factions, factionName)
      onImported({ url, factionId: match?.id ?? null })
      if (!match) {
        setMatchError(`Found "${factionName}" but couldn't match it to a faction here -- pick it manually below.`)
        return
      }
      setMatchedName(match.name)
    } catch {
      // error surfaced below via importList.error
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-xs text-paper/40 underline hover:text-paper"
      >
        Or import from a NewRecruit list
      </button>
    )
  }

  return (
    <form onSubmit={onImport} className="flex flex-col gap-2 rounded-lg border border-veil-strong bg-veil p-3">
      <TextField
        label="NewRecruit list link"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.newrecruit.eu/app/list/..."
        error={matchError ?? (importList.isError ? (importList.error as Error).message : undefined)}
      />
      <p className="text-xs text-paper/40">
        Fills in Faction only -- Force Disposition still needs picking below, same as always.
      </p>
      {matchedName && !matchError && <p className="text-xs text-gold">Matched: {matchedName}</p>}
      <Button type="submit" variant="secondary" disabled={importList.isPending || !url} className="self-start">
        {importList.isPending ? 'Importing…' : 'Import'}
      </Button>
    </form>
  )
}

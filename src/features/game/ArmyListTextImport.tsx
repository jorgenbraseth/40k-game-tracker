import { useState } from 'react'
import { Button } from '@/components/Button'
import { parseArmyListText } from './parseArmyListText'

/**
 * Optional, collapsed-by-default alternative to picking Faction and Force Disposition by hand --
 * paste a plain-text army list dump (the usual copy-paste export format) and this scans it for a
 * line matching one of this app's own Faction/Force Disposition names (see parseArmyListText's own
 * doc comment for why a bare line-match, not per-tool structural parsing). Purely client-side, no
 * backend involved -- unlike the link-based imports (#86), there's no CORS to work around here.
 *
 * Neither field is required to be found for the other to apply: a list that only reveals one of
 * the two still auto-fills that one, same "graceful partial success" as everywhere else in this
 * flow. The pasted text itself is never stored -- used only to extract these two ids, then
 * discarded -- unlike a NewRecruit *link* import, which keeps the link itself (there's no
 * comparable "reference to keep" for a plain paste).
 */
export function ArmyListTextImport({
  factions,
  forceDispositions,
  onDetected,
}: {
  factions: Array<{ id: string; name: string }>
  forceDispositions: Array<{ id: string; name: string }>
  onDetected: (result: { factionId?: string; forceDispositionId?: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [detected, setDetected] = useState<{ factionName: string; dispositionName: string | null } | null>(null)
  const [notFound, setNotFound] = useState(false)

  const onImport = (e: React.FormEvent) => {
    e.preventDefault()
    setDetected(null)
    setNotFound(false)
    const { factionId, forceDispositionId } = parseArmyListText(text, factions, forceDispositions)
    if (!factionId && !forceDispositionId) {
      setNotFound(true)
      return
    }
    const patch: { factionId?: string; forceDispositionId?: string } = {}
    if (factionId) patch.factionId = factionId
    if (forceDispositionId) patch.forceDispositionId = forceDispositionId
    onDetected(patch)
    setDetected({
      factionName: factions.find((f) => f.id === factionId)?.name ?? '',
      dispositionName: forceDispositions.find((fd) => fd.id === forceDispositionId)?.name ?? null,
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-xs text-paper/40 underline hover:text-paper"
      >
        Or paste your army list
      </button>
    )
  }

  return (
    <form onSubmit={onImport} className="flex flex-col gap-2 rounded-lg border border-veil-strong bg-veil p-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-paper/80">Army list text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Paste your exported army list here…"
          className="min-h-24 rounded-lg border border-veil-strong bg-veil px-3 py-2.5 text-sm text-paper placeholder:text-paper/40 focus:border-gold focus:outline-none"
        />
      </div>
      <p className="text-xs text-paper/40">
        Looks for a Faction and Force Disposition name on their own line -- whatever it can't find
        just stays for the pickers below.
      </p>
      {notFound && (
        <p className="text-sm text-danger">
          Couldn't find a recognizable Faction or Force Disposition in that text -- pick them
          manually below.
        </p>
      )}
      {detected && (
        <p className="text-xs text-gold">
          Detected: {detected.factionName || 'no faction'}
          {detected.dispositionName ? ` · ${detected.dispositionName}` : ''}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={!text.trim()} className="self-start">
        Detect faction / disposition
      </Button>
    </form>
  )
}

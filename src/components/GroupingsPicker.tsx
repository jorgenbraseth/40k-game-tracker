export interface GroupingOption {
  id: string
  name: string
}

/**
 * A game can be tagged to any combination of ladders and/or tournaments at once (issue #75) --
 * replaces what used to be a single "Ladder game? (optional)" dropdown with a checkbox list
 * covering both grouping kinds. Each option row is its own `min-h-11` label (not just the checkbox
 * itself) so the whole row is tappable, same touch-target convention as everywhere else in this
 * app.
 *
 * Only ever offers what the viewer's actually a member of, plus whichever groupings the game is
 * *currently* tagged to even if the viewer's since left or archived them (so a stale selection
 * never just vanishes from the list) -- same "no orphaned selection" reasoning the old single
 * ladder picker used, just applied to two option lists instead of one.
 */
export function GroupingsPicker({
  ladderIds,
  tournamentIds,
  ladderOptions,
  tournamentOptions,
  onChange,
  disabled,
}: {
  ladderIds: string[]
  tournamentIds: string[]
  ladderOptions: GroupingOption[]
  tournamentOptions: GroupingOption[]
  onChange: (next: { ladderIds: string[]; tournamentIds: string[] }) => void
  disabled?: boolean
}) {
  if (ladderOptions.length === 0 && tournamentOptions.length === 0) return null

  const toggle = (kind: 'ladder' | 'tournament', id: string) => {
    const current = kind === 'ladder' ? ladderIds : tournamentIds
    const next = current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]
    onChange({
      ladderIds: kind === 'ladder' ? next : ladderIds,
      tournamentIds: kind === 'tournament' ? next : tournamentIds,
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-paper/80">Ladders / tournaments (optional)</span>
      <div className="flex flex-col gap-1 rounded-lg border border-veil-strong bg-veil p-1">
        {ladderOptions.map((l) => (
          <label
            key={l.id}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-paper/80 hover:bg-veil"
          >
            <input
              type="checkbox"
              checked={ladderIds.includes(l.id)}
              onChange={() => toggle('ladder', l.id)}
              disabled={disabled}
              className="h-4 w-4 flex-shrink-0 accent-gold"
            />
            <span className="min-w-0 truncate">{l.name}</span>
          </label>
        ))}
        {tournamentOptions.map((t) => (
          <label
            key={t.id}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-paper/80 hover:bg-veil"
          >
            <input
              type="checkbox"
              checked={tournamentIds.includes(t.id)}
              onChange={() => toggle('tournament', t.id)}
              disabled={disabled}
              className="h-4 w-4 flex-shrink-0 accent-gold"
            />
            <span className="min-w-0 truncate">{t.name}</span>
            <span className="ml-auto flex-shrink-0 rounded-full bg-veil-strong px-1.5 py-0.5 text-[10px] text-paper/50">
              tournament
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

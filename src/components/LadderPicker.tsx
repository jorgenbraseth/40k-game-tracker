export interface LadderOption {
  id: string
  name: string
}

/**
 * A game can be tagged to any combination of ladders at once (issue #75) -- a checkbox list, not
 * a dropdown, since a game can belong to more than one at a time. Each option row is its own
 * `min-h-11` label (not just the checkbox itself) so the whole row is tappable, same touch-target
 * convention as everywhere else in this app.
 *
 * Only ever offers what the viewer's actually a member of, plus whichever ladders the game is
 * *currently* tagged to even if the viewer's since left or archived it (so a stale selection never
 * just vanishes from the list).
 */
export function LadderPicker({
  ladderIds,
  ladderOptions,
  onChange,
  disabled,
}: {
  ladderIds: string[]
  ladderOptions: LadderOption[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  if (ladderOptions.length === 0) return null

  const toggle = (id: string) => {
    const next = ladderIds.includes(id) ? ladderIds.filter((existing) => existing !== id) : [...ladderIds, id]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-paper/80">Ladders (optional)</span>
      <div className="flex flex-col gap-1 rounded-lg border border-veil-strong bg-veil p-1">
        {ladderOptions.map((l) => (
          <label
            key={l.id}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-paper/80 hover:bg-veil"
          >
            <input
              type="checkbox"
              checked={ladderIds.includes(l.id)}
              onChange={() => toggle(l.id)}
              disabled={disabled}
              className="h-4 w-4 flex-shrink-0 accent-gold"
            />
            <span className="min-w-0 truncate">{l.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

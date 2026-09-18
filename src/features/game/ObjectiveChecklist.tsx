import { Fragment } from 'react'
import { clsx } from '@/lib/clsx'

export interface ChecklistLine {
  id: string
  window_label: string
  when_label: string | null
  condition_text: string
  vp_value: number
  is_counter: boolean
  is_cumulative_bonus: boolean
  mode?: 'fixed' | 'tactical' | null
}

/**
 * Renders a mission/secondary's actual scoring lines, grouped by the
 * round-window they apply in -- tap to toggle a flat condition, or use
 * the stepper for a "for each..." one. The caller computes the total
 * from `counts` and writes it wherever it needs to go (round_scores /
 * secondary_scores stay the source of truth, this is just how the
 * player got there).
 */
export function ObjectiveChecklist({
  lines,
  counts,
  onChangeCount,
  editable = true,
  compact = false,
}: {
  lines: ChecklistLine[]
  counts: Map<string, number>
  onChangeCount: (lineId: string, count: number) => void
  /** False for a spectator viewing someone else's game -- the checklist still shows exactly what's
   * ticked, just with no tap targets that would try (and fail server-side) to change it. */
  editable?: boolean
  /** Slightly smaller condition/detail text -- used for Primary VP, which otherwise runs the
   * player card long; tap targets stay the same size either way. */
  compact?: boolean
}) {
  const withHeaders = lines.map((line, i) => ({
    line,
    showWindowHeader: i === 0 || lines[i - 1].window_label !== line.window_label,
  }))

  return (
    <div className="flex flex-col gap-2">
      {withHeaders.map(({ line, showWindowHeader }) => {
        const count = counts.get(line.id) ?? 0
        const achieved = count > 0

        return (
          <Fragment key={line.id}>
            {showWindowHeader && (
              <p className="mt-0.5 text-xs font-semibold tracking-wide text-paper/50 uppercase first:mt-0">
                {line.window_label}
              </p>
            )}
            <div
              className={clsx(
                'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
                achieved ? 'border-gold/40 bg-gold/10' : 'border-veil-strong bg-veil',
                line.is_cumulative_bonus && 'ml-3',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={clsx('text-paper/90', compact ? 'text-xs' : 'text-sm')}>
                  {line.is_cumulative_bonus && <span className="text-paper/40">+ </span>}
                  {line.condition_text}
                </p>
                <p className={clsx('text-paper/40', compact ? 'text-[11px]' : 'text-xs')}>
                  {line.when_label}
                  {line.mode && <span className="ml-1 capitalize">({line.mode})</span>}
                  <span className="ml-1">
                    · {line.vp_value}VP{line.is_counter ? ' each' : ''}
                  </span>
                </p>
              </div>

              {line.is_counter ? (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease count"
                    disabled={!editable || count <= 0}
                    onClick={() => onChangeCount(line.id, count - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-veil-strong text-lg text-paper active:scale-95 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold text-paper">{count}</span>
                  <button
                    type="button"
                    aria-label="Increase count"
                    disabled={!editable}
                    onClick={() => onChangeCount(line.id, count + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-veil-strong text-lg text-paper active:scale-95 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={achieved ? 'Mark not achieved' : 'Mark achieved'}
                  disabled={!editable}
                  onClick={() => onChangeCount(line.id, achieved ? 0 : 1)}
                  className={clsx(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-base font-bold active:scale-95 disabled:cursor-default disabled:active:scale-100',
                    achieved ? 'bg-gold text-ink' : 'bg-veil-strong text-paper/30',
                  )}
                >
                  ✓
                </button>
              )}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

import { clsx } from '@/lib/clsx'

interface StepperProps {
  total: number
  current: number
  onChange: (round: number) => void
  /** Overrides a step's own number with a short label (e.g. the End of Game step reading "End"
   * instead of "6") -- steps without an entry here just show their round number. */
  labels?: Record<number, string>
}

/** Battle round selector: 1..total, current round highlighted -- `total` may include one extra
 * step past the last real battle round (see Scoreboard's endOfGameRound), labelled via `labels`. */
export function Stepper({ total, current, onChange, labels }: StepperProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Battle round">
      {Array.from({ length: total }, (_, i) => i + 1).map((round) => (
        <button
          key={round}
          type="button"
          role="tab"
          aria-selected={round === current}
          onClick={() => onChange(round)}
          className={clsx(
            'flex h-11 min-w-11 items-center justify-center rounded-full px-2 font-semibold transition-colors',
            round === current
              ? 'bg-gold text-ink'
              : 'bg-veil text-paper/60 hover:bg-veil-strong',
          )}
        >
          {labels?.[round] ?? round}
        </button>
      ))}
    </div>
  )
}

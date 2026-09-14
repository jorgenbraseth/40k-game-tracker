import { clsx } from '@/lib/clsx'

interface StepperProps {
  total: number
  current: number
  onChange: (round: number) => void
}

/** Battle round selector: 1..total, current round highlighted. */
export function Stepper({ total, current, onChange }: StepperProps) {
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
            'flex h-11 w-11 items-center justify-center rounded-full font-semibold transition-colors',
            round === current
              ? 'bg-gold text-ink'
              : 'bg-white/5 text-paper/60 hover:bg-white/10',
          )}
        >
          {round}
        </button>
      ))}
    </div>
  )
}

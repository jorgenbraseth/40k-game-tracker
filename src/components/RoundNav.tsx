interface RoundNavProps {
  /** The round being shown, 1..last. */
  round: number
  /** Highest round reachable -- Scoreboard's endOfGameRound, one step past the last battle round. */
  last: number
  /** What the middle reads, e.g. "Round 2" or "End". */
  label: string
  /** Smaller line under the label, e.g. "of 5". */
  sublabel?: string
  onChange: (round: number) => void
}

/** Battle round selector: just the round on screen plus previous/next -- no jumping straight to an
 * arbitrary round, which keeps it small enough to sit in Scoreboard's sticky header. */
export function RoundNav({ round, last, label, sublabel, onChange }: RoundNavProps) {
  const arrow =
    'flex h-11 w-9 flex-shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-paper/70 hover:bg-veil-strong hover:text-paper disabled:pointer-events-none disabled:opacity-20'
  return (
    <div className="flex items-center justify-center gap-0.5" role="group" aria-label="Battle round">
      <button
        type="button"
        aria-label="Previous round"
        disabled={round <= 1}
        onClick={() => onChange(round - 1)}
        className={arrow}
      >
        ‹
      </button>
      <div className="min-w-14 text-center" aria-live="polite">
        <p className="text-sm leading-tight font-semibold whitespace-nowrap text-paper">{label}</p>
        {sublabel && <p className="text-[10px] leading-tight text-paper/40">{sublabel}</p>}
      </div>
      <button
        type="button"
        aria-label="Next round"
        disabled={round >= last}
        onClick={() => onChange(round + 1)}
        className={arrow}
      >
        ›
      </button>
    </div>
  )
}

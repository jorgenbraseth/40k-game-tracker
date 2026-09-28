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
    'flex h-9 w-8 items-center justify-center rounded-lg text-2xl leading-none text-paper/70 hover:bg-veil-strong hover:text-paper disabled:pointer-events-none disabled:opacity-20'
  // Two rows rather than one: the label gets the full width of row 1, and the arrows flank the
  // "of N" sublabel underneath -- so the control is only as wide as its label, leaving the
  // players' totals on either side room to show their VP split and CP untruncated.
  return (
    <div className="grid grid-cols-[auto_auto_auto] items-center justify-center" role="group" aria-label="Battle round">
      <p
        className="col-span-3 text-center text-sm leading-tight font-semibold whitespace-nowrap text-paper"
        aria-live="polite"
      >
        {label}
      </p>
      <button
        type="button"
        aria-label="Previous round"
        disabled={round <= 1}
        onClick={() => onChange(round - 1)}
        className={arrow}
      >
        ‹
      </button>
      <p className="min-w-6 text-center text-[10px] leading-tight whitespace-nowrap text-paper/40">{sublabel}</p>
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

import { useUpsertCommandPoints } from '@/lib/queries/games'

/**
 * Command Points gained and spent this round, entered manually like every other score in this
 * app -- the well-known "+1 CP per round" isn't auto-granted, this is a bookkeeping tool, not a
 * rules engine (see 20260322000000_command_points.sql). Remaining CP (the running sum across
 * every round, computed by the caller via remainingCp()) is shown alongside so a player never has
 * to do the maths mid-game to know what they've got left to spend.
 */
export function CommandPointsPanel({
  gameId,
  gamePlayerId,
  battleRound,
  cpGained,
  cpSpent,
  remaining,
  userId,
  editable = true,
}: {
  gameId: string
  gamePlayerId: string
  battleRound: number
  cpGained: number
  cpSpent: number
  remaining: number
  userId: string
  /** False for a spectator -- shows the exact same gained/spent/remaining figures, just with no
   * way to change any of them (a write would fail server-side regardless). */
  editable?: boolean
}) {
  const upsert = useUpsertCommandPoints(gameId)

  const change = (gainedDelta: number, spentDelta: number) => {
    const nextGained = Math.max(0, cpGained + gainedDelta)
    const nextSpent = Math.max(0, cpSpent + spentDelta)
    upsert.mutate({ gamePlayerId, battleRound, cpGained: nextGained, cpSpent: nextSpent, userId })
  }

  const counterButtonClass =
    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-veil-strong text-lg text-paper active:scale-95 disabled:opacity-30'

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-paper/60 uppercase">CP</span>
        <span className="text-sm font-bold text-gold">
          {remaining}
          <span className="ml-1 text-xs font-normal text-paper/40">left</span>
        </span>
      </div>

      <div className="flex items-center justify-center gap-1.5 rounded-lg border border-veil-strong bg-veil px-1.5 py-1.5">
        <div className="flex flex-1 items-center justify-center gap-1">
          <span className="text-[11px] text-paper/60">Gained</span>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Decrease CP gained"
              disabled={!editable || cpGained <= 0}
              onClick={() => change(-1, 0)}
              className={counterButtonClass}
            >
              −
            </button>
            <span className="w-4 text-center font-semibold text-paper">{cpGained}</span>
            <button
              type="button"
              aria-label="Increase CP gained"
              disabled={!editable}
              onClick={() => change(1, 0)}
              className={counterButtonClass}
            >
              +
            </button>
          </div>
        </div>

        <div className="h-6 w-px flex-shrink-0 bg-veil-strong" />

        <div className="flex flex-1 items-center justify-center gap-1">
          <span className="text-[11px] text-paper/60">Spent</span>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Decrease CP spent"
              disabled={!editable || cpSpent <= 0}
              onClick={() => change(0, -1)}
              className={counterButtonClass}
            >
              −
            </button>
            <span className="w-4 text-center font-semibold text-paper">{cpSpent}</span>
            <button
              type="button"
              aria-label="Increase CP spent"
              disabled={!editable}
              onClick={() => change(0, 1)}
              className={counterButtonClass}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import type { Database } from '@/lib/database.types'
import { useUpsertPrimaryObjectiveTick, useUpsertRoundScore } from '@/lib/queries/games'
import { ObjectiveChecklist, type ChecklistLine } from './ObjectiveChecklist'

type PrimaryTick = Database['public']['Tables']['primary_objective_ticks']['Row']

/** Primary VP entry: tap the total to open a checklist of the resolved mission's actual scoring lines instead of typing a raw number. */
export function PrimaryScorePanel({
  gameId,
  gamePlayerId,
  battleRound,
  currentRoundVp,
  maxPrimary,
  lines,
  ticks,
  userId,
}: {
  gameId: string
  gamePlayerId: string
  battleRound: number
  currentRoundVp: number
  maxPrimary: number
  lines: ChecklistLine[]
  ticks: PrimaryTick[]
  userId: string
}) {
  const [open, setOpen] = useState(false)
  const [manualDraft, setManualDraft] = useState<string | null>(null)
  const tick = useUpsertPrimaryObjectiveTick(gameId)
  const upsertRound = useUpsertRoundScore(gameId)

  const counts = new Map(
    ticks
      .filter((t) => t.game_player_id === gamePlayerId && t.battle_round === battleRound)
      .map((t) => [t.mission_objective_line_id, t.count]),
  )

  const handleChangeCount = (lineId: string, newCount: number) => {
    tick.mutate({ gamePlayerId, battleRound, missionObjectiveLineId: lineId, count: newCount, userId })
    const newTotal = lines.reduce(
      (sum, l) => sum + (l.id === lineId ? newCount : (counts.get(l.id) ?? 0)) * l.vp_value,
      0,
    )
    upsertRound.mutate({ gamePlayerId, battleRound, primaryVp: newTotal, userId })
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-medium tracking-wide text-paper/60 uppercase">Primary VP</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-gold/40 bg-gold/10 text-3xl font-bold text-gold tap-highlight-transparent select-none active:scale-95"
        >
          {currentRoundVp}
        </button>
        <span className="text-[11px] text-paper/40">of {maxPrimary} · tap to score</span>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Score primary objectives">
        <div className="flex flex-col gap-4">
          {lines.length === 0 ? (
            <p className="text-sm text-paper/50">
              No scoring breakdown available for this mission -- enter the total directly below.
            </p>
          ) : (
            <ObjectiveChecklist lines={lines} counts={counts} onChangeCount={handleChangeCount} />
          )}

          <div className="border-t border-white/10 pt-3">
            {manualDraft === null ? (
              <button
                type="button"
                onClick={() => setManualDraft(String(currentRoundVp))}
                className="text-xs text-paper/40 underline hover:text-paper"
              >
                Or set the total directly
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <label className="text-sm text-paper/70" htmlFor="manual-primary-vp">
                  Total this round
                </label>
                <input
                  id="manual-primary-vp"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  autoFocus
                  value={manualDraft}
                  onChange={(e) => setManualDraft(e.target.value)}
                  onBlur={() => {
                    const vp = Math.max(0, Number(manualDraft) || 0)
                    upsertRound.mutate({ gamePlayerId, battleRound, primaryVp: vp, userId })
                    setManualDraft(null)
                  }}
                  className="w-20 rounded border border-white/15 bg-white/5 px-2 py-1 text-center text-paper focus:border-gold focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      </Sheet>
    </>
  )
}

import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import type { Database } from '@/lib/database.types'
import type { GameDetail } from '@/lib/queries/games'
import { useRemoveSecondaryScore, useUpsertSecondaryObjectiveTick, useUpsertSecondaryScore } from '@/lib/queries/games'
import { ObjectiveChecklist } from './ObjectiveChecklist'

type SecondaryObjective = Database['public']['Tables']['secondary_objectives']['Row']
type SecondaryObjectiveLine = Database['public']['Tables']['secondary_objective_lines']['Row']
type SecondaryTick = Database['public']['Tables']['secondary_objective_ticks']['Row']

export function SecondaryScores({
  gameId,
  gamePlayerId,
  round,
  scores,
  available,
  lines,
  ticks,
  userId,
  editable,
}: {
  gameId: string
  gamePlayerId: string
  round: number
  scores: GameDetail['secondaryScores']
  available: SecondaryObjective[]
  lines: SecondaryObjectiveLine[]
  ticks: SecondaryTick[]
  userId: string
  editable: boolean
}) {
  const upsert = useUpsertSecondaryScore(gameId)
  const remove = useRemoveSecondaryScore(gameId)
  const tick = useUpsertSecondaryObjectiveTick(gameId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [scoringObjectiveId, setScoringObjectiveId] = useState<string | null>(null)
  const [manualDraft, setManualDraft] = useState<string | null>(null)

  const mine = scores.filter((s) => s.game_player_id === gamePlayerId && s.battle_round === round)
  const usedIds = new Set(mine.map((s) => s.secondary_objective_id))
  const pickable = available.filter((a) => !usedIds.has(a.id))

  const scoringObjective = available.find((a) => a.id === scoringObjectiveId)
  const scoringScore = mine.find((s) => s.secondary_objective_id === scoringObjectiveId)
  const scoringLines = lines.filter((l) => l.secondary_objective_id === scoringObjectiveId)
  const counts = new Map(
    ticks
      .filter(
        (t) =>
          t.game_player_id === gamePlayerId &&
          t.battle_round === round &&
          scoringLines.some((l) => l.id === t.secondary_objective_line_id),
      )
      .map((t) => [t.secondary_objective_line_id, t.count]),
  )

  const handleChangeCount = (lineId: string, newCount: number) => {
    if (!scoringObjectiveId) return
    tick.mutate({ gamePlayerId, battleRound: round, secondaryObjectiveLineId: lineId, count: newCount, userId })
    const newTotal = scoringLines.reduce(
      (sum, l) => sum + (l.id === lineId ? newCount : (counts.get(l.id) ?? 0)) * l.vp_value,
      0,
    )
    const clamped = Math.max(0, Math.min(scoringObjective?.max_vp ?? 5, newTotal))
    upsert.mutate({ gamePlayerId, battleRound: round, secondaryObjectiveId: scoringObjectiveId, vpScored: clamped, userId })
  }

  const closeScoringSheet = () => {
    setScoringObjectiveId(null)
    setManualDraft(null)
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {mine.map((s) => {
        const objective = available.find((a) => a.id === s.secondary_objective_id)
        return (
          <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-sm">
            <button
              type="button"
              onClick={() => editable && setScoringObjectiveId(s.secondary_objective_id)}
              disabled={!editable}
              className="flex flex-1 items-center justify-between gap-2 text-left disabled:cursor-default"
            >
              <span className="truncate text-paper/80">{objective?.name ?? 'Unknown'}</span>
              <span className="font-semibold text-gold">{s.vp_scored}VP</span>
            </button>
            {editable && (
              <button
                type="button"
                aria-label={`Remove ${objective?.name}`}
                onClick={() =>
                  remove.mutate({ gamePlayerId, battleRound: round, secondaryObjectiveId: s.secondary_objective_id })
                }
                className="ml-2 text-paper/40 hover:text-red-400"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}

      {editable && pickable.length > 0 && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="min-h-9 rounded-lg border border-dashed border-white/20 py-1.5 text-sm text-paper/50 hover:border-gold hover:text-gold"
        >
          + Add secondary
        </button>
      )}

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Score a secondary">
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {pickable.map((objective) => (
            <li key={objective.id}>
              <button
                type="button"
                onClick={() => {
                  upsert.mutate({
                    gamePlayerId,
                    battleRound: round,
                    secondaryObjectiveId: objective.id,
                    vpScored: 0,
                    userId,
                  })
                  setPickerOpen(false)
                  setScoringObjectiveId(objective.id)
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-white/10"
              >
                <span className="text-paper">{objective.name}</span>
                <span className="text-xs text-paper/40">up to {objective.max_vp}VP</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {scoringObjectiveId && (
        <Sheet open onClose={closeScoringSheet} title={scoringObjective?.name ?? 'Score secondary'}>
          <div className="flex flex-col gap-4">
            {scoringLines.length === 0 ? (
              <p className="text-sm text-paper/50">
                No scoring breakdown available for this secondary -- enter the total directly below.
              </p>
            ) : (
              <ObjectiveChecklist lines={scoringLines} counts={counts} onChangeCount={handleChangeCount} />
            )}

            <div className="border-t border-white/10 pt-3">
              {manualDraft === null ? (
                <button
                  type="button"
                  onClick={() => setManualDraft(String(scoringScore?.vp_scored ?? 0))}
                  className="text-xs text-paper/40 underline hover:text-paper"
                >
                  Or set the total directly
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-paper/70" htmlFor="manual-secondary-vp">
                    Total this round
                  </label>
                  <input
                    id="manual-secondary-vp"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={scoringObjective?.max_vp ?? 15}
                    autoFocus
                    value={manualDraft}
                    onChange={(e) => setManualDraft(e.target.value)}
                    onBlur={() => {
                      if (!scoringObjectiveId) return
                      const vp = Math.max(0, Math.min(scoringObjective?.max_vp ?? 15, Number(manualDraft) || 0))
                      upsert.mutate({ gamePlayerId, battleRound: round, secondaryObjectiveId: scoringObjectiveId, vpScored: vp, userId })
                      setManualDraft(null)
                    }}
                    className="w-20 rounded border border-white/15 bg-white/5 px-2 py-1 text-center text-paper focus:border-gold focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}

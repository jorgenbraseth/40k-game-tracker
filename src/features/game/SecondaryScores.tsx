import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import type { Database } from '@/lib/database.types'
import type { GameDetail } from '@/lib/queries/games'
import { useRemoveSecondaryScore, useUpsertSecondaryScore } from '@/lib/queries/games'

type SecondaryObjective = Database['public']['Tables']['secondary_objectives']['Row']

export function SecondaryScores({
  gameId,
  gamePlayerId,
  round,
  scores,
  available,
  userId,
  editable,
}: {
  gameId: string
  gamePlayerId: string
  round: number
  scores: GameDetail['secondaryScores']
  available: SecondaryObjective[]
  userId: string
  editable: boolean
}) {
  const upsert = useUpsertSecondaryScore(gameId)
  const remove = useRemoveSecondaryScore(gameId)
  const [pickerOpen, setPickerOpen] = useState(false)

  const mine = scores.filter((s) => s.game_player_id === gamePlayerId && s.battle_round === round)
  const usedIds = new Set(mine.map((s) => s.secondary_objective_id))
  const pickable = available.filter((a) => !usedIds.has(a.id))

  return (
    <div className="flex w-full flex-col gap-1.5">
      {mine.map((s) => {
        const objective = available.find((a) => a.id === s.secondary_objective_id)
        return (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-sm"
          >
            <span className="truncate text-paper/80">{objective?.name ?? 'Unknown'}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={objective?.max_vp ?? 15}
                disabled={!editable}
                defaultValue={s.vp_scored}
                onBlur={(e) => {
                  const vp = Math.max(0, Math.min(objective?.max_vp ?? 15, Number(e.target.value) || 0))
                  upsert.mutate({
                    gamePlayerId,
                    battleRound: round,
                    secondaryObjectiveId: s.secondary_objective_id,
                    vpScored: vp,
                    userId,
                  })
                }}
                className="w-14 rounded border border-white/15 bg-white/5 px-1.5 py-1 text-center text-paper focus:border-gold focus:outline-none disabled:opacity-50"
              />
              {editable && (
                <button
                  type="button"
                  aria-label={`Remove ${objective?.name}`}
                  onClick={() =>
                    remove.mutate({ gamePlayerId, battleRound: round, secondaryObjectiveId: s.secondary_objective_id })
                  }
                  className="text-paper/40 hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </div>
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
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-white/10"
              >
                <span className="text-paper">{objective.name}</span>
                <span className="text-xs text-paper/40 capitalize">{objective.category}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}

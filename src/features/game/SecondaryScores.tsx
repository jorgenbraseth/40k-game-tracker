import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import { clsx } from '@/lib/clsx'
import type { Database } from '@/lib/database.types'
import type { GameDetail } from '@/lib/queries/games'
import {
  useDrawSecondary,
  useRemoveSecondaryScore,
  useUndrawSecondary,
  useUpsertSecondaryObjectiveTick,
  useUpsertSecondaryScore,
} from '@/lib/queries/games'
import { ObjectiveChecklist } from './ObjectiveChecklist'

type SecondaryObjective = Database['public']['Tables']['secondary_objectives']['Row']
type SecondaryObjectiveLine = Database['public']['Tables']['secondary_objective_lines']['Row']
type SecondaryTick = Database['public']['Tables']['secondary_objective_ticks']['Row']

/**
 * Tactical secondaries are drawn cumulatively (2 more each round) and scored from that whole
 * cumulative pool, not just what was drawn this round -- a player may score any not-yet-scored
 * secondary they've drawn so far this game. So this shows every drawn-and-unscored secondary
 * (badged with which round it was drawn, "this round" called out specially) first, then every
 * already-scored one below (badged with which round that happened), regardless of which round is
 * currently being viewed -- only *new* draws/scores get attributed to the viewed round. Within
 * each group, secondaries are ordered by the round they were drawn in, oldest first.
 */
export function SecondaryScores({
  gameId,
  gamePlayerId,
  round,
  scores,
  draws,
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
  draws: GameDetail['secondaryDraws']
  available: SecondaryObjective[]
  lines: SecondaryObjectiveLine[]
  ticks: SecondaryTick[]
  userId: string
  editable: boolean
}) {
  const upsert = useUpsertSecondaryScore(gameId)
  const remove = useRemoveSecondaryScore(gameId)
  const draw = useDrawSecondary(gameId)
  const undraw = useUndrawSecondary(gameId)
  const tick = useUpsertSecondaryObjectiveTick(gameId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [scoringObjectiveId, setScoringObjectiveId] = useState<string | null>(null)
  const [manualDraft, setManualDraft] = useState<string | null>(null)

  const myDraws = draws.filter((d) => d.game_player_id === gamePlayerId)
  const drawnRoundBySecondaryId = new Map(myDraws.map((d) => [d.secondary_objective_id, d.battle_round]))
  const myScores = scores
    .filter((s) => s.game_player_id === gamePlayerId)
    .sort(
      (a, b) =>
        (drawnRoundBySecondaryId.get(a.secondary_objective_id) ?? a.battle_round) -
        (drawnRoundBySecondaryId.get(b.secondary_objective_id) ?? b.battle_round),
    )
  const scoredIds = new Set(myScores.map((s) => s.secondary_objective_id))
  const drawnIds = new Set(myDraws.map((d) => d.secondary_objective_id))
  const availableToScore = myDraws
    .filter((d) => !scoredIds.has(d.secondary_objective_id))
    .sort((a, b) => a.battle_round - b.battle_round)
  const notYetDrawn = available.filter((a) => !drawnIds.has(a.id))

  const scoringObjective = available.find((a) => a.id === scoringObjectiveId)
  const scoringScore = myScores.find((s) => s.secondary_objective_id === scoringObjectiveId)
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

  const drawOne = (secondaryObjectiveId: string) => {
    draw.mutate({ gamePlayerId, battleRound: round, secondaryObjectiveId, userId })
    setPickerOpen(false)
  }

  const drawRandom = () => {
    if (notYetDrawn.length === 0) return
    const pick = notYetDrawn[Math.floor(Math.random() * notYetDrawn.length)]
    drawOne(pick.id)
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {availableToScore.length > 0 && (
        <p className="text-[11px] font-semibold tracking-wide text-paper/40 uppercase">
          Drawn, not yet scored
        </p>
      )}
      {availableToScore.map((d) => {
        const objective = available.find((a) => a.id === d.secondary_objective_id)
        const drawnThisRound = d.battle_round === round
        return (
          <div
            key={d.id}
            className={clsx(
              'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm',
              drawnThisRound ? 'bg-gold/10 ring-1 ring-gold/30' : 'bg-white/5',
            )}
          >
            <button
              type="button"
              onClick={() => editable && setScoringObjectiveId(d.secondary_objective_id)}
              disabled={!editable}
              className="flex flex-1 items-center justify-between gap-2 text-left disabled:cursor-default"
            >
              <span className="min-w-0 truncate text-paper/80">{objective?.name ?? 'Unknown'}</span>
              <span
                className={clsx(
                  'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  drawnThisRound ? 'bg-gold/20 text-gold' : 'bg-white/10 text-paper/50',
                )}
              >
                {drawnThisRound ? 'Drawn this round' : `Drawn R${d.battle_round}`}
              </span>
            </button>
            {editable && (
              <button
                type="button"
                aria-label={`Undo draw of ${objective?.name}`}
                onClick={() => undraw.mutate({ gamePlayerId, secondaryObjectiveId: d.secondary_objective_id })}
                className="ml-2 text-paper/40 hover:text-red-400"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}

      {myScores.length > 0 && (
        <p className="mt-1 text-[11px] font-semibold tracking-wide text-paper/40 uppercase">Scored</p>
      )}
      {myScores.map((s) => {
        const objective = available.find((a) => a.id === s.secondary_objective_id)
        return (
          <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-sm">
            <button
              type="button"
              onClick={() => editable && setScoringObjectiveId(s.secondary_objective_id)}
              disabled={!editable}
              className="flex flex-1 items-center justify-between gap-2 text-left disabled:cursor-default"
            >
              <span className="min-w-0 truncate text-paper/80">
                {objective?.name ?? 'Unknown'}
                <span className="ml-1.5 text-[10px] text-paper/40">R{s.battle_round}</span>
              </span>
              <span className="font-semibold text-gold">{s.vp_scored}VP</span>
            </button>
            {editable && (
              <button
                type="button"
                aria-label={`Remove ${objective?.name}`}
                onClick={() =>
                  remove.mutate({ gamePlayerId, battleRound: s.battle_round, secondaryObjectiveId: s.secondary_objective_id })
                }
                className="ml-2 text-paper/40 hover:text-red-400"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}

      {editable && notYetDrawn.length > 0 && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="min-h-9 rounded-lg border border-dashed border-white/20 py-1.5 text-sm text-paper/50 hover:border-gold hover:text-gold"
        >
          + Draw a secondary
        </button>
      )}

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Draw a secondary">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={drawRandom}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gold/40 bg-gold/10 py-3 text-sm font-semibold text-gold hover:bg-gold/20"
          >
            🎲 Draw random
          </button>
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {notYetDrawn.map((objective) => (
              <li key={objective.id}>
                <button
                  type="button"
                  onClick={() => drawOne(objective.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-white/10"
                >
                  <span className="text-paper">{objective.name}</span>
                  <span className="text-xs text-paper/40">up to {objective.max_vp}VP</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
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

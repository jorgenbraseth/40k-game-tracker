import { useState } from 'react'
import type { Database } from '@/lib/database.types'
import { windowAppliesToRound } from '@/lib/missionWindows'
import { useUpsertPrimaryObjectiveTick, useUpsertRoundScore } from '@/lib/queries/games'
import { ObjectiveChecklist, type ChecklistLine } from './ObjectiveChecklist'

type PrimaryTick = Database['public']['Tables']['primary_objective_ticks']['Row']

/** No matter how a mission's own scoring lines add up, the core rules cap primary at 15VP in a
 * single battle round and 45VP over the whole game -- this is the game-total half of that; the
 * per-round half is `maxPrimary` (missions.max_primary_vp, always 15 today). */
const MAX_PRIMARY_VP_PER_GAME = 45

/**
 * Primary VP entry: shows the resolved mission's actual scoring lines for whichever round is
 * being viewed -- not a tap-to-open modal, since the round overview should show what's actually
 * scorable right there. Only the lines whose window (window_label, e.g. "Second Battle Round
 * Onwards") is actually live for `battleRound` are shown -- see windowAppliesToRound -- so a
 * player never sees, say, 2nd-round-onwards scoring while looking at round 1.
 *
 * `battleRound` can be `endOfGameRound` (one past the last real battle round): that's the one
 * window ordinary rounds never show, "End of the Battle" -- a handful of missions award a few
 * more VP once, checked only at the very end of the game, recorded the same way as any other
 * round's score (round_scores/primary_objective_ticks, just keyed to that round number).
 */
export function PrimaryScorePanel({
  gameId,
  gamePlayerId,
  battleRound,
  endOfGameRound,
  currentRoundVp,
  maxPrimary,
  otherRoundsTotal,
  lines,
  ticks,
  userId,
}: {
  gameId: string
  gamePlayerId: string
  battleRound: number
  endOfGameRound: number
  currentRoundVp: number
  maxPrimary: number
  /** This player's primary VP from every *other* round, so this round's own cap can be narrowed
   * to whatever's left of the 45VP game total without a separate round-trip. */
  otherRoundsTotal: number
  lines: ChecklistLine[]
  ticks: PrimaryTick[]
  userId: string
}) {
  const [manualDraft, setManualDraft] = useState<string | null>(null)
  const tick = useUpsertPrimaryObjectiveTick(gameId)
  const upsertRound = useUpsertRoundScore(gameId)

  const isEndOfGame = battleRound === endOfGameRound
  const applicableLines = lines.filter((l) => windowAppliesToRound(l.window_label, battleRound, endOfGameRound))
  const roundCap = Math.max(0, Math.min(maxPrimary, MAX_PRIMARY_VP_PER_GAME - otherRoundsTotal))

  const counts = new Map(
    ticks
      .filter((t) => t.game_player_id === gamePlayerId && t.battle_round === battleRound)
      .map((t) => [t.mission_objective_line_id, t.count]),
  )

  const handleChangeCount = (lineId: string, newCount: number) => {
    tick.mutate({ gamePlayerId, battleRound, missionObjectiveLineId: lineId, count: newCount, userId })
    const rawTotal = applicableLines.reduce(
      (sum, l) => sum + (l.id === lineId ? newCount : (counts.get(l.id) ?? 0)) * l.vp_value,
      0,
    )
    upsertRound.mutate({ gamePlayerId, battleRound, primaryVp: Math.max(0, Math.min(roundCap, rawTotal)), userId })
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-paper/60 uppercase">
          {isEndOfGame ? 'End-of-battle primary VP' : 'Primary VP'}
        </span>
        <span className="text-sm font-bold text-gold">
          {currentRoundVp}
          <span className="ml-1 text-xs font-normal text-paper/40">of {roundCap}</span>
        </span>
      </div>

      {applicableLines.length === 0 ? (
        <p className="text-xs text-paper/50">
          {isEndOfGame
            ? "This mission has no scoring that's checked only at the end of the battle."
            : 'No primary scoring available this round.'}
        </p>
      ) : (
        <ObjectiveChecklist lines={applicableLines} counts={counts} onChangeCount={handleChangeCount} />
      )}

      <div className="border-t border-white/10 pt-2">
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
            <label className="text-sm text-paper/70" htmlFor={`manual-primary-vp-${gamePlayerId}-${battleRound}`}>
              Total {isEndOfGame ? 'end-of-battle' : 'this round'}
            </label>
            <input
              id={`manual-primary-vp-${gamePlayerId}-${battleRound}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={roundCap}
              autoFocus
              value={manualDraft}
              onChange={(e) => setManualDraft(e.target.value)}
              onBlur={() => {
                const vp = Math.max(0, Math.min(roundCap, Number(manualDraft) || 0))
                upsertRound.mutate({ gamePlayerId, battleRound, primaryVp: vp, userId })
                setManualDraft(null)
              }}
              className="w-20 rounded border border-white/15 bg-white/5 px-2 py-1 text-center text-paper focus:border-gold focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}

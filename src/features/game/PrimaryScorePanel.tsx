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
  editable = true,
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
  /** False for a spectator -- shows the exact same checklist and total, just with no way to
   * change either (a write would fail server-side regardless; this just avoids offering it). */
  editable?: boolean
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
      <div className="flex items-center justify-between px-3">
        <span className="text-[11px] font-medium tracking-wide text-paper/60 uppercase">
          {isEndOfGame ? 'End-of-battle primary VP' : 'Primary VP'}
        </span>
        {/* The round total doubles as its own manual override -- tap the pencil to type a total
            straight in, for when the checklist doesn't cover how the VP was actually scored. */}
        {manualDraft === null ? (
          <span className="flex items-center gap-1">
            <span className="text-xs font-bold text-gold">
              {currentRoundVp}
              <span className="ml-1 text-[10px] font-normal text-paper/40">of {roundCap}</span>
            </span>
            {editable && (
              <button
                type="button"
                aria-label="Set total directly"
                title="Set total directly"
                onClick={() => setManualDraft(String(currentRoundVp))}
                className="-my-2 -mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-sm text-paper/40 hover:bg-veil-strong hover:text-paper"
              >
                ✎
              </button>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <input
              aria-label={`Total ${isEndOfGame ? 'end-of-battle' : 'this round'}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={roundCap}
              autoFocus
              value={manualDraft}
              onChange={(e) => setManualDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              onBlur={() => {
                const vp = Math.max(0, Math.min(roundCap, Number(manualDraft) || 0))
                upsertRound.mutate({ gamePlayerId, battleRound, primaryVp: vp, userId })
                setManualDraft(null)
              }}
              className="-my-1 w-14 rounded border border-veil-strong bg-veil px-1.5 py-0.5 text-center text-xs font-bold text-gold focus:border-gold focus:outline-none"
            />
            <span className="text-[10px] text-paper/40">of {roundCap}</span>
          </span>
        )}
      </div>

      {applicableLines.length === 0 ? (
        <p className="px-3 text-[11px] text-paper/50">
          {isEndOfGame
            ? "This mission has no scoring that's checked only at the end of the battle."
            : 'No primary scoring available this round.'}
        </p>
      ) : (
        <ObjectiveChecklist
          lines={applicableLines}
          counts={counts}
          onChangeCount={handleChangeCount}
          editable={editable}
          compact
          flush
        />
      )}
    </div>
  )
}

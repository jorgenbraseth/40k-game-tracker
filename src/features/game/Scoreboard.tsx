import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { ScoreCell } from '@/components/ScoreCell'
import { Spinner } from '@/components/Feedback'
import { Stepper } from '@/components/Stepper'
import { useAuth } from '@/features/auth/AuthProvider'
import type { GameDetail } from '@/lib/queries/games'
import { useFinishGame, useSetCurrentRound, useUpsertRoundScore } from '@/lib/queries/games'
import { useMission, useSecondaryObjectives } from '@/lib/queries/referenceData'
import { useWakeLock } from '@/lib/useWakeLock'
import { SecondaryScores } from './SecondaryScores'

export function Scoreboard({ detail, opponentOnline }: { detail: GameDetail; opponentOnline: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const mission = useMission(detail.game.mission_id)
  const secondaries = useSecondaryObjectives(detail.game.mission_pack_id)
  const upsertRound = useUpsertRoundScore(detail.game.id)
  const setCurrentRound = useSetCurrentRound(detail.game.id)
  const finishGame = useFinishGame(detail.game.id)

  const [viewRound, setViewRound] = useState(detail.game.current_round)
  const [endSheetOpen, setEndSheetOpen] = useState(false)

  useWakeLock(true)

  if (!user) return null
  if (mission.isLoading || secondaries.isLoading) return <Spinner label="Loading mission data…" />

  const maxPrimary = mission.data?.max_primary_vp ?? 50
  const [p1, p2] = detail.players
  const isLastRound = viewRound === detail.game.total_rounds
  const isViewingCurrent = viewRound === detail.game.current_round

  const getRoundScore = (gamePlayerId: string) =>
    detail.roundScores.find((r) => r.game_player_id === gamePlayerId && r.battle_round === viewRound)?.primary_vp ?? 0

  const advanceRound = () => {
    const next = Math.min(detail.game.total_rounds, detail.game.current_round + 1)
    setCurrentRound.mutate(next)
    setViewRound(next)
  }

  const suggestedOutcome: 'seat_1' | 'seat_2' | 'draw' = (() => {
    if (!p1 || !p2) return 'draw'
    if (p1.totalVp > p2.totalVp) return 'seat_1'
    if (p2.totalVp > p1.totalVp) return 'seat_2'
    return 'draw'
  })()

  const endGame = async (outcome: 'seat_1' | 'seat_2' | 'draw') => {
    await finishGame.mutateAsync(outcome)
    navigate(`/game/${detail.game.id}/summary`)
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-paper/50">
            Round {detail.game.current_round} of {detail.game.total_rounds}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${opponentOnline ? 'text-green-400' : 'text-paper/40'}`}>
          <span className={`h-2 w-2 rounded-full ${opponentOnline ? 'bg-green-400' : 'bg-paper/30'}`} />
          opponent {opponentOnline ? 'online' : 'offline'}
        </span>
      </div>

      <Stepper total={detail.game.total_rounds} current={viewRound} onChange={setViewRound} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {detail.players.map((entry) => (
          <div key={entry.player.id} className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-center">
              <p className="font-semibold text-paper">
                {entry.profile?.display_name ?? `Seat ${entry.player.seat}`}
                {entry.player.user_id === user.id && <span className="ml-1 text-xs text-gold">(you)</span>}
              </p>
              <p className="text-xs text-paper/50">
                {entry.factionName ?? 'No faction'}
                {entry.player.army_name ? ` · ${entry.player.army_name}` : ''}
              </p>
            </div>

            <ScoreCell
              label="Primary VP"
              value={getRoundScore(entry.player.id)}
              max={maxPrimary}
              onChange={(vp) =>
                upsertRound.mutate({
                  gamePlayerId: entry.player.id,
                  battleRound: viewRound,
                  primaryVp: vp,
                  userId: user.id,
                })
              }
            />

            <SecondaryScores
              gameId={detail.game.id}
              gamePlayerId={entry.player.id}
              round={viewRound}
              scores={detail.secondaryScores}
              available={secondaries.data ?? []}
              userId={user.id}
              editable
            />
          </div>
        ))}
      </div>

      {isLastRound && isViewingCurrent ? (
        <Button variant="danger" onClick={() => setEndSheetOpen(true)}>
          End game
        </Button>
      ) : isViewingCurrent ? (
        <Button variant="secondary" onClick={advanceRound}>
          Advance to round {detail.game.current_round + 1}
        </Button>
      ) : null}

      {/* Running totals -- always visible without scrolling, per the design brief. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          {detail.players.map((entry) => (
            <div key={entry.player.id} className="flex-1 text-center">
              <p className="truncate text-xs text-paper/50">{entry.profile?.display_name ?? `Seat ${entry.player.seat}`}</p>
              <p className="text-2xl font-bold text-gold">{entry.totalVp}</p>
              <p className="text-[11px] text-paper/40">
                {entry.primaryTotal} primary + {entry.secondaryTotal} secondary
              </p>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={endSheetOpen} onClose={() => setEndSheetOpen(false)} title="End game">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-paper/60">
            {p1?.profile?.display_name ?? 'Seat 1'}: {p1?.totalVp ?? 0} · {p2?.profile?.display_name ?? 'Seat 2'}:{' '}
            {p2?.totalVp ?? 0}
          </p>
          <Button onClick={() => endGame(suggestedOutcome)} disabled={finishGame.isPending}>
            {suggestedOutcome === 'draw'
              ? 'Confirm draw'
              : `Confirm ${suggestedOutcome === 'seat_1' ? p1?.profile?.display_name : p2?.profile?.display_name} wins`}
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={() => endGame('seat_1')} disabled={finishGame.isPending}>
              {p1?.profile?.display_name ?? 'Seat 1'} wins
            </Button>
            <Button variant="secondary" onClick={() => endGame('draw')} disabled={finishGame.isPending}>
              Draw
            </Button>
            <Button variant="secondary" onClick={() => endGame('seat_2')} disabled={finishGame.isPending}>
              {p2?.profile?.display_name ?? 'Seat 2'} wins
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

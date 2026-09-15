import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { Sheet } from '@/components/Sheet'
import { Spinner } from '@/components/Feedback'
import { Stepper } from '@/components/Stepper'
import { useAuth } from '@/features/auth/AuthProvider'
import type { GameDetail } from '@/lib/queries/games'
import {
  playerLabel,
  setMirroredField,
  useAbandonGame,
  useDeleteGame,
  useFinishGame,
  useSetCurrentRound,
  useSetLayoutVariant,
  useSetRole,
  useSetTurnOrder,
  useUpdatePlayerSetup,
} from '@/lib/queries/games'
import {
  useFactions,
  useForceDispositions,
  useMission,
  useMissionObjectiveLines,
  useSecondaryObjectiveLines,
  useSecondaryObjectives,
} from '@/lib/queries/referenceData'
import { useWakeLock } from '@/lib/useWakeLock'
import { GameConfigPicker } from './GameConfigPicker'
import { PlayerSetupFields } from './PlayerSetupFields'
import { PrimaryScorePanel } from './PrimaryScorePanel'
import { SecondaryScores } from './SecondaryScores'

export function Scoreboard({ detail, opponentOnline }: { detail: GameDetail; opponentOnline: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [p1, p2] = detail.players
  const p1Mission = useMission(p1?.player.mission_id ?? undefined)
  const p2Mission = useMission(p2?.player.mission_id ?? undefined)
  const p1Lines = useMissionObjectiveLines(p1?.player.mission_id ?? undefined)
  const p2Lines = useMissionObjectiveLines(p2?.player.mission_id ?? undefined)
  const secondaries = useSecondaryObjectives(detail.game.mission_pack_id)
  const secondaryLines = useSecondaryObjectiveLines(secondaries.data?.map((s) => s.id))
  const factions = useFactions()
  const forceDispositions = useForceDispositions()
  const setCurrentRound = useSetCurrentRound(detail.game.id)
  const setLayoutVariant = useSetLayoutVariant(detail.game.id)
  const finishGame = useFinishGame(detail.game.id)
  const abandonGame = useAbandonGame(detail.game.id)
  const deleteGame = useDeleteGame()
  const updateSetup = useUpdatePlayerSetup(detail.game.id)
  const setRole = useSetRole(detail.game.id)
  const setTurnOrder = useSetTurnOrder(detail.game.id)

  const [viewRound, setViewRound] = useState(detail.game.current_round)
  const [endSheetOpen, setEndSheetOpen] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false)
  const [configSheetOpen, setConfigSheetOpen] = useState(false)

  useWakeLock(detail.game.status === 'active')

  if (!user) return null
  if (
    p1Mission.isLoading ||
    p2Mission.isLoading ||
    p1Lines.isLoading ||
    p2Lines.isLoading ||
    secondaries.isLoading ||
    secondaryLines.isLoading
  ) {
    return <Spinner label="Loading mission data…" />
  }

  const missionByPlayerId = new Map([
    [p1?.player.id, p1Mission.data],
    [p2?.player.id, p2Mission.data],
  ])
  const linesByPlayerId = new Map([
    [p1?.player.id, p1Lines.data ?? []],
    [p2?.player.id, p2Lines.data ?? []],
  ])
  const defaultMaxPrimary = 15
  const isActive = detail.game.status === 'active'
  const isLastRound = viewRound === detail.game.total_rounds
  const isViewingCurrent = viewRound === detail.game.current_round

  // Once both players have settled the "who takes the first turn" roll-off,
  // show the one who went first -- "top of round" -- first on screen.
  // Left unreordered (original seat order) until both are actually set, so
  // a half-picked state doesn't jump around.
  const bothTurnOrderSet = detail.players.length === 2 && detail.players.every((p) => p.player.turn_order)
  const turnOrderRank = (p: GameDetail['players'][number]) => (p.player.turn_order === 'first' ? 0 : 1)
  const orderedPlayers = bothTurnOrderSet
    ? [...detail.players].sort((a, b) => turnOrderRank(a) - turnOrderRank(b))
    : detail.players

  // For GameConfigPicker: "me" is whichever seat this viewer's own account controls, regardless
  // of seat number -- same convention WaitingRoom uses, so "You" always means the right seat.
  const me = detail.players.find((p) => p.player.user_id === user.id)
  const opponent = detail.players.find((p) => p.player.id !== me?.player.id)

  const getRoundScore = (gamePlayerId: string) =>
    detail.roundScores.find((r) => r.game_player_id === gamePlayerId && r.battle_round === viewRound)?.primary_vp ?? 0

  const advanceRound = () => {
    const next = Math.min(detail.game.total_rounds, detail.game.current_round + 1)
    setCurrentRound.mutate(next)
    setViewRound(next)
  }

  const goBackRound = () => {
    const prev = Math.max(1, detail.game.current_round - 1)
    setCurrentRound.mutate(prev)
    setViewRound(prev)
  }

  const suggestedOutcome: 'seat_1' | 'seat_2' | 'draw' = (() => {
    if (!p1 || !p2) return 'draw'
    if (p1.totalVp > p2.totalVp) return 'seat_1'
    if (p2.totalVp > p1.totalVp) return 'seat_2'
    return 'draw'
  })()

  const endGame = async (outcome: 'seat_1' | 'seat_2' | 'draw') => {
    await finishGame.mutateAsync(outcome)
    setEndSheetOpen(false)
    navigate(`/game/${detail.game.id}/summary`)
  }

  const abandon = async () => {
    await abandonGame.mutateAsync()
    setEndSheetOpen(false)
    navigate(`/game/${detail.game.id}/summary`)
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-paper/50">
            {detail.game.status === 'complete'
              ? 'Game complete'
              : detail.game.status === 'abandoned'
                ? 'Game abandoned'
                : `Round ${detail.game.current_round} of ${detail.game.total_rounds}`}
          </p>
          {!isActive && <p className="text-xs text-paper/40">Scores stay editable -- fix anything, any time.</p>}
          {detail.game.layout_variant && (
            <p className="text-xs text-paper/40">
              Layout {detail.game.layout_variant} · change it from "Game configuration" above
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {me && opponent && (
            <button
              type="button"
              onClick={() => setConfigSheetOpen(true)}
              className="text-xs whitespace-nowrap text-paper/50 underline"
            >
              Game configuration
            </button>
          )}
          <Link to={`/game/${detail.game.id}/summary`} className="text-xs whitespace-nowrap text-paper/50 underline">
            Summary
          </Link>
          <span className={`flex items-center gap-1.5 text-xs ${opponentOnline ? 'text-green-400' : 'text-paper/40'}`}>
            <span className={`h-2 w-2 rounded-full ${opponentOnline ? 'bg-green-400' : 'bg-paper/30'}`} />
            opponent {opponentOnline ? 'online' : 'offline'}
          </span>
        </div>
      </div>

      <Stepper total={detail.game.total_rounds} current={viewRound} onChange={setViewRound} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {orderedPlayers.map((entry) => (
          <div key={entry.player.id} className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-center">
              <p className="font-semibold text-paper">
                {playerLabel(entry, `Seat ${entry.player.seat}`)}
                {entry.player.user_id === user.id && <span className="ml-1 text-xs text-gold">(you)</span>}
                {!entry.player.user_id && <span className="ml-1 text-xs text-paper/40">(not joined)</span>}
              </p>
              <p className="text-xs text-paper/50">
                {entry.factionName ?? 'No faction'}
                {entry.player.army_name ? ` · ${entry.player.army_name}` : ''}
              </p>
              {(entry.player.role || entry.player.turn_order) && (
                <p className="text-[11px] tracking-wide text-paper/40 capitalize">
                  {entry.player.role}
                  {entry.player.role && entry.player.turn_order ? ' · ' : ''}
                  {entry.player.turn_order && `went ${entry.player.turn_order}`}
                </p>
              )}
              {missionByPlayerId.get(entry.player.id)?.name && (
                <p className="mt-1 text-xs text-paper/60">{missionByPlayerId.get(entry.player.id)?.name}</p>
              )}
              {(entry.player.user_id === user.id || !entry.player.user_id) && (
                <button
                  type="button"
                  onClick={() => setEditingPlayerId(entry.player.id)}
                  className="mt-1 text-[11px] text-paper/40 underline hover:text-paper"
                >
                  {entry.player.user_id === user.id ? 'Edit your setup' : "Edit this seat's setup"}
                </button>
              )}
            </div>

            <PrimaryScorePanel
              gameId={detail.game.id}
              gamePlayerId={entry.player.id}
              battleRound={viewRound}
              currentRoundVp={getRoundScore(entry.player.id)}
              maxPrimary={missionByPlayerId.get(entry.player.id)?.max_primary_vp ?? defaultMaxPrimary}
              lines={linesByPlayerId.get(entry.player.id) ?? []}
              ticks={detail.primaryTicks}
              userId={user.id}
            />

            <SecondaryScores
              gameId={detail.game.id}
              gamePlayerId={entry.player.id}
              round={viewRound}
              scores={detail.secondaryScores}
              draws={detail.secondaryDraws}
              available={(secondaries.data ?? []).filter((s) => !entry.player.role || s.role === entry.player.role)}
              lines={secondaryLines.data ?? []}
              ticks={detail.secondaryTicks}
              userId={user.id}
              editable
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {isActive && isViewingCurrent && (detail.game.current_round > 1 || !isLastRound) && (
          <div className="flex gap-2">
            {detail.game.current_round > 1 && (
              <Button variant="secondary" className="flex-1" onClick={goBackRound}>
                Back to round {detail.game.current_round - 1}
              </Button>
            )}
            {!isLastRound && (
              <Button variant="secondary" className="flex-1" onClick={advanceRound}>
                Advance to round {detail.game.current_round + 1}
              </Button>
            )}
          </div>
        )}
        <Button variant="danger" onClick={() => setEndSheetOpen(true)}>
          {isActive ? 'End game' : 'Change result'}
        </Button>
      </div>

      {/* Running totals -- always visible without scrolling, per the design brief. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          {orderedPlayers.map((entry) => (
            <div key={entry.player.id} className="flex-1 text-center">
              <p className="truncate text-xs text-paper/50">{playerLabel(entry, `Seat ${entry.player.seat}`)}</p>
              <p className="text-2xl font-bold text-gold">{entry.totalVp}</p>
              <p className="text-[11px] text-paper/40">
                {entry.primaryTotal} primary + {entry.secondaryTotal} secondary
              </p>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={endSheetOpen} onClose={() => setEndSheetOpen(false)} title={isActive ? 'End game' : 'Change result'}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-paper/60">
            {playerLabel(p1, 'Seat 1')}: {p1?.totalVp ?? 0} · {playerLabel(p2, 'Seat 2')}: {p2?.totalVp ?? 0}
          </p>
          <Button onClick={() => endGame(suggestedOutcome)} disabled={finishGame.isPending}>
            {suggestedOutcome === 'draw'
              ? 'Confirm draw'
              : `Confirm ${suggestedOutcome === 'seat_1' ? playerLabel(p1, 'Seat 1') : playerLabel(p2, 'Seat 2')} wins`}
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={() => endGame('seat_1')} disabled={finishGame.isPending}>
              {playerLabel(p1, 'Seat 1')} wins
            </Button>
            <Button variant="secondary" onClick={() => endGame('draw')} disabled={finishGame.isPending}>
              Draw
            </Button>
            <Button variant="secondary" onClick={() => endGame('seat_2')} disabled={finishGame.isPending}>
              {playerLabel(p2, 'Seat 2')} wins
            </Button>
          </div>
          <Button variant="ghost" className="text-red-300" onClick={abandon} disabled={abandonGame.isPending}>
            Abandon game (no result / opponent had to leave)
          </Button>
          <p className="text-center text-xs text-paper/40">
            You can come back and change this later -- nothing here is final.
          </p>
          <button
            type="button"
            onClick={() => {
              setEndSheetOpen(false)
              setCancelSheetOpen(true)
            }}
            className="text-center text-xs text-paper/30 underline hover:text-red-400"
          >
            Or cancel this game entirely, removing it completely
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={cancelSheetOpen}
        onClose={() => setCancelSheetOpen(false)}
        onConfirm={async () => {
          try {
            await deleteGame.mutateAsync(detail.game.id)
            navigate('/home')
          } catch {
            // error already surfaced via toast in useDeleteGame; keep the sheet open to retry
          }
        }}
        title="Cancel this game?"
        message="This removes it completely for both players -- scores, setup, everything. This can't be undone. If you just want to stop playing, Abandon keeps a record instead."
        confirmLabel="Cancel game"
        pending={deleteGame.isPending}
      />

      {editingPlayerId &&
        (() => {
          const editing = detail.players.find((p) => p.player.id === editingPlayerId)
          if (!editing) return null
          return (
            <Sheet
              open
              onClose={() => setEditingPlayerId(null)}
              title={editing.player.user_id === user.id ? 'Your setup' : "This seat's setup"}
            >
              <PlayerSetupFields
                me={editing}
                factions={factions.data ?? []}
                forceDispositions={forceDispositions.data ?? []}
                onUpdateSetup={(patch) => updateSetup.mutate({ gamePlayerId: editing.player.id, ...patch })}
                ladderId={detail.game.ladder_id}
              />
            </Sheet>
          )
        })()}

      {me && opponent && (
        <Sheet open={configSheetOpen} onClose={() => setConfigSheetOpen(false)} title="Game configuration">
          <GameConfigPicker
            me={me}
            opponent={opponent}
            layoutMission={p1Mission.data ?? p2Mission.data}
            layoutVariant={detail.game.layout_variant}
            onSetLayoutVariant={(variant) => setLayoutVariant.mutate(variant)}
            onSetRole={(role) =>
              setMirroredField(
                (id, v) => setRole.mutateAsync({ gamePlayerId: id, role: v }),
                user.id,
                me,
                opponent,
                role,
                (r) => (r === 'attacker' ? 'defender' : 'attacker'),
              )
            }
            onSetTurnOrder={(turnOrder) =>
              setMirroredField(
                (id, v) => setTurnOrder.mutateAsync({ gamePlayerId: id, turnOrder: v }),
                user.id,
                me,
                opponent,
                turnOrder,
                (t) => (t === 'first' ? 'second' : 'first'),
              )
            }
          />
        </Sheet>
      )}
    </div>
  )
}

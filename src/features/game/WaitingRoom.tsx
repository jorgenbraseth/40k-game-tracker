import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { useAuth } from '@/features/auth/AuthProvider'
import type { GameDetail } from '@/lib/queries/games'
import {
  playerLabel,
  setMirroredField,
  useDeleteGame,
  useSetLayoutVariant,
  useSetRole,
  useSetTurnOrder,
  useStartGame,
  useUpdatePlayerSetup,
} from '@/lib/queries/games'
import { useFactions, useForceDispositions, useMission } from '@/lib/queries/referenceData'
import { GameConfigPicker } from './GameConfigPicker'
import { PlayerSetupFields } from './PlayerSetupFields'

export function WaitingRoom({ detail, opponentOnline }: { detail: GameDetail; opponentOnline: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const factions = useFactions()
  const forceDispositions = useForceDispositions()
  const setRole = useSetRole(detail.game.id)
  const setTurnOrder = useSetTurnOrder(detail.game.id)
  const updateSetup = useUpdatePlayerSetup(detail.game.id)
  const startGame = useStartGame(detail.game.id)
  const setLayoutVariant = useSetLayoutVariant(detail.game.id)
  const deleteGame = useDeleteGame()
  const [copied, setCopied] = useState(false)
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false)

  const me = detail.players.find((p) => p.player.user_id === user?.id)
  const opponent = detail.players.find((p) => p.player.user_id !== user?.id)
  const missionResolved = detail.players.length === 2 && detail.players.every((p) => p.player.mission_id)
  const bothFactionsSet = detail.players.length === 2 && detail.players.every((p) => p.player.faction_id)
  const layoutChosen = Boolean(detail.game.layout_variant)
  const bothRolesAssigned = detail.players.length === 2 && detail.players.every((p) => p.player.role)
  const bothTurnOrderSet = detail.players.length === 2 && detail.players.every((p) => p.player.turn_order)
  const canStart = missionResolved && bothFactionsSet && layoutChosen && bothRolesAssigned && bothTurnOrderSet

  const myMission = useMission(me?.player.mission_id ?? undefined)
  const opponentMission = useMission(opponent?.player.mission_id ?? undefined)

  // Mirrors the setup form's own order: who this seat is, then the game
  // configuration. Army name is the only field that never gates this.
  const startBlockedReason = !missionResolved
    ? 'Waiting on both Force Dispositions to reveal the mission'
    : !bothFactionsSet
      ? 'Both players need to pick a faction'
      : !layoutChosen
        ? 'Pick a terrain layout below'
        : !bothRolesAssigned
          ? 'Both players need to claim Attacker or Defender'
          : !bothTurnOrderSet
            ? 'Both players need to say who went first'
            : null

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(detail.game.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard can be denied; the code is visible on screen regardless
    }
  }

  if (!me || !user) return null

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <p className="text-sm font-medium text-paper/60">Share this code with your opponent</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="rounded-xl bg-gold/10 px-6 py-3 text-4xl font-bold tracking-[0.3em] text-gold">
            {detail.game.join_code}
          </span>
        </div>
        <button type="button" onClick={copyCode} className="mt-2 text-sm text-paper/50 underline">
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
        <p className="mb-1 text-sm font-semibold text-paper/60 uppercase">Primary missions</p>
        {missionResolved ? (
          <div className="flex flex-col gap-2">
            <p>
              <span className="text-xs text-paper/50">You: </span>
              <span className="text-lg font-semibold text-gold">{myMission.data?.name ?? '…'}</span>
            </p>
            <p>
              <span className="text-xs text-paper/50">Opponent: </span>
              <span className="text-lg font-semibold text-gold">{opponentMission.data?.name ?? '…'}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-paper/50">
            Revealed once both players have picked a Force Disposition -- each of you gets your own mission,
            based on your opponent's choice
          </p>
        )}
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
        <p className="mb-3 text-sm font-semibold text-paper/60 uppercase">Your setup</p>
        <div className="flex flex-col gap-3">
          <PlayerSetupFields
            me={me}
            factions={factions.data ?? []}
            forceDispositions={forceDispositions.data ?? []}
            onUpdateSetup={(patch) => updateSetup.mutate({ gamePlayerId: me.player.id, ...patch })}
            layoutMission={myMission.data ?? opponentMission.data}
            layoutVariant={detail.game.layout_variant}
            onSetLayoutVariant={(variant) => setLayoutVariant.mutate(variant)}
          />

          <p className="text-center text-xs text-paper/40">
            Picked something wrong? All of this stays editable after the game starts too.
          </p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
        <p className="mb-2 text-sm font-semibold text-paper/60 uppercase">Player 2</p>
        {opponent && !opponent.player.user_id ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-paper/50">
              Nobody's joined yet -- you can bookkeep for them by filling in their setup yourself (handy when they'd
              rather not deal with an account), or share the code above and let them join and take it over.
            </p>
            <PlayerSetupFields
              me={opponent}
              factions={factions.data ?? []}
              forceDispositions={forceDispositions.data ?? []}
              onUpdateSetup={(patch) => updateSetup.mutate({ gamePlayerId: opponent.player.id, ...patch })}
              ladderId={detail.game.ladder_id}
            />
          </div>
        ) : opponent ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-paper">{playerLabel(opponent, 'Player 2')}</p>
              <p className="text-sm text-paper/50">
                {opponent.factionName ?? 'No faction yet'}
                {opponent.forceDispositionName ? ` · ${opponent.forceDispositionName}` : ''}
                {opponent.player.role ? ` · ${opponent.player.role}` : ''}
                {opponent.player.turn_order ? ` · went ${opponent.player.turn_order}` : ''}
              </p>
            </div>
            <span
              className={`flex items-center gap-1.5 text-xs ${opponentOnline ? 'text-green-400' : 'text-paper/40'}`}
            >
              <span className={`h-2 w-2 rounded-full ${opponentOnline ? 'bg-green-400' : 'bg-paper/30'}`} />
              {opponentOnline ? 'online' : 'offline'}
            </span>
          </div>
        ) : (
          <p className="text-sm text-paper/50">Waiting for someone to join with the code above…</p>
        )}
      </div>

      {opponent && (
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
          <p className="mb-3 text-sm font-semibold text-paper/60 uppercase">Game configuration</p>
          <GameConfigPicker
            me={me}
            opponent={opponent}
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
        </div>
      )}

      <div className="flex w-full max-w-sm flex-col gap-2">
        <Button disabled={!canStart || startGame.isPending} onClick={() => startGame.mutate()} fullWidth>
          {canStart ? (startGame.isPending ? 'Starting…' : 'Start game') : startBlockedReason}
        </Button>
        {!opponent?.player.user_id && (
          <p className="text-center text-xs text-paper/40">
            Nobody's claimed Player 2 -- that's fine, you can enter both sides' scores as bookkeeper once the game
            starts.
          </p>
        )}
        <button
          type="button"
          onClick={() => setCancelSheetOpen(true)}
          className="mt-2 text-center text-xs text-paper/40 underline hover:text-red-400"
        >
          Cancel this game
        </button>
      </div>

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
        message={
          opponent?.player.user_id
            ? "This removes it completely for both players -- scores, setup, everything. This can't be undone."
            : "This removes it completely. This can't be undone."
        }
        confirmLabel="Cancel game"
        pending={deleteGame.isPending}
      />
    </div>
  )
}

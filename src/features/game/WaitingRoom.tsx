import { useState } from 'react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/AuthProvider'
import type { GameDetail } from '@/lib/queries/games'
import { useSetReady, useSetRole, useStartGame, useUpdatePlayerSetup } from '@/lib/queries/games'
import { useFactions, useForceDispositions, useMission } from '@/lib/queries/referenceData'

export function WaitingRoom({ detail, opponentOnline }: { detail: GameDetail; opponentOnline: boolean }) {
  const { user } = useAuth()
  const factions = useFactions()
  const forceDispositions = useForceDispositions()
  const setReady = useSetReady(detail.game.id)
  const setRole = useSetRole(detail.game.id)
  const updateSetup = useUpdatePlayerSetup(detail.game.id)
  const startGame = useStartGame(detail.game.id)
  const [copied, setCopied] = useState(false)

  const me = detail.players.find((p) => p.player.user_id === user?.id)
  const opponent = detail.players.find((p) => p.player.user_id !== user?.id)
  const bothReady = detail.players.length === 2 && detail.players.every((p) => p.player.is_ready)
  const bothRolesAssigned = detail.players.length === 2 && detail.players.every((p) => p.player.role)
  const missionResolved = detail.players.length === 2 && detail.players.every((p) => p.player.mission_id)
  const canStart = bothReady && bothRolesAssigned && missionResolved

  const myMission = useMission(me?.player.mission_id ?? undefined)
  const opponentMission = useMission(opponent?.player.mission_id ?? undefined)

  const startBlockedReason = !missionResolved
    ? 'Waiting on both Force Dispositions to reveal the mission'
    : !bothRolesAssigned
      ? 'Both players need to claim Attacker or Defender'
      : !bothReady
        ? 'Waiting for both players to be ready'
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

  if (!me) return null

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
          <Select
            label="Force Disposition"
            value={me.player.force_disposition_id ?? ''}
            onChange={(e) =>
              updateSetup.mutate({ gamePlayerId: me.player.id, forceDispositionId: e.target.value || null })
            }
          >
            <option value="">Pick Force Disposition</option>
            {forceDispositions.data?.map((fd) => (
              <option key={fd.id} value={fd.id}>
                {fd.name}
              </option>
            ))}
          </Select>

          <Select
            label="Faction"
            value={me.player.faction_id ?? ''}
            onChange={(e) => updateSetup.mutate({ gamePlayerId: me.player.id, factionId: e.target.value || null })}
          >
            <option value="">Pick faction</option>
            {factions.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <TextField
            label="Army name"
            defaultValue={me.player.army_name ?? ''}
            onBlur={(e) => updateSetup.mutate({ gamePlayerId: me.player.id, armyName: e.target.value || null })}
          />

          <div>
            <p className="mb-1.5 text-sm font-medium text-paper/80">Role</p>
            <div className="grid grid-cols-2 gap-2">
              {(['attacker', 'defender'] as const).map((role) => {
                const takenByOpponent = opponent?.player.role === role
                const mine = me.player.role === role
                return (
                  <Button
                    key={role}
                    type="button"
                    variant={mine ? 'primary' : 'secondary'}
                    disabled={takenByOpponent && !mine}
                    onClick={() => setRole.mutate({ gamePlayerId: me.player.id, role: mine ? null : role })}
                    className="capitalize"
                  >
                    {role}
                    {takenByOpponent && !mine ? ' (taken)' : ''}
                  </Button>
                )
              })}
            </div>
          </div>

          <Button
            variant={me.player.is_ready ? 'secondary' : 'primary'}
            onClick={() => setReady.mutate({ gamePlayerId: me.player.id, isReady: !me.player.is_ready })}
          >
            {me.player.is_ready ? 'Ready ✓ (tap to undo)' : "I'm ready"}
          </Button>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
        <p className="mb-2 text-sm font-semibold text-paper/60 uppercase">Opponent</p>
        {opponent ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-paper">{opponent.profile?.display_name ?? 'Player 2'}</p>
              <p className="text-sm text-paper/50">
                {opponent.factionName ?? 'No faction yet'}
                {opponent.forceDispositionName ? ` · ${opponent.forceDispositionName}` : ''}
                {opponent.player.role ? ` · ${opponent.player.role}` : ''}
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
        {opponent && (
          <p className="mt-2 text-sm text-paper/50">{opponent.player.is_ready ? 'Ready ✓' : 'Not ready yet'}</p>
        )}
      </div>

      <Button disabled={!canStart || startGame.isPending} onClick={() => startGame.mutate()} fullWidth>
        {canStart ? (startGame.isPending ? 'Starting…' : 'Start game') : startBlockedReason}
      </Button>
    </div>
  )
}

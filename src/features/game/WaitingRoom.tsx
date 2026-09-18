import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { useAuth } from '@/features/auth/AuthProvider'
import type { GameDetail } from '@/lib/queries/games'
import {
  playerLabel,
  playerUserId,
  useDeleteGame,
  useSetGameGroupings,
  useSetLayoutVariant,
  useSetRole,
  useSetTurnOrder,
  useStartGame,
  useUpdatePlayerSetup,
} from '@/lib/queries/games'
import { useLadders } from '@/lib/queries/ladders'
import { useFactions, useForceDispositions, useMission, useMissionsForPack } from '@/lib/queries/referenceData'
import { useTournaments } from '@/lib/queries/tournaments'
import { GameConfigPicker } from './GameConfigPicker'
import { PlayerSetupFields } from './PlayerSetupFields'

export function WaitingRoom({
  detail,
  opponentOnline,
  isParticipant,
}: {
  detail: GameDetail
  opponentOnline: boolean
  /** False for a spectator (any signed-in user other than this game's two seats, see
   * GamePage) -- everything below stays visible, nothing stays clickable. */
  isParticipant: boolean
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const factions = useFactions()
  const forceDispositions = useForceDispositions()
  const setRole = useSetRole(detail.game.id)
  const setTurnOrder = useSetTurnOrder(detail.game.id)
  const missionsForPack = useMissionsForPack(detail.game.mission_pack_id)
  const updateSetup = useUpdatePlayerSetup(detail.game.id, missionsForPack.data)
  const startGame = useStartGame(detail.game.id)
  const setLayoutVariant = useSetLayoutVariant(detail.game.id)
  const setGroupings = useSetGameGroupings(detail.game.id)
  const ladders = useLadders(user?.id)
  const tournaments = useTournaments(user?.id)
  const deleteGame = useDeleteGame()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false)

  const me = detail.players.find((p) => p.player.user_id === user?.id)
  const opponent = detail.players.find((p) => p.player.user_id !== user?.id)
  const ladderOptions = (ladders.data ?? [])
    .filter((l) => (l.isMember && !l.archivedAt) || detail.ladderIds.includes(l.id))
    .map((l) => ({ id: l.id, name: l.name }))
  const tournamentOptions = (tournaments.data ?? [])
    .filter((t) => (t.isMember && !t.archivedAt) || detail.tournamentIds.includes(t.id))
    .map((t) => ({ id: t.id, name: t.name }))
  const missionResolved = detail.players.length === 2 && detail.players.every((p) => p.player.mission_id)
  const bothFactionsSet = detail.players.length === 2 && detail.players.every((p) => p.player.faction_id)
  const layoutChosen = Boolean(detail.game.layout_variant)
  const bothRolesAssigned = detail.players.length === 2 && detail.players.every((p) => p.player.role)
  const bothTurnOrderSet = detail.players.length === 2 && detail.players.every((p) => p.player.turn_order)
  const bothSecondaryModesSet = detail.players.length === 2 && detail.players.every((p) => p.player.secondary_mode)
  const canStart =
    missionResolved && bothFactionsSet && layoutChosen && bothRolesAssigned && bothTurnOrderSet && bothSecondaryModesSet

  const myMission = useMission(me?.player.mission_id ?? undefined)
  const opponentMission = useMission(opponent?.player.mission_id ?? undefined)
  const [p1, p2] = detail.players
  const p1Mission = useMission(p1?.player.mission_id ?? undefined)
  const p2Mission = useMission(p2?.player.mission_id ?? undefined)
  const missionByPlayerId = new Map([
    [p1?.player.id, p1Mission.data],
    [p2?.player.id, p2Mission.data],
  ])
  const attackerEntry = detail.players.find((p) => p.player.role === 'attacker')
  const wentFirstEntry = detail.players.find((p) => p.player.turn_order === 'first')

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
            : !bothSecondaryModesSet
              ? 'Both players need to pick Fixed or Tactical secondaries'
              : null

  const copy = async (kind: 'code' | 'link') => {
    const text =
      kind === 'code' ? detail.game.join_code : `${window.location.origin}/game/join/${detail.game.join_code}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // clipboard can be denied; the code is visible on screen regardless
    }
  }

  if (!user) return null

  if (!isParticipant) {
    return (
      <div className="flex flex-col items-center gap-8 text-center">
        <p className="rounded-full bg-veil-strong px-3 py-1 text-xs font-medium text-paper/60">Spectating</p>

        <div className="w-full max-w-sm rounded-2xl border border-veil-strong bg-veil p-5 text-center">
          <p className="mb-1 text-sm font-semibold text-paper/60 uppercase">Primary missions</p>
          {missionResolved ? (
            <div className="flex flex-col gap-2">
              {detail.players.map((entry) => (
                <p key={entry.player.id}>
                  <span className="text-xs text-paper/50">
                    <PlayerNameLink
                      userId={playerUserId(entry)}
                      name={playerLabel(entry, `Seat ${entry.player.seat}`)}
                    />
                    :{' '}
                  </span>
                  <span className="text-lg font-semibold text-gold">
                    {missionByPlayerId.get(entry.player.id)?.name ?? '…'}
                  </span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-paper/50">
              Revealed once both players have picked a Force Disposition -- each gets their own mission, based on
              their opponent's choice.
            </p>
          )}
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          {detail.players.map((entry) => (
            <div key={entry.player.id} className="rounded-2xl border border-veil-strong bg-veil p-5 text-left">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-paper">
                  <PlayerNameLink userId={playerUserId(entry)} name={playerLabel(entry, `Seat ${entry.player.seat}`)} />
                  {!entry.player.user_id && <span className="ml-1 text-xs text-paper/40">(not joined)</span>}
                </p>
                {entry.player.user_id && (
                  <span
                    className={`flex items-center gap-1.5 text-xs ${opponentOnline ? 'text-success' : 'text-paper/40'}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${opponentOnline ? 'bg-success' : 'bg-paper/30'}`} />
                    {opponentOnline ? 'online' : 'offline'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-paper/50">
                {entry.factionName ?? 'No faction yet'}
                {entry.forceDispositionName ? ` · ${entry.forceDispositionName}` : ''}
                {entry.player.army_name ? ` · ${entry.player.army_name}` : ''}
              </p>
              {entry.player.secondary_mode && (
                <p className="mt-0.5 text-xs text-paper/40 capitalize">{entry.player.secondary_mode} secondaries</p>
              )}
            </div>
          ))}
        </div>

        {detail.players.length === 2 && (
          <div className="w-full max-w-sm rounded-2xl border border-veil-strong bg-veil p-5 text-left">
            <p className="mb-3 text-sm font-semibold text-paper/60 uppercase">Game configuration</p>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-paper/50">Ladders / tournaments</dt>
                <dd className="text-paper">
                  {detail.ladderIds.length + detail.tournamentIds.length > 0
                    ? `Tagged to ${detail.ladderIds.length + detail.tournamentIds.length}`
                    : 'Not tagged'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-paper/50">Terrain layout</dt>
                <dd className="text-paper">
                  {detail.game.layout_variant ? `Layout ${detail.game.layout_variant}` : 'Not picked yet'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-paper/50">Attacker</dt>
                <dd className="text-paper">
                  {attackerEntry ? (
                    <PlayerNameLink
                      userId={playerUserId(attackerEntry)}
                      name={playerLabel(attackerEntry, `Seat ${attackerEntry.player.seat}`)}
                    />
                  ) : (
                    'Not decided yet'
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-paper/50">Went first</dt>
                <dd className="text-paper">
                  {wentFirstEntry ? (
                    <PlayerNameLink
                      userId={playerUserId(wentFirstEntry)}
                      name={playerLabel(wentFirstEntry, `Seat ${wentFirstEntry.player.seat}`)}
                    />
                  ) : (
                    'Not decided yet'
                  )}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    )
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
        <div className="mt-2 flex items-center justify-center gap-3">
          <button type="button" onClick={() => copy('code')} className="text-sm text-paper/50 underline">
            {copied === 'code' ? 'Copied!' : 'Copy code'}
          </button>
          <button type="button" onClick={() => copy('link')} className="text-sm text-paper/50 underline">
            {copied === 'link' ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-veil-strong bg-veil p-5 text-center">
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

      <div className="w-full max-w-sm rounded-2xl border border-veil-strong bg-veil p-5 text-left">
        <p className="mb-3 text-sm font-semibold text-paper/60 uppercase">Your setup</p>
        <div className="flex flex-col gap-3">
          <PlayerSetupFields
            me={me}
            factions={factions.data ?? []}
            forceDispositions={forceDispositions.data ?? []}
            onUpdateSetup={(patch) => updateSetup.mutate({ gamePlayerId: me.player.id, ...patch })}
          />

          <p className="text-center text-xs text-paper/40">
            Picked something wrong? All of this stays editable after the game starts too.
          </p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-veil-strong bg-veil p-5 text-left">
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
              ladderId={detail.ladderIds[0] ?? null}
            />
          </div>
        ) : opponent ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-paper">
                <PlayerNameLink userId={playerUserId(opponent)} name={playerLabel(opponent, 'Player 2')} />
              </p>
              <p className="text-sm text-paper/50">
                {opponent.factionName ?? 'No faction yet'}
                {opponent.forceDispositionName ? ` · ${opponent.forceDispositionName}` : ''}
                {opponent.player.role ? ` · ${opponent.player.role}` : ''}
                {opponent.player.turn_order ? ` · went ${opponent.player.turn_order}` : ''}
              </p>
            </div>
            <span
              className={`flex items-center gap-1.5 text-xs ${opponentOnline ? 'text-success' : 'text-paper/40'}`}
            >
              <span className={`h-2 w-2 rounded-full ${opponentOnline ? 'bg-success' : 'bg-paper/30'}`} />
              {opponentOnline ? 'online' : 'offline'}
            </span>
          </div>
        ) : (
          <p className="text-sm text-paper/50">Waiting for someone to join with the code above…</p>
        )}
      </div>

      {opponent && (
        <div className="w-full max-w-sm rounded-2xl border border-veil-strong bg-veil p-5 text-left">
          <p className="mb-3 text-sm font-semibold text-paper/60 uppercase">Game configuration</p>
          <GameConfigPicker
            me={me}
            opponent={opponent}
            layoutMission={myMission.data ?? opponentMission.data}
            layoutVariant={detail.game.layout_variant}
            onSetLayoutVariant={(variant) => setLayoutVariant.mutate(variant)}
            ladderIds={detail.ladderIds}
            tournamentIds={detail.tournamentIds}
            ladderOptions={ladderOptions}
            tournamentOptions={tournamentOptions}
            onSetGroupings={(next) => setGroupings.mutate(next)}
            onSetRole={(role) =>
              setRole.mutate(role === 'attacker' ? me.player.id : role === 'defender' ? opponent.player.id : null)
            }
            onSetTurnOrder={(turnOrder) =>
              setTurnOrder.mutate(turnOrder === 'first' ? me.player.id : turnOrder === 'second' ? opponent.player.id : null)
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
          className="mt-2 text-center text-xs text-paper/40 underline hover:text-danger"
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

import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { GameLockBanner } from '@/components/GameLockBanner'
import { Sheet } from '@/components/Sheet'
import { Spinner } from '@/components/Feedback'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { RoundNav } from '@/components/RoundNav'
import { useAuth } from '@/features/auth/AuthProvider'
import { clsx } from '@/lib/clsx'
import type { GameDetail } from '@/lib/queries/games'
import {
  isGameLocked,
  playerLabel,
  playerUserId,
  remainingCp,
  useAbandonGame,
  useDeleteGame,
  useFinishGame,
  useSetCurrentRound,
  useSetGameLadders,
  useSetLayoutVariant,
  useSetPaintedBonus,
  useSetRole,
  useSetTurnOrder,
  useUpdatePlayerSetup,
} from '@/lib/queries/games'
import { useLadders } from '@/lib/queries/ladders'
import {
  useFactions,
  useForceDispositions,
  useMission,
  useMissionObjectiveLines,
  useMissionsForPack,
  useSecondaryObjectiveLines,
  useSecondaryObjectives,
} from '@/lib/queries/referenceData'
import { useWakeLock } from '@/lib/useWakeLock'
import { CommandPointsPanel } from './CommandPointsPanel'
import { GameConfigPicker } from './GameConfigPicker'
import { PlayerSetupFields } from './PlayerSetupFields'
import { PrimaryScorePanel } from './PrimaryScorePanel'
import { SecondaryScores } from './SecondaryScores'

export function Scoreboard({
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
  const [p1, p2] = detail.players
  const p1Mission = useMission(p1?.player.mission_id ?? undefined)
  const p2Mission = useMission(p2?.player.mission_id ?? undefined)
  const p1Lines = useMissionObjectiveLines(p1?.player.mission_id ?? undefined)
  const p2Lines = useMissionObjectiveLines(p2?.player.mission_id ?? undefined)
  const secondaries = useSecondaryObjectives(detail.game.mission_pack_id)
  const secondaryLines = useSecondaryObjectiveLines(secondaries.data?.map((s) => s.id))
  const factions = useFactions()
  const forceDispositions = useForceDispositions()
  const missionsForPack = useMissionsForPack(detail.game.mission_pack_id)
  const setCurrentRound = useSetCurrentRound(detail.game.id)
  const setLayoutVariant = useSetLayoutVariant(detail.game.id)
  const setLadders = useSetGameLadders(detail.game.id)
  const ladders = useLadders(user?.id)
  const setPaintedBonus = useSetPaintedBonus(detail.game.id)
  const finishGame = useFinishGame(detail.game.id)
  const abandonGame = useAbandonGame(detail.game.id)
  const deleteGame = useDeleteGame()
  const updateSetup = useUpdatePlayerSetup(detail.game.id, missionsForPack.data)
  const setRole = useSetRole(detail.game.id)
  const setTurnOrder = useSetTurnOrder(detail.game.id)

  const [searchParams, setSearchParams] = useSearchParams()
  const [endSheetOpen, setEndSheetOpen] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false)
  const [configSheetOpen, setConfigSheetOpen] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)

  useWakeLock(detail.game.status === 'active')

  // Publishes the sticky round header's height as --round-header-height on the Scoreboard's root,
  // so each player card's name bar can pin itself flush underneath it. A callback ref rather than
  // an effect, since the header only mounts once mission data has loaded (see the spinner below).
  const roundHeaderRef = useCallback((node: HTMLDivElement | null) => {
    const root = node?.parentElement
    if (!node || !root) return
    const update = () => root.style.setProperty('--round-header-height', `${node.offsetHeight}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

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
  // One pseudo-round past the last real battle round, for scoring that's only checked at the
  // very end of the game ("End of the Battle" in mission_objective_lines) and the painted-army
  // bonus -- same round_scores/primary_objective_ticks machinery as a real round (see the
  // 20260312000000 migration), just a round number no mission ever uses for its own windows.
  const endOfGameRound = detail.game.total_rounds + 1

  // Which round is being viewed lives in the URL (?round=N), not local state -- bookmarkable,
  // shareable, and back/forward moves between rounds, per this app's general rule that in-page
  // view state (as opposed to a modal/sheet's open/closed-ness) belongs in the URL. Falls back to
  // the game's actual current round when the URL doesn't pin one (a plain link to the game, or an
  // out-of-range leftover from a shorter game) -- that fallback is deliberately never written
  // back into the URL itself, so just opening the game doesn't pre-pin a round that keeps advancing.
  const requestedRound = Number(searchParams.get('round'))
  const viewRound =
    Number.isInteger(requestedRound) && requestedRound >= 1 && requestedRound <= endOfGameRound
      ? requestedRound
      : detail.game.current_round
  const setViewRound = (round: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('round', String(round))
      return next
    })
  }

  const isActive = detail.game.status === 'active'
  const locked = isGameLocked(detail.players, detail.verifications)

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
  // of seat number -- same convention WaitingRoom uses, so "You" always means the right seat. A
  // spectator has no seat of their own, so this falls back to plain seat order -- GameConfigPicker
  // renders identically either way (see its own doc comment), just non-interactively (disabled
  // below) and with real names instead of a "You" that wouldn't mean anything to a spectator.
  const myPlayer = detail.players.find((p) => p.player.user_id === user.id)
  const me = myPlayer ?? p1
  const opponent = myPlayer ? detail.players.find((p) => p.player.id !== myPlayer.player.id) : p2
  const ladderOptions = (ladders.data ?? [])
    .filter((l) => (l.isMember && !l.archivedAt) || detail.ladderIds.includes(l.id))
    .map((l) => ({ id: l.id, name: l.name }))

  const getRoundScore = (gamePlayerId: string) =>
    detail.roundScores.find((r) => r.game_player_id === gamePlayerId && r.battle_round === viewRound)?.primary_vp ?? 0

  const getCommandPoints = (gamePlayerId: string) =>
    detail.commandPoints.find((cp) => cp.game_player_id === gamePlayerId && cp.battle_round === viewRound)

  // The header's previous/next is the only round control. Stepping *past* the game's own
  // current round (while it's still being played) is what advancing the game means, so that also
  // moves games.current_round forward -- the round both players' devices open on. Going back, or
  // forward through rounds already reached, only changes what this viewer is looking at: revisiting
  // an earlier round to fix a score shouldn't rewind the game for the other player.
  const changeRound = (round: number) => {
    const next = Math.max(1, Math.min(endOfGameRound, round))
    if (isParticipant && isActive && next > detail.game.current_round) setCurrentRound.mutate(next)
    setViewRound(next)
  }

  // Each seat gets its own faint tint -- on its card and its half of the sticky header -- so it's
  // obvious whose scores are on screen even once the card's name has scrolled out of view. Keyed
  // to seat, not screen position, so it doesn't swap when turn order reorders the cards. Seat 1
  // takes the theme's own accent (blood); seat 2 stays a plain neutral wash rather than the
  // theme's steel, which in the blue-accented themes sits too close to blood to tell apart.
  const seatBg = (seat: number) => (seat === 1 ? 'bg-blood/20' : 'bg-paper/5')
  const seatTint = (seat: number) => clsx(seatBg(seat), seat === 1 ? 'border-blood/60' : 'border-paper/20')

  const canEditSetup = (entry: GameDetail['players'][number]) =>
    isParticipant && (entry.player.user_id === user.id || !entry.player.user_id)

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          {detail.game.status !== 'active' && (
            <p className="text-sm text-paper/50">
              {detail.game.status === 'complete' ? 'Game complete' : 'Game abandoned'}
            </p>
          )}
          {!isParticipant && <p className="text-xs text-paper/40">Spectating -- nothing here is yours to change.</p>}
          {!isActive && !locked && (
            <p className="text-xs text-paper/40">Scores stay editable -- fix anything, any time.</p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {isParticipant && (
            <span
              aria-label={opponentOnline ? 'opponent online' : 'opponent offline'}
              className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${opponentOnline ? 'bg-success' : 'bg-paper/30'}`}
            />
          )}
          <button
            type="button"
            onClick={() => setMoreSheetOpen(true)}
            aria-label="More"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-paper/60 hover:bg-veil-strong hover:text-paper"
          >
            ⋯
          </button>
        </div>
      </div>

      <GameLockBanner detail={detail} userId={user.id} />

      {/* Running totals and the round control, pinned under the app header -- always visible
          without scrolling, per the design brief, and doubling as a colour key for the cards below.
          top-[var(--app-header-height)] is published by Layout. */}
      <div
        ref={roundHeaderRef}
        className="sticky top-[var(--app-header-height,0px)] z-30 -mx-4 bg-ink px-4 py-2"
      >
        <div className="flex items-stretch gap-2">
          {orderedPlayers.map((entry, index) => (
            <div
              key={entry.player.id}
              className={clsx(
                'min-w-0 flex-1 rounded-xl border px-2 py-1 text-center',
                seatTint(entry.player.seat),
                index === 0 ? 'order-first' : 'order-last',
              )}
            >
              <p className="truncate text-xs text-paper/70">{playerLabel(entry, `Seat ${entry.player.seat}`)}</p>
              <p className="text-2xl leading-tight font-bold text-gold">{entry.totalVp}</p>
              <p className="truncate text-[11px] text-paper/40">
                {entry.primaryTotal}+{entry.secondaryTotal} VP · {remainingCp(detail.commandPoints, entry.player.id)} CP
              </p>
            </div>
          ))}
          <div className="flex flex-shrink-0 items-center">
            <RoundNav
              round={viewRound}
              last={endOfGameRound}
              label={viewRound === endOfGameRound ? 'End' : `Round ${viewRound}`}
              sublabel={viewRound === endOfGameRound ? 'of game' : `of ${detail.game.total_rounds}`}
              onChange={changeRound}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {orderedPlayers.map((entry) => (
          // One frame per player, its contents stacked as full-width sections split by hairlines
          // rather than frames within the frame -- on a phone every nested border and its padding
          // eats width the checklists need.
          <div
            key={entry.player.id}
            className={clsx(
              'flex flex-col rounded-2xl border pb-3 [&>*+*]:pt-2.5 [&>*+*+*]:border-t [&>*+*+*]:border-veil-strong [&>*:not(:first-child,:last-child)]:pb-2.5',
              seatTint(entry.player.seat),
            )}
          >
            {/* Pins just under the sticky round header while this card is on screen, so whose card
                it is never scrolls out of view. bg-ink under the (translucent) tint keeps the
                scrolled content from showing through. */}
            <div className="sticky top-[calc(var(--app-header-height,0px)+var(--round-header-height,0px))] z-20 rounded-t-2xl border-b border-veil-strong bg-ink">
              <p
                className={clsx(
                  'rounded-t-2xl px-3 py-2 text-center font-semibold text-paper',
                  seatBg(entry.player.seat),
                )}
              >
                <PlayerNameLink userId={playerUserId(entry)} name={playerLabel(entry, `Seat ${entry.player.seat}`)} />
                {entry.player.user_id === user.id && <span className="ml-1 text-xs text-gold">(you)</span>}
              </p>
            </div>

            <PrimaryScorePanel
              gameId={detail.game.id}
              gamePlayerId={entry.player.id}
              battleRound={viewRound}
              endOfGameRound={endOfGameRound}
              currentRoundVp={getRoundScore(entry.player.id)}
              maxPrimary={missionByPlayerId.get(entry.player.id)?.max_primary_vp ?? defaultMaxPrimary}
              otherRoundsTotal={entry.primaryTotal - getRoundScore(entry.player.id)}
              lines={linesByPlayerId.get(entry.player.id) ?? []}
              ticks={detail.primaryTicks}
              userId={user.id}
              editable={isParticipant}
            />

            {viewRound === endOfGameRound ? (
              <p className="flex w-full items-center justify-between gap-2 px-3 text-sm text-paper/60">
                <span className="text-xs font-medium tracking-wide uppercase">CP</span>
                <span className="font-semibold text-gold">
                  {remainingCp(detail.commandPoints, entry.player.id)}
                  <span className="ml-1 text-xs font-normal text-paper/40">left</span>
                </span>
              </p>
            ) : (
              <CommandPointsPanel
                gameId={detail.game.id}
                gamePlayerId={entry.player.id}
                battleRound={viewRound}
                cpGained={getCommandPoints(entry.player.id)?.cp_gained ?? 0}
                cpSpent={getCommandPoints(entry.player.id)?.cp_spent ?? 0}
                remaining={remainingCp(detail.commandPoints, entry.player.id)}
                userId={user.id}
                editable={isParticipant}
              />
            )}

            {viewRound === endOfGameRound ? (
              isParticipant && (entry.player.user_id === user.id || !entry.player.user_id) ? (
                <label className="flex w-full items-center justify-between gap-2 px-3 text-sm">
                  <span className="text-paper/80">
                    Painted <span className="text-paper/40">(+10VP)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={entry.player.painted_bonus}
                    onChange={(e) =>
                      setPaintedBonus.mutate({ gamePlayerId: entry.player.id, paintedBonus: e.target.checked })
                    }
                    className="h-5 w-5 accent-gold"
                  />
                </label>
              ) : (
                // painted_bonus is a game_players column, so only the seat's own account (or an
                // unclaimed seat, above) can write it -- unlike round/secondary scores, which any
                // participant can enter for either side (see round_scores' RLS comment).
                <p className="flex w-full items-center justify-between gap-2 px-3 text-sm text-paper/60">
                  <span>
                    Painted <span className="text-paper/40">(+10VP)</span>
                  </span>
                  <span className="font-medium text-paper">{entry.player.painted_bonus ? 'Yes' : 'No'}</span>
                </p>
              )
            ) : (
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
                editable={isParticipant}
                playerMode={entry.player.secondary_mode}
              />
            )}
          </div>
        ))}
      </div>

      {isParticipant && (
        <Button variant="danger" onClick={() => setEndSheetOpen(true)}>
          {isActive ? 'End game' : 'Change result'}
        </Button>
      )}

      <Sheet open={endSheetOpen} onClose={() => setEndSheetOpen(false)} title={isActive ? 'End game' : 'Change result'}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-paper/60">
            <PlayerNameLink userId={playerUserId(p1)} name={playerLabel(p1, 'Seat 1')} />: {p1?.totalVp ?? 0} ·{' '}
            <PlayerNameLink userId={playerUserId(p2)} name={playerLabel(p2, 'Seat 2')} />: {p2?.totalVp ?? 0}
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
          <Button variant="ghost" className="text-danger" onClick={abandon} disabled={abandonGame.isPending}>
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
            className="text-center text-xs text-paper/30 underline hover:text-danger"
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
                ladderId={detail.ladderIds[0] ?? null}
              />
            </Sheet>
          )
        })()}

      <Sheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} title="Game">
        <div className="flex flex-col gap-1">
          {me && opponent && (
            <button
              type="button"
              onClick={() => {
                setMoreSheetOpen(false)
                setConfigSheetOpen(true)
              }}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-paper/80 hover:bg-veil"
            >
              Game configuration
            </button>
          )}
          <Link
            to={`/game/${detail.game.id}/summary`}
            onClick={() => setMoreSheetOpen(false)}
            className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-paper/80 hover:bg-veil"
          >
            Summary
          </Link>
          {isParticipant && (
            <p className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-paper/60">
              <span className={`h-2 w-2 rounded-full ${opponentOnline ? 'bg-success' : 'bg-paper/30'}`} />
              Opponent {opponentOnline ? 'online' : 'offline'}
            </p>
          )}
        </div>
      </Sheet>

      {me && opponent && (
        <Sheet open={configSheetOpen} onClose={() => setConfigSheetOpen(false)} title="Game configuration">
          <GameConfigPicker
            me={me}
            opponent={opponent}
            disabled={!isParticipant}
            layoutMission={p1Mission.data ?? p2Mission.data}
            layoutVariant={detail.game.layout_variant}
            onSetLayoutVariant={(variant) => setLayoutVariant.mutate(variant)}
            ladderIds={detail.ladderIds}
            ladderOptions={ladderOptions}
            onSetLadders={(next) => setLadders.mutate({ ladderIds: next })}
            onSetRole={(role) =>
              setRole.mutate(role === 'attacker' ? me.player.id : role === 'defender' ? opponent.player.id : null)
            }
            onSetTurnOrder={(turnOrder) =>
              setTurnOrder.mutate(turnOrder === 'first' ? me.player.id : turnOrder === 'second' ? opponent.player.id : null)
            }
          />

          {/* Each seat's own setup -- what used to sit under each name on the round screen itself,
              moved here so that screen can stay down to just the scoring. */}
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm font-medium text-paper/80">Players</p>
            {orderedPlayers.map((entry) => (
              <div
                key={entry.player.id}
                className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2', seatTint(entry.player.seat))}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-paper">
                    {playerLabel(entry, `Seat ${entry.player.seat}`)}
                    {entry.player.user_id === user.id && <span className="ml-1 text-xs text-gold">(you)</span>}
                    {!entry.player.user_id && <span className="ml-1 text-xs text-paper/40">(not joined)</span>}
                  </p>
                  <p className="truncate text-xs text-paper/50">
                    {[entry.factionName ?? 'No faction', entry.player.army_name, entry.forceDispositionName]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {missionByPlayerId.get(entry.player.id)?.name && (
                    <p className="truncate text-xs text-paper/50">{missionByPlayerId.get(entry.player.id)?.name}</p>
                  )}
                </div>
                {canEditSetup(entry) && (
                  <Button
                    variant="secondary"
                    className="flex-shrink-0"
                    onClick={() => {
                      setConfigSheetOpen(false)
                      setEditingPlayerId(entry.player.id)
                    }}
                  >
                    Edit setup
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

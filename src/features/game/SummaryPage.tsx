import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { GameLockBanner } from '@/components/GameLockBanner'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { ResultIcon, type GameResultKind } from '@/components/ResultIcon'
import { useAuth } from '@/features/auth/AuthProvider'
import { needsVerification, playerLabel, playerUserId, remainingCp, useGame, useVerifySeat } from '@/lib/queries/games'
import { isSafeExternalUrl } from '@/lib/isSafeExternalUrl'
import { useMission, useSecondaryObjectives } from '@/lib/queries/referenceData'

export function SummaryPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useGame(id)
  const verifySeat = useVerifySeat(id ?? '')
  const [p1, p2] = data?.players ?? []
  const p1Mission = useMission(p1?.player.mission_id ?? undefined)
  const p2Mission = useMission(p2?.player.mission_id ?? undefined)
  const secondaries = useSecondaryObjectives(data?.game.mission_pack_id)
  const [showSecondaries, setShowSecondaries] = useState(false)

  if (isLoading) return <Spinner label="Loading summary…" />
  if (isError || !data) return <ErrorBanner message="Couldn't load this game." onRetry={() => refetch()} />

  const { game, players } = data
  const me = players.find((p) => p.player.user_id === user?.id)
  const missionByPlayerId = new Map([
    [p1?.player.id, p1Mission.data?.name],
    [p2?.player.id, p2Mission.data?.name],
  ])

  const resultLabel = (() => {
    if (game.status === 'abandoned' && !game.outcome) return 'Abandoned'
    if (game.outcome === 'draw') return 'Draw'
    if (!me || !game.outcome) return null
    const won = game.outcome === `seat_${me.player.seat}`
    return won ? 'Victory' : 'Defeat'
  })()

  // One extra pseudo-round past the last real battle round, for the handful of mission lines
  // only checked at the very end of the game (see Scoreboard's endOfGameRound) -- round_scores
  // stores it the same way as any other round, just under a round number no mission's own
  // windows ever use.
  const endOfGameRound = game.total_rounds + 1
  const rounds = [...Array.from({ length: game.total_rounds }, (_, i) => i + 1), endOfGameRound]

  // Layout images are keyed by the Force Disposition pairing (see LayoutVariantPicker), which is
  // shared between both seats -- either player's own resolved mission carries the same 3 image
  // paths, same "either one works" reasoning GameConfigPicker's own layoutMission prop already
  // uses. Just the layout, not the deployment too -- the layout image already shows the
  // deployment's own battlefield shape underneath the terrain, so a separate deployment card next
  // to it would just be a duplicate, blanker view of the same board.
  const layoutMission = p1Mission.data ?? p2Mission.data
  const layoutImageKey = game.layout_variant
    ? (`layout_${game.layout_variant.toLowerCase()}_image_path` as
        | 'layout_a_image_path'
        | 'layout_b_image_path'
        | 'layout_c_image_path')
    : null
  const layoutImagePath = layoutImageKey && layoutMission ? layoutMission[layoutImageKey] : null

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        {resultLabel && (
          <>
            <ResultIcon result={resultLabel.toLowerCase() as GameResultKind} size="lg" className="mx-auto" />
            <p
              className={`mt-1 text-sm font-semibold tracking-widest uppercase ${
                resultLabel === 'Victory' ? 'text-success' : resultLabel === 'Defeat' ? 'text-danger' : 'text-paper/60'
              }`}
            >
              {resultLabel}
            </p>
          </>
        )}
        <h1 className="mt-1 text-2xl font-bold text-paper">Game summary</h1>
        <p className="text-sm text-paper/50">{game.points_limit} pts</p>
      </div>

      {game.layout_variant && (
        <div className="mx-auto flex w-full max-w-[12rem] flex-col overflow-hidden rounded-lg border border-veil-strong bg-veil">
          {layoutImagePath ? (
            <img
              src={layoutImagePath}
              alt=""
              loading="lazy"
              className="aspect-[44/60] w-full bg-veil object-contain"
            />
          ) : (
            <div className="flex aspect-[44/60] w-full items-center justify-center bg-veil text-xs text-paper/30">
              No image
            </div>
          )}
          <p className="px-2 py-1.5 text-center text-xs font-medium text-paper/70">Layout {game.layout_variant}</p>
        </div>
      )}

      <GameLockBanner detail={data} userId={user?.id} />

      <div className="grid grid-cols-2 gap-4">
        {players.map((entry) => {
          const unverified = needsVerification(entry, game.status, data.verifications)
          const iOwnThisSeat = unverified && user?.id === (entry.player.user_id ?? entry.player.represents_user_id)
          const isRepresented = Boolean(entry.player.represents_user_id) && !entry.player.user_id
          return (
            <div key={entry.player.id} className="rounded-2xl border border-veil-strong bg-veil p-4 text-center">
              <p className="font-medium text-paper">
                <PlayerNameLink userId={playerUserId(entry)} name={playerLabel(entry, `Seat ${entry.player.seat}`)} />
              </p>
              <p className="text-xs text-paper/50">{entry.factionName ?? 'No faction'}</p>
              <p className="mt-1 text-xs text-paper/40">{missionByPlayerId.get(entry.player.id) ?? 'Unknown mission'}</p>
              {isSafeExternalUrl(entry.player.army_list_url) && (
                <a
                  href={entry.player.army_list_url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-block text-xs text-paper/40 underline hover:text-paper"
                >
                  View army list ↗
                </a>
              )}
              <p className="mt-2 text-3xl font-bold text-gold">{entry.totalVp}</p>
              <p className="text-xs text-paper/40">
                {entry.primaryTotal} primary + {entry.secondaryTotal} secondary
                {entry.paintedBonusVp > 0 && ` + ${entry.paintedBonusVp} painted`}
              </p>
              {data.commandPoints.some((cp) => cp.game_player_id === entry.player.id) && (
                <p className="mt-0.5 text-xs text-paper/40">
                  {remainingCp(data.commandPoints, entry.player.id)} CP remaining
                </p>
              )}
              {unverified &&
                (iOwnThisSeat ? (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <Button
                      variant="secondary"
                      disabled={verifySeat.isPending}
                      onClick={() => verifySeat.mutate({ gamePlayerId: entry.player.id, userId: user.id })}
                    >
                      {verifySeat.isPending ? 'Verifying…' : 'Verify this result'}
                    </Button>
                    <p className="text-[11px] text-paper/40">
                      {isRepresented
                        ? "Entered on your behalf -- doesn't look right? Ask them to fix it directly."
                        : "Confirms this result is correct. Once both players confirm, it's locked."}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 rounded-full bg-veil-strong px-2 py-0.5 text-[11px] font-medium text-paper/50">
                    Unverified -- awaiting {playerLabel(entry, 'their')}'s confirmation
                  </p>
                ))}
            </div>
          )
        })}
      </div>

      {!game.is_retroactive && (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold tracking-wide text-paper/40 uppercase">Round by round</span>
            <button
              type="button"
              onClick={() => setShowSecondaries((v) => !v)}
              className="text-xs text-paper/50 underline hover:text-paper"
            >
              {showSecondaries ? 'Hide secondaries ▲' : 'Show secondaries ▼'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-veil-strong">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-veil-strong text-paper/50">
                  <th className="px-3 py-2 text-left font-medium">Round</th>
                  <th className="px-3 py-2 text-right font-medium">
                    <PlayerNameLink userId={playerUserId(p1)} name={playerLabel(p1, 'Seat 1')} />
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    <PlayerNameLink userId={playerUserId(p2)} name={playerLabel(p2, 'Seat 2')} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => {
                  const score = (playerId: string | undefined) => {
                    if (!playerId) return 0
                    const primary =
                      data.roundScores.find((r) => r.game_player_id === playerId && r.battle_round === round)
                        ?.primary_vp ?? 0
                    const secondary = data.secondaryScores
                      .filter((s) => s.game_player_id === playerId && s.battle_round === round)
                      .reduce((sum, s) => sum + s.vp_scored, 0)
                    return primary + secondary
                  }
                  // Only ever the secondaries actually scored that round -- secondary_scores has no
                  // row for a drawn-but-unscored (or scored-back-down-to-0) card, see SecondaryScores'
                  // own "0 means unscored, not scored-for-0" handling, so this never needs its own
                  // filter for that.
                  const secondariesFor = (playerId: string | undefined) => {
                    if (!playerId) return []
                    return data.secondaryScores
                      .filter((s) => s.game_player_id === playerId && s.battle_round === round)
                      .map((s) => ({
                        name: secondaries.data?.find((obj) => obj.id === s.secondary_objective_id)?.name ?? 'Unknown',
                        vp: s.vp_scored,
                      }))
                  }
                  const p1Secondaries = secondariesFor(p1?.player.id)
                  const p2Secondaries = secondariesFor(p2?.player.id)
                  return (
                    <Fragment key={round}>
                      <tr className="border-b border-veil last:border-0">
                        <td className="px-3 py-2 text-paper/70">{round === endOfGameRound ? 'End' : round}</td>
                        <td className="px-3 py-2 text-right text-paper">{score(p1?.player.id)}</td>
                        <td className="px-3 py-2 text-right text-paper">{score(p2?.player.id)}</td>
                      </tr>
                      {showSecondaries && (p1Secondaries.length > 0 || p2Secondaries.length > 0) && (
                        <tr className="border-b border-veil bg-veil last:border-0">
                          <td></td>
                          {[p1Secondaries, p2Secondaries].map((list, i) => (
                            <td key={i} className="px-3 pb-2 text-right align-top">
                              <div className="flex flex-col items-end gap-0.5">
                                {list.length > 0 ? (
                                  list.map((s, j) => (
                                    <span key={j} className="text-[11px] text-paper/50">
                                      {s.name} <span className="text-gold">+{s.vp}</span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[11px] text-paper/30">—</span>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {me && (
        <>
          <Link to={`/game/${game.id}`}>
            <Button variant="secondary" fullWidth>
              Edit scores / result
            </Button>
          </Link>
          <p className="-mt-3 text-center text-xs text-paper/40">
            Nothing here is final -- go back any time to fix a score, a secondary, or the declared result.
          </p>
        </>
      )}

      <div className="flex gap-3">
        <Link to="/home" className="flex-1">
          <Button variant="secondary" fullWidth>
            Home
          </Button>
        </Link>
        <Link to="/history" className="flex-1">
          <Button fullWidth>View history</Button>
        </Link>
      </div>
    </div>
  )
}

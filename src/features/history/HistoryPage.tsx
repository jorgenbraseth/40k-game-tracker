import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { ResultIcon, type GameResultKind } from '@/components/ResultIcon'
import { Select } from '@/components/Select'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDeleteGame, useVerifySeat } from '@/lib/queries/games'
import { type AllGamesRow, type HistoryGameSeat, useAllCompletedGames } from '@/lib/queries/history'
import { useFactions, useForceDispositions } from '@/lib/queries/referenceData'
import { clsx } from '@/lib/clsx'

/**
 * Every finished game, not just the viewer's own (issue: History used to be silently scoped to
 * "games I'm in" even though the same visibility RLS backing a player's stats page already allows
 * any signed-in user to see any finished game -- see fetchAllCompletedGames' own doc comment).
 * "My games", Ladder, Faction, and Force Disposition are all filters over that same full set, not
 * separate views -- and, like Scoreboard's round and this page's own pre-existing ladder filter,
 * they're distinct *views* worth bookmarking/sharing/stepping back through, so they live in the
 * URL rather than component state.
 */
export function HistoryPage() {
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useAllCompletedGames()
  const factions = useFactions()
  const forceDispositions = useForceDispositions()
  const deleteGame = useDeleteGame()
  const [cancelingGameId, setCancelingGameId] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const mineOnly = searchParams.get('mine') === '1'
  const ladderFilter = searchParams.get('ladder') ?? ''
  const factionFilter = searchParams.get('faction') ?? ''
  const dispositionFilter = searchParams.get('disposition') ?? ''

  const setFilter = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  const setMineOnly = (value: boolean) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('mine', '1')
        else next.delete('mine')
        return next
      },
      { replace: true },
    )
  }

  const ladderOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const game of data ?? []) {
      if (game.ladderId) byId.set(game.ladderId, game.ladderName ?? 'Unknown ladder')
    }
    return [...byId.entries()]
  }, [data])

  if (isLoading) return <Spinner label="Loading history…" />
  if (isError) return <ErrorBanner message="Couldn't load game history." onRetry={() => refetch()} />
  if (!data || data.length === 0) {
    return <EmptyState title="No finished games yet" description="Completed games will show up here." />
  }

  const isMine = (game: AllGamesRow) =>
    Boolean(user?.id) && (game.seat1.userId === user?.id || game.seat2.userId === user?.id)

  const visible = data.filter((game) => {
    if (mineOnly && !isMine(game)) return false
    if (ladderFilter && game.ladderId !== ladderFilter) return false
    if (factionFilter && game.seat1.factionId !== factionFilter && game.seat2.factionId !== factionFilter) return false
    if (
      dispositionFilter &&
      game.seat1.forceDispositionId !== dispositionFilter &&
      game.seat2.forceDispositionId !== dispositionFilter
    )
      return false
    return true
  })

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-paper">History</h1>
      <p className="text-sm text-paper/50">Every finished game, from everyone -- filter down to your own below.</p>

      <label className="flex min-h-11 items-center gap-2 text-sm text-paper/80">
        <input
          type="checkbox"
          checked={mineOnly}
          onChange={(e) => setMineOnly(e.target.checked)}
          className="h-4 w-4 flex-shrink-0 accent-gold"
        />
        My games only
      </label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ladderOptions.length > 0 && (
          <Select label="Ladder" value={ladderFilter} onChange={(e) => setFilter('ladder', e.target.value)}>
            <option value="">All ladders</option>
            {ladderOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Faction" value={factionFilter} onChange={(e) => setFilter('faction', e.target.value)}>
          <option value="">All factions</option>
          {factions.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <Select
          label="Force Disposition"
          value={dispositionFilter}
          onChange={(e) => setFilter('disposition', e.target.value)}
        >
          <option value="">All dispositions</option>
          {forceDispositions.data?.map((fd) => (
            <option key={fd.id} value={fd.id}>
              {fd.name}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 && (
        <EmptyState title="No games match these filters" description="Try clearing a filter." />
      )}

      <ul className="flex flex-col gap-2">
        {visible.map((game) => (
          <HistoryGameRow
            key={game.gameId}
            game={game}
            userId={user?.id}
            onCancel={() => setCancelingGameId(game.gameId)}
          />
        ))}
      </ul>

      <ConfirmSheet
        open={cancelingGameId !== null}
        onClose={() => setCancelingGameId(null)}
        onConfirm={async () => {
          if (!cancelingGameId) return
          try {
            await deleteGame.mutateAsync(cancelingGameId)
            setCancelingGameId(null)
          } catch {
            // error already surfaced via toast in useDeleteGame; keep the sheet open to retry
          }
        }}
        title="Cancel this game?"
        message="This removes it completely for both players -- scores, setup, everything, from both your histories. This can't be undone."
        confirmLabel="Cancel game"
        pending={deleteGame.isPending}
      />
    </div>
  )
}

type Result = 'win' | 'loss' | 'draw' | 'abandoned'

const RESULT_ICON: Record<Result, GameResultKind> = {
  win: 'victory',
  loss: 'defeat',
  draw: 'draw',
  abandoned: 'abandoned',
}

/**
 * Two shapes, one row: when the viewer holds one of the two seats (their own account, or a
 * ladder member they solo-entered on behalf of), this renders the familiar "vs <opponent>",
 * mine-first VP, win/loss/draw badge, and Cancel/Verify actions -- exactly as before this page
 * showed everyone's games, since none of that changes for a game that's actually the viewer's own.
 * Otherwise -- someone else's game, now visible for the first time -- it falls back to the same
 * generic "seat1 vs seat2, winner bolded" shape LaddersPage/TournamentsPage's own game lists
 * already use, with no actions a non-participant couldn't actually perform anyway (RLS backs this
 * up regardless: cancel/verify are participant-only server-side).
 */
function HistoryGameRow({
  game,
  userId,
  onCancel,
}: {
  game: AllGamesRow
  userId: string | undefined
  onCancel: () => void
}) {
  const verifySeat = useVerifySeat(game.gameId)
  const endedAt = new Date(game.endedAt).toLocaleDateString()

  const mySeat: HistoryGameSeat | null =
    userId && game.seat1.userId === userId ? game.seat1 : userId && game.seat2.userId === userId ? game.seat2 : null
  const opponentSeat = mySeat ? (mySeat === game.seat1 ? game.seat2 : game.seat1) : null

  if (mySeat && opponentSeat) {
    const mySeatKey = mySeat === game.seat1 ? 'seat_1' : 'seat_2'
    const result: Result =
      game.status === 'abandoned' ? 'abandoned' : game.outcome === 'draw' ? 'draw' : game.outcome === mySeatKey ? 'win' : 'loss'

    return (
      <li className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <p className="min-w-0 truncate text-sm text-paper">
            {mySeat.missionName} · vs{' '}
            <PlayerNameLink userId={opponentSeat.userId} name={opponentSeat.displayName} className="font-medium text-paper" />
          </p>
          <button
            type="button"
            aria-label="Cancel game"
            onClick={onCancel}
            className="flex-shrink-0 text-paper/40 hover:text-red-400"
          >
            ✕
          </button>
        </div>
        <Link to={`/game/${game.gameId}/summary`} className="flex items-center justify-between gap-3 px-4 pb-3">
          <p className="min-w-0 truncate text-xs text-paper/50">
            {mySeat.factionName ?? 'No faction'} · {game.pointsLimit} pts · {endedAt}
            {game.ladderName ? ` · ${game.ladderName}` : ''}
          </p>
          <div className="flex flex-shrink-0 items-center gap-2 text-right">
            <span
              className={clsx(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
                result === 'win' && 'bg-green-900/50 text-green-300',
                result === 'loss' && 'bg-red-900/50 text-red-300',
                (result === 'draw' || result === 'abandoned') && 'bg-white/10 text-paper/60',
              )}
            >
              <ResultIcon result={RESULT_ICON[result]} />
              {result}
            </span>
            <span className="text-sm text-paper/50">
              {mySeat.totalVp}-{opponentSeat.totalVp}
            </span>
          </div>
        </Link>
        {mySeat.needsVerification && userId && (
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-2">
            <p className="text-[11px] text-paper/40">Entered on your behalf -- does this look right?</p>
            <Button
              variant="secondary"
              disabled={verifySeat.isPending}
              onClick={(e) => {
                e.preventDefault()
                verifySeat.mutate({ gamePlayerId: mySeat.gamePlayerId, userId })
              }}
            >
              {verifySeat.isPending ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
        )}
        {!mySeat.needsVerification && opponentSeat.needsVerification && (
          <p className="border-t border-white/10 px-4 py-2 text-[11px] text-paper/40">
            Unverified -- awaiting {opponentSeat.displayName}'s confirmation
          </p>
        )}
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
      <div className="px-4 pt-3">
        <p className="min-w-0 truncate text-sm text-paper">
          <PlayerNameLink
            userId={game.seat1.userId}
            name={game.seat1.displayName}
            className={game.outcome === 'seat_1' ? 'font-semibold text-paper' : 'text-paper/70'}
          />
          <span className="text-paper/40"> vs </span>
          <PlayerNameLink
            userId={game.seat2.userId}
            name={game.seat2.displayName}
            className={game.outcome === 'seat_2' ? 'font-semibold text-paper' : 'text-paper/70'}
          />
        </p>
      </div>
      <Link to={`/game/${game.gameId}/summary`} className="flex items-center justify-between gap-3 px-4 pb-3">
        <p className="min-w-0 truncate text-xs text-paper/50">
          {game.seat1.factionName ?? 'No faction'} vs {game.seat2.factionName ?? 'No faction'} · {game.pointsLimit} pts
          · {endedAt}
          {game.ladderName ? ` · ${game.ladderName}` : ''}
          {game.status === 'abandoned' ? ' · Abandoned' : ''}
        </p>
        <span className="flex-shrink-0 text-sm text-paper/50">
          {game.seat1.totalVp}-{game.seat2.totalVp}
        </span>
      </Link>
    </li>
  )
}

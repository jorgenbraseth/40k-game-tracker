import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { Select } from '@/components/Select'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCompletedGames } from '@/lib/queries/history'
import { useDeleteGame } from '@/lib/queries/games'
import { clsx } from '@/lib/clsx'

export function HistoryPage() {
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useCompletedGames(user?.id)
  const deleteGame = useDeleteGame()
  const [cancelingGameId, setCancelingGameId] = useState<string | null>(null)
  // Which ladder's games are shown lives in the URL (?ladder=<id>), same as Scoreboard's round --
  // bookmarkable/shareable, replacing rather than pushing a history entry per change since a
  // filter dropdown isn't something you'd want to have to click "back" through repeatedly.
  const [searchParams, setSearchParams] = useSearchParams()
  const ladderFilter = searchParams.get('ladder') ?? ''
  const setLadderFilter = (ladderId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (ladderId) next.set('ladder', ladderId)
        else next.delete('ladder')
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
  if (isError) return <ErrorBanner message="Couldn't load your game history." onRetry={() => refetch()} />
  if (!data || data.length === 0) {
    return <EmptyState title="No finished games yet" description="Your completed games will show up here." />
  }

  const visible = ladderFilter ? data.filter((g) => g.ladderId === ladderFilter) : data

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-paper">History</h1>

      {ladderOptions.length > 0 && (
        <Select label="Ladder" value={ladderFilter} onChange={(e) => setLadderFilter(e.target.value)}>
          <option value="">All games</option>
          {ladderOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
      )}

      {visible.length === 0 && (
        <EmptyState title="No games for this ladder" description="Try a different ladder, or clear the filter." />
      )}

      <ul className="flex flex-col gap-2">
        {visible.map((game) => (
          <li key={game.gameId} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <p className="min-w-0 truncate text-sm text-paper">
                {game.missionName} · vs{' '}
                <PlayerNameLink userId={game.opponentUserId} name={game.opponentName} className="font-medium text-paper" />
              </p>
              <button
                type="button"
                aria-label="Cancel game"
                onClick={() => setCancelingGameId(game.gameId)}
                className="flex-shrink-0 text-paper/40 hover:text-red-400"
              >
                ✕
              </button>
            </div>
            <Link to={`/game/${game.gameId}/summary`} className="flex items-center justify-between gap-3 px-4 pb-3">
              <p className="min-w-0 truncate text-xs text-paper/50">
                {game.myFactionName ?? 'No faction'} · {game.pointsLimit} pts ·{' '}
                {new Date(game.endedAt).toLocaleDateString()}
                {game.ladderName ? ` · ${game.ladderName}` : ''}
              </p>
              <div className="flex flex-shrink-0 items-center gap-2 text-right">
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
                    game.result === 'win' && 'bg-green-900/50 text-green-300',
                    game.result === 'loss' && 'bg-red-900/50 text-red-300',
                    (game.result === 'draw' || game.result === 'abandoned') && 'bg-white/10 text-paper/60',
                  )}
                >
                  {game.result}
                </span>
                <span className="text-sm text-paper/50">
                  {game.myTotalVp}-{game.opponentTotalVp}
                </span>
              </div>
            </Link>
          </li>
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

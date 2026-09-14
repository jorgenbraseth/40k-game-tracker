import { Link } from 'react-router-dom'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCompletedGames } from '@/lib/queries/history'
import { clsx } from '@/lib/clsx'

export function HistoryPage() {
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useCompletedGames(user?.id)

  if (isLoading) return <Spinner label="Loading history…" />
  if (isError) return <ErrorBanner message="Couldn't load your game history." onRetry={() => refetch()} />
  if (!data || data.length === 0) {
    return <EmptyState title="No finished games yet" description="Your completed games will show up here." />
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-paper">History</h1>
      <ul className="flex flex-col gap-2">
        {data.map((game) => (
          <li key={game.gameId}>
            <Link
              to={`/game/${game.gameId}/summary`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-paper">
                  {game.missionName} · vs {game.opponentName}
                </p>
                <p className="truncate text-xs text-paper/50">
                  {game.myFactionName ?? 'No faction'} · {game.pointsLimit} pts ·{' '}
                  {new Date(game.endedAt).toLocaleDateString()}
                </p>
              </div>
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
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { useAuth } from '@/features/auth/AuthProvider'
import { useMyActiveGames } from '@/lib/queries/games'

export function HomePage() {
  const { user } = useAuth()
  const { data: activeGames, isLoading, isError, refetch } = useMyActiveGames(user?.id)

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3">
        <Link to="/game/new">
          <Button fullWidth>Start a game</Button>
        </Link>
        <Link to="/game/join">
          <Button variant="secondary" fullWidth>
            Join a game
          </Button>
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-paper/60 uppercase">
          In progress
        </h2>
        {isLoading && <Spinner label="Loading your games…" />}
        {isError && <ErrorBanner message="Couldn't load your games." onRetry={() => refetch()} />}
        {!isLoading && !isError && activeGames?.length === 0 && (
          <EmptyState
            title="No games in progress"
            description="Start a new game or join one with a code from your opponent."
          />
        )}
        {activeGames && activeGames.length > 0 && (
          <ul className="flex flex-col gap-2">
            {activeGames.map((game) => (
              <li key={game.id}>
                <Link
                  to={`/game/${game.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
                >
                  <span>
                    <span className="font-medium text-paper">Code {game.join_code}</span>
                    <span className="ml-2 text-sm text-paper/50 capitalize">{game.status}</span>
                  </span>
                  <span aria-hidden className="text-paper/40">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

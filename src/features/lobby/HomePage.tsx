import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { InstallHint } from '@/components/InstallHint'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDeleteGame, useMyActiveGames } from '@/lib/queries/games'

export function HomePage() {
  const { user } = useAuth()
  const { data: activeGames, isLoading, isError, refetch } = useMyActiveGames(user?.id)
  const deleteGame = useDeleteGame()
  const [cancelingGameId, setCancelingGameId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-8">
      <InstallHint />

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

      <Link to="/game/log">
        <Button variant="ghost" fullWidth>
          Log a past game
        </Button>
      </Link>

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
              <li
                key={game.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 pr-2 hover:bg-white/10"
              >
                <Link to={`/game/${game.id}`} className="flex flex-1 items-center justify-between px-4 py-3">
                  <span>
                    <span className="font-medium text-paper">Code {game.join_code}</span>
                    <span className="ml-2 text-sm text-paper/50 capitalize">{game.status}</span>
                  </span>
                  <span aria-hidden className="text-paper/40">
                    →
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label="Cancel game"
                  onClick={() => setCancelingGameId(game.id)}
                  className="min-h-11 min-w-11 rounded-lg text-paper/40 hover:bg-white/10 hover:text-red-400"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
        message="This removes it completely for both players -- scores, setup, everything. This can't be undone."
        confirmLabel="Cancel game"
        pending={deleteGame.isPending}
      />
    </div>
  )
}

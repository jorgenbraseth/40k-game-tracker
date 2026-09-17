import { useParams } from 'react-router-dom'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCompletedGames } from '@/lib/queries/history'
import { useProfile } from '@/lib/queries/profile'
import { computeStats } from '@/lib/stats'
import { RecordGroup } from './RecordGroup'

/**
 * Serves both `/stats` (no route param -- always the signed-in user's own record) and
 * `/players/:userId` (anyone else's, reached by tapping a linked player name elsewhere in the
 * app). The same query works for either: `useCompletedGames` reads every one of that `userId`'s
 * *finished* games (complete or abandoned) -- any signed-in user can see them, not just a shared
 * ladder or a game they personally played in (see issue #28 and
 * 20260314000000_finished_game_visibility.sql) -- so nothing here needs to know the difference. A
 * game still in the lobby or being played stays invisible to everyone but its own participants
 * until it actually finishes.
 */
export function StatsPage() {
  const { userId: routeUserId } = useParams<{ userId?: string }>()
  const { user } = useAuth()
  const targetUserId = routeUserId ?? user?.id
  const isOwn = !routeUserId || routeUserId === user?.id

  const profile = useProfile(isOwn ? undefined : targetUserId)
  const { data, isLoading, isError, refetch } = useCompletedGames(targetUserId)

  if (isLoading || (!isOwn && profile.isLoading)) return <Spinner label="Crunching numbers…" />
  if (isError || (!isOwn && profile.isError)) {
    return <ErrorBanner message="Couldn't load this player's stats." onRetry={() => refetch()} />
  }

  const displayName = isOwn ? 'Your' : `${profile.data?.display_name ?? 'This player'}'s`

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No stats to show"
        description={
          isOwn ? 'Finish a game to start building your record.' : "This player hasn't finished a game yet."
        }
      />
    )
  }

  const stats = computeStats(data)

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-paper">{displayName} record</h1>
        <p className="mt-2 text-4xl font-bold text-gold">{Math.round(stats.overall.winRate * 100)}%</p>
        <p className="text-sm text-paper/60">
          {stats.overall.wins}W {stats.overall.losses}L {stats.overall.draws}D · {stats.overall.games} games
        </p>
      </div>

      <RecordGroup title="By faction" records={stats.byFaction} />
      <RecordGroup title="By Force Disposition" records={stats.byDisposition} />
      <RecordGroup title="By opponent" records={stats.byOpponent} />
    </div>
  )
}

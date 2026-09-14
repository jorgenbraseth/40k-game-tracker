import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCompletedGames } from '@/lib/queries/history'
import { computeStats, type GroupedRecord } from '@/lib/stats'

function RecordGroup({ title, records }: { title: string; records: GroupedRecord[] }) {
  if (records.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {records.map((r) => (
          <li
            key={r.key}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <span className="text-paper">{r.key}</span>
            <span className="text-sm text-paper/60">
              {r.wins}W {r.losses}L {r.draws}D ·{' '}
              <span className="font-medium text-paper">{Math.round(r.winRate * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function StatsPage() {
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useCompletedGames(user?.id)

  if (isLoading) return <Spinner label="Crunching numbers…" />
  if (isError) return <ErrorBanner message="Couldn't load your stats." onRetry={() => refetch()} />
  if (!data || data.length === 0) {
    return <EmptyState title="No stats yet" description="Finish a game to start building your record." />
  }

  const stats = computeStats(data)

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-paper">Overall record</h1>
        <p className="mt-2 text-4xl font-bold text-gold">{Math.round(stats.overall.winRate * 100)}%</p>
        <p className="text-sm text-paper/60">
          {stats.overall.wins}W {stats.overall.losses}L {stats.overall.draws}D · {stats.overall.games} games
        </p>
      </div>

      <RecordGroup title="By faction" records={stats.byFaction} />
      <RecordGroup title="By mission" records={stats.byMission} />
      <RecordGroup title="By opponent" records={stats.byOpponent} />
    </div>
  )
}

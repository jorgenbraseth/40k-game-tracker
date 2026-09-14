import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { useAuth } from '@/features/auth/AuthProvider'
import { useGame } from '@/lib/queries/games'
import { useMission } from '@/lib/queries/referenceData'

export function SummaryPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useGame(id)
  const [p1, p2] = data?.players ?? []
  const p1Mission = useMission(p1?.player.mission_id ?? undefined)
  const p2Mission = useMission(p2?.player.mission_id ?? undefined)

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

  const rounds = Array.from({ length: game.total_rounds }, (_, i) => i + 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        {resultLabel && (
          <p
            className={`text-sm font-semibold tracking-widest uppercase ${
              resultLabel === 'Victory' ? 'text-green-400' : resultLabel === 'Defeat' ? 'text-red-400' : 'text-paper/60'
            }`}
          >
            {resultLabel}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold text-paper">Game summary</h1>
        <p className="text-sm text-paper/50">{game.points_limit} pts</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {players.map((entry) => (
          <div key={entry.player.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="font-medium text-paper">{entry.profile?.display_name ?? `Seat ${entry.player.seat}`}</p>
            <p className="text-xs text-paper/50">{entry.factionName ?? 'No faction'}</p>
            <p className="mt-1 text-xs text-paper/40">{missionByPlayerId.get(entry.player.id) ?? 'Unknown mission'}</p>
            <p className="mt-2 text-3xl font-bold text-gold">{entry.totalVp}</p>
            <p className="text-xs text-paper/40">
              {entry.primaryTotal} primary + {entry.secondaryTotal} secondary
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-paper/50">
              <th className="px-3 py-2 text-left font-medium">Round</th>
              <th className="px-3 py-2 text-right font-medium">{p1?.profile?.display_name ?? 'Seat 1'}</th>
              <th className="px-3 py-2 text-right font-medium">{p2?.profile?.display_name ?? 'Seat 2'}</th>
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
              return (
                <tr key={round} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2 text-paper/70">{round}</td>
                  <td className="px-3 py-2 text-right text-paper">{score(p1?.player.id)}</td>
                  <td className="px-3 py-2 text-right text-paper">{score(p2?.player.id)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Link to={`/game/${game.id}`}>
        <Button variant="secondary" fullWidth>
          Edit scores / result
        </Button>
      </Link>
      <p className="-mt-3 text-center text-xs text-paper/40">
        Nothing here is final -- go back any time to fix a score, a secondary, or the declared result.
      </p>

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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { GroupingsPicker } from '@/components/GroupingsPicker'
import { Select } from '@/components/Select'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCreateGame } from '@/lib/queries/games'
import { useLadders } from '@/lib/queries/ladders'
import { useCurrentMissionPack } from '@/lib/queries/referenceData'
import { useTournaments } from '@/lib/queries/tournaments'

const POINTS_OPTIONS = [500, 1000, 1500, 2000, 2500, 3000]

export function NewGamePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const missionPack = useCurrentMissionPack()
  const ladders = useLadders(user?.id)
  const tournaments = useTournaments(user?.id)
  const createGame = useCreateGame()

  const [pointsLimit, setPointsLimit] = useState(2000)
  const [ladderIds, setLadderIds] = useState<string[]>([])
  const [tournamentIds, setTournamentIds] = useState<string[]>([])

  if (missionPack.isLoading) return <Spinner label="Loading mission pack…" />
  if (missionPack.isError || !missionPack.data) {
    return <ErrorBanner message="Couldn't load the current mission pack." onRetry={() => missionPack.refetch()} />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const gameId = await createGame.mutateAsync({
      pointsLimit,
      ladderIds,
      tournamentIds,
    })
    navigate(`/game/${gameId}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-paper">Start a game</h1>
        <p className="text-sm text-paper/50">{missionPack.data.name}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Select label="Points limit" value={pointsLimit} onChange={(e) => setPointsLimit(Number(e.target.value))}>
          {POINTS_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p} pts
            </option>
          ))}
        </Select>

        <GroupingsPicker
          ladderIds={ladderIds}
          tournamentIds={tournamentIds}
          ladderOptions={(ladders.data ?? [])
            .filter((l) => l.isMember && !l.archivedAt)
            .map((l) => ({ id: l.id, name: l.name }))}
          tournamentOptions={(tournaments.data ?? [])
            .filter((t) => t.isMember && !t.archivedAt)
            .map((t) => ({ id: t.id, name: t.name }))}
          onChange={(next) => {
            setLadderIds(next.ladderIds)
            setTournamentIds(next.tournamentIds)
          }}
        />

        {createGame.isError && (
          <p className="text-sm text-danger">
            {createGame.error instanceof Error ? createGame.error.message : 'Could not create game.'}
          </p>
        )}

        <Button type="submit" disabled={createGame.isPending} fullWidth>
          {createGame.isPending ? 'Creating…' : 'Create game & get code'}
        </Button>
      </form>
    </div>
  )
}

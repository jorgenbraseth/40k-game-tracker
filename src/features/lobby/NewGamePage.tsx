import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { Select } from '@/components/Select'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCreateGame } from '@/lib/queries/games'
import { useLadders } from '@/lib/queries/ladders'
import { useCurrentMissionPack } from '@/lib/queries/referenceData'

const POINTS_OPTIONS = [500, 1000, 1500, 2000, 2500, 3000]

export function NewGamePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const missionPack = useCurrentMissionPack()
  const ladders = useLadders(user?.id)
  const createGame = useCreateGame()

  const [pointsLimit, setPointsLimit] = useState(2000)
  const [ladderId, setLadderId] = useState('')

  if (missionPack.isLoading) return <Spinner label="Loading mission pack…" />
  if (missionPack.isError || !missionPack.data) {
    return <ErrorBanner message="Couldn't load the current mission pack." onRetry={() => missionPack.refetch()} />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const gameId = await createGame.mutateAsync({
      pointsLimit,
      ladderId: ladderId || undefined,
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

        {(ladders.data ?? []).some((l) => l.isMember && !l.archivedAt) && (
          <Select label="Ladder game? (optional)" value={ladderId} onChange={(e) => setLadderId(e.target.value)}>
            <option value="">Not a ladder game</option>
            {(ladders.data ?? [])
              .filter((l) => l.isMember && !l.archivedAt)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </Select>
        )}

        {createGame.isError && (
          <p className="text-sm text-red-400">
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

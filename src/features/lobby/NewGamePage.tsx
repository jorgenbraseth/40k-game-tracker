import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { Select } from '@/components/Select'
import { TextField } from '@/components/TextField'
import { useCreateGame } from '@/lib/queries/games'
import { useCurrentMissionPack, useDeployments, useFactions, useForceDispositions } from '@/lib/queries/referenceData'

const POINTS_OPTIONS = [500, 1000, 1500, 2000, 2500, 3000]

export function NewGamePage() {
  const navigate = useNavigate()
  const missionPack = useCurrentMissionPack()
  const deployments = useDeployments(missionPack.data?.id)
  const forceDispositions = useForceDispositions()
  const factions = useFactions()
  const createGame = useCreateGame()

  const [deploymentId, setDeploymentId] = useState('')
  const [pointsLimit, setPointsLimit] = useState(2000)
  const [forceDispositionId, setForceDispositionId] = useState('')
  const [factionId, setFactionId] = useState('')
  const [armyName, setArmyName] = useState('')

  if (missionPack.isLoading) return <Spinner label="Loading mission pack…" />
  if (missionPack.isError || !missionPack.data) {
    return <ErrorBanner message="Couldn't load the current mission pack." onRetry={() => missionPack.refetch()} />
  }

  const effectiveDeploymentId = deploymentId || deployments.data?.[0]?.id || ''

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveDeploymentId) return
    const gameId = await createGame.mutateAsync({
      deploymentId: effectiveDeploymentId,
      pointsLimit,
      forceDispositionId: forceDispositionId || undefined,
      factionId: factionId || undefined,
      armyName: armyName.trim() || undefined,
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
        <Select
          label="Deployment"
          value={effectiveDeploymentId}
          onChange={(e) => setDeploymentId(e.target.value)}
          required
        >
          {deployments.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>

        <Select label="Points limit" value={pointsLimit} onChange={(e) => setPointsLimit(Number(e.target.value))}>
          {POINTS_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p} pts
            </option>
          ))}
        </Select>

        <Select
          label="Your Force Disposition (optional)"
          value={forceDispositionId}
          onChange={(e) => setForceDispositionId(e.target.value)}
        >
          <option value="">Pick later</option>
          {forceDispositions.data?.map((fd) => (
            <option key={fd.id} value={fd.id}>
              {fd.name}
            </option>
          ))}
        </Select>
        <p className="-mt-2 text-xs text-paper/40">
          The Primary Mission is determined by both players' Force Dispositions together -- it's revealed once your
          opponent has joined and picked theirs too.
        </p>

        <Select label="Your faction (optional)" value={factionId} onChange={(e) => setFactionId(e.target.value)}>
          <option value="">Pick later</option>
          {factions.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>

        <TextField
          label="Your army name (optional)"
          value={armyName}
          onChange={(e) => setArmyName(e.target.value)}
          placeholder="e.g. The Iron Talons"
        />

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

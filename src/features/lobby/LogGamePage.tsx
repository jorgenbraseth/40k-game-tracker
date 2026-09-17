import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { GroupingsPicker } from '@/components/GroupingsPicker'
import { Select } from '@/components/Select'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/AuthProvider'
import { useLogCompletedGame } from '@/lib/queries/games'
import { useLadderMembers, useLadders } from '@/lib/queries/ladders'
import { useFactions, useForceDispositions } from '@/lib/queries/referenceData'
import { useTournaments } from '@/lib/queries/tournaments'

const POINTS_OPTIONS = [500, 1000, 1500, 2000, 2500, 3000]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Feature request: register a game that already happened, entirely after the fact -- both
 * players' faction/Force Disposition and just the final score per side, no live Scoreboard play.
 * One form, one submit, straight to a `status: 'complete'` game via log_completed_game() -- see
 * that RPC's own comment (20260403000000_log_completed_game.sql) for why the final score lands as
 * chunked round_scores rows under the hood rather than a cleaner direct-write column.
 *
 * The logger is always seat 1 (matches every other creation path in this app -- the creator is
 * always seat 1) and is auto-verified server-side, since they're the one typing the result in.
 * The opponent (seat 2) can be a free-text name with no account, same as a live game's solo-entry
 * bookkeeper flow, or attributed to a real ladder member (only offered once a ladder's tagged and
 * has members, same "first tagged ladder" simplification WaitingRoom's own PlayerSetupFields
 * already makes) so their result counts toward their own standings once they confirm it.
 */
export function LogGamePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const factions = useFactions()
  const forceDispositions = useForceDispositions()
  const ladders = useLadders(user?.id)
  const tournaments = useTournaments(user?.id)
  const logGame = useLogCompletedGame()

  const [pointsLimit, setPointsLimit] = useState(2000)
  const [playedAt, setPlayedAt] = useState(today())
  const [ladderIds, setLadderIds] = useState<string[]>([])
  const [tournamentIds, setTournamentIds] = useState<string[]>([])

  const [myFactionId, setMyFactionId] = useState('')
  const [myForceDispositionId, setMyForceDispositionId] = useState('')
  const [myArmyName, setMyArmyName] = useState('')
  const [myVp, setMyVp] = useState('')

  const [opponentRepresentsUserId, setOpponentRepresentsUserId] = useState('')
  const [opponentFactionId, setOpponentFactionId] = useState('')
  const [opponentForceDispositionId, setOpponentForceDispositionId] = useState('')
  const [opponentArmyName, setOpponentArmyName] = useState('')
  const [opponentVp, setOpponentVp] = useState('')

  const firstLadderId = ladderIds[0]
  const ladderMembers = useLadderMembers(firstLadderId)

  if (factions.isLoading || forceDispositions.isLoading) return <Spinner label="Loading reference data…" />
  if (factions.isError || forceDispositions.isError) {
    return <ErrorBanner message="Couldn't load factions or Force Dispositions." onRetry={() => factions.refetch()} />
  }

  const myVpNumber = Number(myVp)
  const opponentVpNumber = Number(opponentVp)
  const canSubmit =
    myFactionId &&
    myForceDispositionId &&
    opponentFactionId &&
    opponentForceDispositionId &&
    (opponentRepresentsUserId || opponentArmyName.trim()) &&
    myVp !== '' &&
    opponentVp !== '' &&
    Number.isInteger(myVpNumber) &&
    myVpNumber >= 0 &&
    myVpNumber <= 90 &&
    Number.isInteger(opponentVpNumber) &&
    opponentVpNumber >= 0 &&
    opponentVpNumber <= 90

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const gameId = await logGame.mutateAsync({
      pointsLimit,
      playedAt: new Date(`${playedAt}T12:00:00`).toISOString(),
      myVp: myVpNumber,
      opponentVp: opponentVpNumber,
      myFactionId,
      myForceDispositionId,
      myArmyName: myArmyName || null,
      opponentRepresentsUserId: opponentRepresentsUserId || null,
      opponentFactionId,
      opponentForceDispositionId,
      opponentArmyName: opponentArmyName || null,
      ladderIds,
      tournamentIds,
    })
    navigate(`/game/${gameId}/summary`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-paper">Log a past game</h1>
        <p className="text-sm text-paper/50">
          Already played it elsewhere? Enter both sides and the final score -- no round-by-round
          tracking needed.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Points limit" value={pointsLimit} onChange={(e) => setPointsLimit(Number(e.target.value))}>
            {POINTS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p} pts
              </option>
            ))}
          </Select>
          <TextField
            label="Played on"
            type="date"
            value={playedAt}
            max={today()}
            onChange={(e) => setPlayedAt(e.target.value)}
          />
        </div>

        {/* Ladder/tournament tagging comes before either seat's own fields -- picking a ladder
            here is what populates the Opponent fieldset's "Player" dropdown below with that
            ladder's own members, so it has to happen first, not as an afterthought at the
            bottom of the form. */}
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
            if (next.ladderIds[0] !== firstLadderId) setOpponentRepresentsUserId('')
          }}
        />

        <fieldset className="flex min-w-0 flex-col gap-3 rounded-xl border border-white/10 p-4">
          <legend className="px-1 text-sm font-semibold text-paper/80">You</legend>
          <Select label="Faction" value={myFactionId} onChange={(e) => setMyFactionId(e.target.value)}>
            <option value="">Pick faction</option>
            {factions.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select
            label="Force Disposition"
            value={myForceDispositionId}
            onChange={(e) => setMyForceDispositionId(e.target.value)}
          >
            <option value="">Pick Force Disposition</option>
            {forceDispositions.data?.map((fd) => (
              <option key={fd.id} value={fd.id}>
                {fd.name}
              </option>
            ))}
          </Select>
          <TextField
            label="Army name (optional)"
            value={myArmyName}
            onChange={(e) => setMyArmyName(e.target.value)}
          />
          <TextField
            label="Your final score"
            type="number"
            inputMode="numeric"
            min={0}
            max={90}
            value={myVp}
            onChange={(e) => setMyVp(e.target.value)}
          />
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-3 rounded-xl border border-white/10 p-4">
          <legend className="px-1 text-sm font-semibold text-paper/80">Opponent</legend>
          {(ladderMembers.data?.length ?? 0) > 0 && (
            <div>
              <Select
                label="Player"
                value={opponentRepresentsUserId}
                onChange={(e) => setOpponentRepresentsUserId(e.target.value)}
              >
                <option value="">Not on the ladder / not sure</option>
                {ladderMembers.data?.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-paper/50">
                Pick them here so their result counts in standings too -- they'll get a chance to
                confirm it's right.
              </p>
            </div>
          )}
          <Select
            label="Faction"
            value={opponentFactionId}
            onChange={(e) => setOpponentFactionId(e.target.value)}
          >
            <option value="">Pick faction</option>
            {factions.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select
            label="Force Disposition"
            value={opponentForceDispositionId}
            onChange={(e) => setOpponentForceDispositionId(e.target.value)}
          >
            <option value="">Pick Force Disposition</option>
            {forceDispositions.data?.map((fd) => (
              <option key={fd.id} value={fd.id}>
                {fd.name}
              </option>
            ))}
          </Select>
          <TextField
            label={opponentRepresentsUserId ? 'Army name (optional)' : 'Opponent name'}
            value={opponentArmyName}
            onChange={(e) => setOpponentArmyName(e.target.value)}
            placeholder={opponentRepresentsUserId ? undefined : "Who you played against"}
          />
          <TextField
            label="Their final score"
            type="number"
            inputMode="numeric"
            min={0}
            max={90}
            value={opponentVp}
            onChange={(e) => setOpponentVp(e.target.value)}
          />
        </fieldset>

        {logGame.isError && (
          <p className="text-sm text-red-400">
            {logGame.error instanceof Error ? logGame.error.message : 'Could not log this game.'}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit || logGame.isPending} fullWidth>
          {logGame.isPending ? 'Logging…' : 'Log game'}
        </Button>
      </form>
    </div>
  )
}

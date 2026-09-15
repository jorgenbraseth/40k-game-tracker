import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  useCreateLadder,
  useJoinLadder,
  useLadderGames,
  useLadders,
  useLadderStandings,
  useLeaveLadder,
  type LadderSummary,
} from '@/lib/queries/ladders'

function StandingsTable({ ladderId }: { ladderId: string }) {
  const standings = useLadderStandings(ladderId)

  if (standings.isLoading) return <Spinner label="Loading standings…" />
  if (standings.isError) {
    return <ErrorBanner message="Couldn't load standings." onRetry={() => standings.refetch()} />
  }
  if (!standings.data || standings.data.length === 0) {
    return <p className="px-1 py-2 text-sm text-paper/50">No completed games tagged with this ladder yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-paper/40 uppercase">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Player</th>
            <th className="py-1 pr-2 text-right">P</th>
            <th className="py-1 pr-2 text-right">W</th>
            <th className="py-1 pr-2 text-right">D</th>
            <th className="py-1 pr-2 text-right">L</th>
            <th className="py-1 pr-2 text-right">VP diff</th>
            <th className="py-1 text-right">Rating</th>
          </tr>
        </thead>
        <tbody>
          {standings.data.map((row, i) => (
            <tr key={row.userId} className="border-t border-white/10">
              <td className="py-1.5 pr-2 text-paper/50">{i + 1}</td>
              <td className="py-1.5 pr-2 font-medium text-paper">
                <PlayerNameLink userId={row.userId} name={row.displayName} />
              </td>
              <td className="py-1.5 pr-2 text-right text-paper/70">{row.gamesPlayed}</td>
              <td className="py-1.5 pr-2 text-right text-paper/70">{row.wins}</td>
              <td className="py-1.5 pr-2 text-right text-paper/70">{row.draws}</td>
              <td className="py-1.5 pr-2 text-right text-paper/70">{row.losses}</td>
              <td className="py-1.5 pr-2 text-right text-paper/70">
                {row.vpFor - row.vpAgainst >= 0 ? '+' : ''}
                {row.vpFor - row.vpAgainst}
              </td>
              <td className="py-1.5 text-right font-semibold text-gold">{row.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-paper/40">
        Ranking is Elo: everyone starts at 1500, and each result moves both players' ratings based
        on how big the gap between them was going in -- beat someone much higher-rated and you gain
        a lot, beat someone much lower-rated and you barely move; lose to someone much lower-rated
        and you drop a lot. It's recomputed live by replaying this ladder's whole game history in
        order every time, so editing a score or cancelling a game is always reflected correctly
        here -- nothing needs to be manually recalculated.
      </p>
    </div>
  )
}

/**
 * Every completed game tagged with this ladder (not just the viewer's own -- same visibility as
 * standings), collapsed by default: a busy ladder's full game log would otherwise dump a lot of
 * data onto the standings view the instant its row is opened, so this is a second, nested
 * disclosure the viewer opts into. The row navigates to that game's summary on click/Enter, same
 * as a History row, but isn't itself an `<a>` -- the player names inside are their own links (to
 * `/players/:userId`), and nesting a link inside a link isn't valid HTML, so `stopPropagation` on
 * those (see PlayerNameLink) keeps the two clicks from fighting each other.
 */
function GamesList({ ladderId }: { ladderId: string }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const games = useLadderGames(expanded ? ladderId : undefined)

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-semibold tracking-wide text-paper/60 uppercase hover:text-paper"
      >
        {expanded ? 'Hide games ▲' : 'Show games ▼'}
      </button>
      {expanded && (
        <div className="mt-2">
          {games.isLoading ? (
            <Spinner label="Loading games…" />
          ) : games.isError ? (
            <ErrorBanner message="Couldn't load games." onRetry={() => games.refetch()} />
          ) : !games.data || games.data.length === 0 ? (
            <p className="px-1 py-2 text-sm text-paper/50">No completed games tagged with this ladder yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {games.data.map((g) => (
                <li
                  key={g.gameId}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/game/${g.gameId}/summary`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/game/${g.gameId}/summary`)
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                >
                  <span className="min-w-0 truncate">
                    <PlayerNameLink
                      userId={g.seat1.userId}
                      name={g.seat1.displayName}
                      className={g.outcome === 'seat_1' ? 'font-semibold text-paper' : 'text-paper/70'}
                    />
                    <span className="text-paper/40"> vs </span>
                    <PlayerNameLink
                      userId={g.seat2.userId}
                      name={g.seat2.displayName}
                      className={g.outcome === 'seat_2' ? 'font-semibold text-paper' : 'text-paper/70'}
                    />
                  </span>
                  <span className="flex-shrink-0 text-xs text-paper/50">
                    {g.seat1.vp}-{g.seat2.vp} · {new Date(g.endedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function LadderRow({ ladder, userId }: { ladder: LadderSummary; userId: string }) {
  const [expanded, setExpanded] = useState(false)
  const join = useJoinLadder()
  const leave = useLeaveLadder()

  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium text-paper">{ladder.name}</p>
          <p className="text-xs text-paper/50">
            {ladder.memberCount} member{ladder.memberCount === 1 ? '' : 's'}
            {ladder.isMember ? ' · you’re in' : ''}
          </p>
        </button>
        <Button
          variant={ladder.isMember ? 'secondary' : 'primary'}
          disabled={join.isPending || leave.isPending}
          onClick={() =>
            ladder.isMember
              ? leave.mutate({ ladderId: ladder.id, userId })
              : join.mutate({ ladderId: ladder.id, userId })
          }
        >
          {ladder.isMember ? 'Leave' : 'Join'}
        </Button>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <StandingsTable ladderId={ladder.id} />
          <GamesList ladderId={ladder.id} />
        </div>
      )}
    </li>
  )
}

export function LaddersPage() {
  const { user } = useAuth()
  const ladders = useLadders(user?.id)
  const createLadder = useCreateLadder()
  const [newName, setNewName] = useState('')

  if (ladders.isLoading) return <Spinner label="Loading ladders…" />
  if (ladders.isError) return <ErrorBanner message="Couldn't load ladders." onRetry={() => ladders.refetch()} />
  if (!user) return null

  const mine = (ladders.data ?? []).filter((l) => l.isMember)
  const others = (ladders.data ?? []).filter((l) => !l.isMember)

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    await createLadder.mutateAsync(newName.trim())
    setNewName('')
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-paper">Ladders</h1>
        <p className="mt-1 text-sm text-paper/50">
          Group games into a named ladder to see who's on top. Tag a game as belonging to a ladder when you create
          it -- optional, never required.
        </p>
      </div>

      <form onSubmit={onCreate} className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="Start a new ladder"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. The Thursday Club"
          />
        </div>
        <Button type="submit" disabled={createLadder.isPending || !newName.trim()}>
          {createLadder.isPending ? 'Creating…' : 'Create'}
        </Button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">Your ladders</h2>
        {mine.length === 0 ? (
          <EmptyState title="No ladders yet" description="Create one above, or join one below." />
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((l) => (
              <LadderRow key={l.id} ladder={l} userId={user.id} />
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">Other ladders</h2>
          <ul className="flex flex-col gap-2">
            {others.map((l) => (
              <LadderRow key={l.id} ladder={l} userId={user.id} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

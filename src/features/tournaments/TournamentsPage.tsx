import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  useArchiveTournament,
  useCreateTournament,
  useDeleteTournament,
  useJoinTournamentByCode,
  useLeaveTournament,
  useRegenerateTournamentInviteCode,
  useTournamentGames,
  useTournamentInviteCode,
  useTournaments,
  useTournamentStandings,
  type TournamentSummary,
} from '@/lib/queries/tournaments'

/** Mirrors ladders' own StandingsTable, minus the rating column/ranking-type explainer -- a
 * one-off bounded event has no ongoing skill to track between events, so standings here are just
 * the plain W/D/L + VP-diff tally (see fetchTournamentStandings' own doc comment). */
function StandingsTable({ tournamentId }: { tournamentId: string }) {
  const standings = useTournamentStandings(tournamentId)

  if (standings.isLoading) return <Spinner label="Loading standings…" />
  if (standings.isError) {
    return <ErrorBanner message="Couldn't load standings." onRetry={() => standings.refetch()} />
  }

  if (!standings.data || standings.data.length === 0) {
    return <p className="px-1 py-2 text-sm text-paper/50">No completed games tagged with this tournament yet.</p>
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
            <th className="py-1 text-right">VP diff</th>
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
              <td className="py-1.5 text-right font-semibold text-gold">
                {row.vpFor - row.vpAgainst >= 0 ? '+' : ''}
                {row.vpFor - row.vpAgainst}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Mirrors ladders' own GamesList -- see its doc comment. */
function GamesList({ tournamentId }: { tournamentId: string }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const games = useTournamentGames(expanded ? tournamentId : undefined)

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
            <p className="px-1 py-2 text-sm text-paper/50">No completed games tagged with this tournament yet.</p>
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

/** Mirrors ladders' own InviteCodeSection -- see its doc comment. */
function InviteCodeSection({ tournamentId, isCreator }: { tournamentId: string; isCreator: boolean }) {
  const inviteCode = useTournamentInviteCode(tournamentId)
  const regenerate = useRegenerateTournamentInviteCode(tournamentId)
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    if (!inviteCode.data) return
    try {
      await navigator.clipboard.writeText(inviteCode.data)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard can be denied; the code is still visible on screen regardless
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-paper/60 uppercase">Invite code</p>
      <div className="mt-1.5 flex items-center gap-3">
        <span className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-lg tracking-[0.25em] text-gold">
          {inviteCode.data ?? '······'}
        </span>
        <button
          type="button"
          onClick={copyCode}
          disabled={!inviteCode.data}
          className="text-xs text-paper/50 underline hover:text-paper disabled:opacity-40"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-paper/40">
        Share this with whoever you want to invite -- anyone already in can share it.
      </p>
      {isCreator && (
        <button
          type="button"
          disabled={regenerate.isPending}
          onClick={() => regenerate.mutate()}
          className="mt-2 text-xs text-paper/40 underline hover:text-red-400"
        >
          {regenerate.isPending ? 'Regenerating…' : 'Regenerate code (invalidates the old one)'}
        </button>
      )}
    </div>
  )
}

/** Mirrors ladders' own LadderSettings -- no ranking-type picker (tournaments don't have one). */
function TournamentSettings({
  tournament,
  isCreator,
  onRequestDelete,
}: {
  tournament: TournamentSummary
  isCreator: boolean
  onRequestDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const archive = useArchiveTournament()
  const isArchived = Boolean(tournament.archivedAt)

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-semibold tracking-wide text-paper/60 uppercase hover:text-paper"
      >
        {expanded ? 'Hide settings ▲' : 'Settings ▼'}
      </button>
      {expanded && (
        <div className="mt-3 flex flex-col gap-4">
          <InviteCodeSection tournamentId={tournament.id} isCreator={isCreator} />
          {isCreator && (
            <div className="border-t border-white/10 pt-3">
              <Button
                variant="ghost"
                disabled={archive.isPending}
                onClick={() => archive.mutate({ tournamentId: tournament.id, archived: !isArchived })}
              >
                {archive.isPending ? 'Saving…' : isArchived ? 'Restore tournament' : 'Archive tournament'}
              </Button>
              <p className="mt-1 text-xs text-paper/40">
                {isArchived
                  ? 'Brings it back into the browse list and the "tag this game" picker.'
                  : "Hides it from the browse list and the \"tag this game\" picker -- standings and game history stay exactly as they are, and you can restore it any time."}
              </p>
              <button
                type="button"
                onClick={onRequestDelete}
                className="mt-3 text-xs text-paper/40 underline hover:text-red-400"
              >
                Delete tournament permanently
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatDateRange(startsOn: string | null, endsOn: string | null): string | null {
  if (!startsOn && !endsOn) return null
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (startsOn && endsOn) return startsOn === endsOn ? fmt(startsOn) : `${fmt(startsOn)}–${fmt(endsOn)}`
  return fmt(startsOn ?? endsOn ?? '')
}

function TournamentRow({ tournament, userId }: { tournament: TournamentSummary; userId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false)
  const [joinSheetOpen, setJoinSheetOpen] = useState(false)
  const [code, setCode] = useState('')
  const join = useJoinTournamentByCode()
  const leave = useLeaveTournament()
  const deleteTournament = useDeleteTournament()
  const isCreator = tournament.createdBy === userId
  const isArchived = Boolean(tournament.archivedAt)
  const dateRange = formatDateRange(tournament.startsOn, tournament.endsOn)

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await join.mutateAsync({ tournamentId: tournament.id, code })
      setJoinSheetOpen(false)
      setCode('')
    } catch {
      // error surfaced below via join.error
    }
  }

  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium text-paper">
            {tournament.name}
            {isArchived && <span className="ml-2 text-xs font-normal text-paper/40">Archived</span>}
          </p>
          <p className="text-xs text-paper/50">
            {tournament.memberCount} member{tournament.memberCount === 1 ? '' : 's'}
            {tournament.isMember ? ' · you’re in' : ''}
            {dateRange ? ` · ${dateRange}` : ''}
          </p>
        </button>
        {!isCreator && (
          <Button
            variant={tournament.isMember ? 'secondary' : 'primary'}
            disabled={leave.isPending}
            onClick={() =>
              tournament.isMember ? leave.mutate({ tournamentId: tournament.id, userId }) : setJoinSheetOpen(true)
            }
          >
            {tournament.isMember ? 'Leave' : 'Join'}
          </Button>
        )}
      </div>
      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <StandingsTable tournamentId={tournament.id} />
          <GamesList tournamentId={tournament.id} />
          {(tournament.isMember || isCreator) && (
            <TournamentSettings
              tournament={tournament}
              isCreator={isCreator}
              onRequestDelete={() => setDeleteSheetOpen(true)}
            />
          )}
        </div>
      )}

      <ConfirmSheet
        open={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        onConfirm={async () => {
          try {
            await deleteTournament.mutateAsync(tournament.id)
            setDeleteSheetOpen(false)
          } catch {
            // error already surfaced via toast in useDeleteTournament; keep the sheet open to retry
          }
        }}
        title="Delete this tournament?"
        message="This removes it completely -- standings, its game log link, everything. Games tagged to it aren't deleted, they just stop being tagged to a tournament. This can't be undone; archiving instead keeps all of this reachable and is reversible."
        confirmLabel="Delete tournament"
        pending={deleteTournament.isPending}
      />

      <Sheet open={joinSheetOpen} onClose={() => setJoinSheetOpen(false)} title={`Join ${tournament.name}`}>
        <form onSubmit={onJoin} className="flex flex-col gap-4">
          <p className="text-sm text-paper/50">Ask a member of this tournament for its invite code.</p>
          <TextField
            label="Invite code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="ABC123"
            className="text-center text-2xl tracking-[0.3em]"
            required
          />
          {join.isError && (
            <p className="text-sm text-red-400">
              {join.error instanceof Error ? join.error.message : 'Could not join this tournament.'}
            </p>
          )}
          <Button type="submit" disabled={join.isPending || code.length < 6} fullWidth>
            {join.isPending ? 'Joining…' : 'Join'}
          </Button>
        </form>
      </Sheet>
    </li>
  )
}

export function TournamentsPage() {
  const { user } = useAuth()
  const tournaments = useTournaments(user?.id)
  const createTournament = useCreateTournament()
  const [newName, setNewName] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')

  if (tournaments.isLoading) return <Spinner label="Loading tournaments…" />
  if (tournaments.isError) {
    return <ErrorBanner message="Couldn't load tournaments." onRetry={() => tournaments.refetch()} />
  }
  if (!user) return null

  const active = (tournaments.data ?? []).filter((t) => !t.archivedAt)
  // A creator who somehow isn't a member (see 20260330000000_creator_cannot_leave.sql -- this can
  // only happen for a tournament they left before that migration shipped) still sees it here
  // rather than under "Other tournaments", since it's theirs to manage regardless of membership.
  const mine = active.filter((t) => t.isMember || t.createdBy === user.id)
  const others = active.filter((t) => !t.isMember && t.createdBy !== user.id)
  const archived = (tournaments.data ?? []).filter((t) => t.archivedAt && (t.isMember || t.createdBy === user.id))

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    await createTournament.mutateAsync({
      name: newName.trim(),
      startsOn: startsOn || null,
      endsOn: endsOn || null,
    })
    setNewName('')
    setStartsOn('')
    setEndsOn('')
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-paper">Tournaments</h1>
        <p className="mt-1 text-sm text-paper/50">
          A bounded pool of games -- a single weekend, an event -- with its own standings, separate from an ongoing
          ladder. Tag a game to one when you create it -- optional, never required, and a game can be tagged to a
          ladder and a tournament at the same time.
        </p>
      </div>

      <form onSubmit={onCreate} className="flex flex-col gap-3">
        <TextField
          label="Start a new tournament"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Autumn Assault"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <TextField label="Starts (optional)" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </div>
          <div className="flex-1">
            <TextField label="Ends (optional)" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-paper/40">
          Purely informational -- shown on the card, but never enforced against when a game can be tagged to it.
        </p>
        <Button type="submit" disabled={createTournament.isPending || !newName.trim()}>
          {createTournament.isPending ? 'Creating…' : 'Create'}
        </Button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">Your tournaments</h2>
        {mine.length === 0 ? (
          <EmptyState title="No tournaments yet" description="Create one above, or join one below." />
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((t) => (
              <TournamentRow key={t.id} tournament={t} userId={user.id} />
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">Other tournaments</h2>
          <ul className="flex flex-col gap-2">
            {others.map((t) => (
              <TournamentRow key={t.id} tournament={t} userId={user.id} />
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">Archived</h2>
          <ul className="flex flex-col gap-2">
            {archived.map((t) => (
              <TournamentRow key={t.id} tournament={t} userId={user.id} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

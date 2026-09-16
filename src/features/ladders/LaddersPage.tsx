import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { Select } from '@/components/Select'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  RANKING_TYPE_LABELS,
  useArchiveLadder,
  useCreateLadder,
  useDeleteLadder,
  useJoinLadderByCode,
  useLadderGames,
  useLadderInviteCode,
  useLadders,
  useLadderStandings,
  useLeaveLadder,
  useRegenerateLadderInviteCode,
  useSetLadderRankingType,
  type LadderRankingType,
  type LadderSummary,
} from '@/lib/queries/ladders'

const RANKING_TYPE_EXPLAINERS: Record<LadderRankingType, string> = {
  elo: "Everyone starts at 1500, and each result moves both players' ratings based on how big the gap between them was going in -- beat someone much higher-rated and you gain a lot, beat someone much lower-rated and you barely move; lose to someone much lower-rated and you drop a lot.",
  glicko2:
    "Everyone starts at 1500. Like Elo, each result moves both players' ratings more when the gap between them was bigger going in. Glicko-2 also tracks how established each player's own rating is: a newer or inactive player's rating swings a lot per game, while a well-established player's moves less -- and an established player who suddenly loses to someone lower-rated drops more than they would mid-streak, since their recent form counts too.",
}

function StandingsTable({ ladderId, rankingType }: { ladderId: string; rankingType: LadderRankingType }) {
  const standings = useLadderStandings(ladderId)
  const [showInfo, setShowInfo] = useState(false)

  if (standings.isLoading) return <Spinner label="Loading standings…" />
  if (standings.isError) {
    return <ErrorBanner message="Couldn't load standings." onRetry={() => standings.refetch()} />
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-paper/50">
        <span>
          Ranking: <span className="text-paper">{RANKING_TYPE_LABELS[rankingType]}</span>
        </span>
        <button
          type="button"
          aria-label="How ranking works"
          onClick={() => setShowInfo((v) => !v)}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-paper/30 text-[10px] leading-none text-paper/50 hover:border-paper hover:text-paper"
        >
          i
        </button>
      </div>
      {showInfo && <p className="mb-2 text-xs text-paper/40">{RANKING_TYPE_EXPLAINERS[rankingType]}</p>}
      {!standings.data || standings.data.length === 0 ? (
        <p className="px-1 py-2 text-sm text-paper/50">No completed games tagged with this ladder yet.</p>
      ) : (
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
        </div>
      )}
    </>
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
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false)
  const [joinSheetOpen, setJoinSheetOpen] = useState(false)
  const [code, setCode] = useState('')
  const join = useJoinLadderByCode()
  const leave = useLeaveLadder()
  const deleteLadder = useDeleteLadder()
  const isCreator = ladder.createdBy === userId
  const isArchived = Boolean(ladder.archivedAt)

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await join.mutateAsync({ ladderId: ladder.id, code })
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
            {ladder.name}
            {isArchived && <span className="ml-2 text-xs font-normal text-paper/40">Archived</span>}
          </p>
          <p className="text-xs text-paper/50">
            {ladder.memberCount} member{ladder.memberCount === 1 ? '' : 's'}
            {ladder.isMember ? ' · you’re in' : ''}
          </p>
        </button>
        {!isCreator && (
          <Button
            variant={ladder.isMember ? 'secondary' : 'primary'}
            disabled={leave.isPending}
            onClick={() => (ladder.isMember ? leave.mutate({ ladderId: ladder.id, userId }) : setJoinSheetOpen(true))}
          >
            {ladder.isMember ? 'Leave' : 'Join'}
          </Button>
        )}
      </div>
      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <StandingsTable ladderId={ladder.id} rankingType={ladder.rankingType} />
          <GamesList ladderId={ladder.id} />
          {(ladder.isMember || isCreator) && (
            <LadderSettings ladder={ladder} isCreator={isCreator} onRequestDelete={() => setDeleteSheetOpen(true)} />
          )}
        </div>
      )}

      <ConfirmSheet
        open={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        onConfirm={async () => {
          try {
            await deleteLadder.mutateAsync(ladder.id)
            setDeleteSheetOpen(false)
          } catch {
            // error already surfaced via toast in useDeleteLadder; keep the sheet open to retry
          }
        }}
        title="Delete this ladder?"
        message="This removes it completely -- standings, its game log link, everything. Games tagged to it aren't deleted, they just stop being tagged to a ladder. This can't be undone; archiving instead keeps all of this reachable and is reversible."
        confirmLabel="Delete ladder"
        pending={deleteLadder.isPending}
      />

      <Sheet open={joinSheetOpen} onClose={() => setJoinSheetOpen(false)} title={`Join ${ladder.name}`}>
        <form onSubmit={onJoin} className="flex flex-col gap-4">
          <p className="text-sm text-paper/50">Ask a member of this ladder for its invite code.</p>
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
              {join.error instanceof Error ? join.error.message : 'Could not join this ladder.'}
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

/** Shown to any current member (not just the creator) inside an expanded ladder row -- anyone
 * already in can share the code with whoever they want to invite, same "no single gatekeeper"
 * shape as sharing a game's own join code. Regenerating it, which invalidates whatever the old
 * one was, stays creator-only, same as archiving/deleting the ladder itself. */
function InviteCodeSection({ ladderId, isCreator }: { ladderId: string; isCreator: boolean }) {
  const inviteCode = useLadderInviteCode(ladderId)
  const regenerate = useRegenerateLadderInviteCode(ladderId)
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
        Share this with whoever you want to invite -- anyone already in the ladder can share it.
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

/** Everything about a ladder that isn't the standings themselves -- invite code, and (creator
 * only) ranking type/archive/delete -- tucked behind its own collapsed disclosure so the main
 * thing a member sees on opening a ladder is the actual standings, not a wall of settings. Same
 * "collapsed by default, expand on request" shape as GamesList right above it. Only rendered for
 * a current member (LadderRow), since a non-member has nothing here to see or change. */
function LadderSettings({
  ladder,
  isCreator,
  onRequestDelete,
}: {
  ladder: LadderSummary
  isCreator: boolean
  onRequestDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const archive = useArchiveLadder()
  const setRankingType = useSetLadderRankingType()
  const isArchived = Boolean(ladder.archivedAt)

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
          <InviteCodeSection ladderId={ladder.id} isCreator={isCreator} />
          {isCreator && (
            <div className="border-t border-white/10 pt-3">
              <Select
                label="Ranking type"
                value={ladder.rankingType}
                disabled={setRankingType.isPending}
                onChange={(e) =>
                  setRankingType.mutate({ ladderId: ladder.id, rankingType: e.target.value as LadderRankingType })
                }
              >
                <option value="elo">Elo</option>
                <option value="glicko2">Glicko-2</option>
              </Select>
              <p className="mt-1 text-xs text-paper/40">
                Takes effect immediately -- standings aren't stored, so this just replays the same
                games through the new formula next time they're viewed.
              </p>
              <Button
                variant="ghost"
                className="mt-3"
                disabled={archive.isPending}
                onClick={() => archive.mutate({ ladderId: ladder.id, archived: !isArchived })}
              >
                {archive.isPending ? 'Saving…' : isArchived ? 'Restore ladder' : 'Archive ladder'}
              </Button>
              <p className="mt-1 text-xs text-paper/40">
                {isArchived
                  ? 'Brings it back into the browse list and the "tag this game" picker.'
                  : "Hides it from the browse list and the \"tag this game\" picker -- standings and game history stay exactly as they are, and you can restore it any time."}
              </p>
              <button type="button" onClick={onRequestDelete} className="mt-3 text-xs text-paper/40 underline hover:text-red-400">
                Delete ladder permanently
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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

  const active = (ladders.data ?? []).filter((l) => !l.archivedAt)
  // A creator who somehow isn't a member (see 20260330000000_creator_cannot_leave.sql -- this can
  // only happen for a ladder they left before that migration shipped) still sees it here rather
  // than under "Other ladders", since it's theirs to manage regardless of membership.
  const mine = active.filter((l) => l.isMember || l.createdBy === user.id)
  const others = active.filter((l) => !l.isMember && l.createdBy !== user.id)
  // Archived ladders the viewer's a member of (or created) -- not everyone else's, since an
  // archived ladder is no longer meant to be browsed/joined by people not already in it, unlike
  // the "Other ladders" section above for active ones.
  const archived = (ladders.data ?? []).filter((l) => l.archivedAt && (l.isMember || l.createdBy === user.id))

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

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-paper/60 uppercase">Archived</h2>
          <ul className="flex flex-col gap-2">
            {archived.map((l) => (
              <LadderRow key={l.id} ladder={l} userId={user.id} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

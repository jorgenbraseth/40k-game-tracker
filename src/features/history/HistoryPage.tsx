import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { EmptyState, ErrorBanner, Spinner } from '@/components/Feedback'
import { PlayerNameLink } from '@/components/PlayerNameLink'
import { Select } from '@/components/Select'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDeleteGame, useVerifySeat } from '@/lib/queries/games'
import { type AllGamesRow, useAllCompletedGames } from '@/lib/queries/history'
import { useFactions, useForceDispositions } from '@/lib/queries/referenceData'

/**
 * Every finished game, not just the viewer's own (issue: History used to be silently scoped to
 * "games I'm in" even though the same visibility RLS backing a player's stats page already allows
 * any signed-in user to see any finished game -- see fetchAllCompletedGames' own doc comment).
 * "My games", Ladder, Faction, and Force Disposition are all filters over that same full set, not
 * separate views -- and, like Scoreboard's round and this page's own pre-existing ladder filter,
 * they're distinct *views* worth bookmarking/sharing/stepping back through, so they live in the
 * URL rather than component state.
 */
export function HistoryPage() {
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useAllCompletedGames()
  const factions = useFactions()
  const forceDispositions = useForceDispositions()
  const deleteGame = useDeleteGame()
  const [cancelingGameId, setCancelingGameId] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const mineOnly = searchParams.get('mine') === '1'
  const ladderFilter = searchParams.get('ladder') ?? ''
  const factionFilter = searchParams.get('faction') ?? ''
  const dispositionFilter = searchParams.get('disposition') ?? ''

  const setFilter = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  const setMineOnly = (value: boolean) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('mine', '1')
        else next.delete('mine')
        return next
      },
      { replace: true },
    )
  }

  const ladderOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const game of data ?? []) {
      if (game.ladderId) byId.set(game.ladderId, game.ladderName ?? 'Unknown ladder')
    }
    return [...byId.entries()]
  }, [data])

  if (isLoading) return <Spinner label="Loading history…" />
  if (isError) return <ErrorBanner message="Couldn't load game history." onRetry={() => refetch()} />
  if (!data || data.length === 0) {
    return <EmptyState title="No finished games yet" description="Completed games will show up here." />
  }

  const isMine = (game: AllGamesRow) =>
    Boolean(user?.id) && (game.seat1.userId === user?.id || game.seat2.userId === user?.id)

  const visible = data.filter((game) => {
    if (mineOnly && !isMine(game)) return false
    if (ladderFilter && game.ladderId !== ladderFilter) return false
    if (factionFilter && game.seat1.factionId !== factionFilter && game.seat2.factionId !== factionFilter) return false
    if (
      dispositionFilter &&
      game.seat1.forceDispositionId !== dispositionFilter &&
      game.seat2.forceDispositionId !== dispositionFilter
    )
      return false
    return true
  })

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-paper">History</h1>
      <p className="text-sm text-paper/50">Every finished game, from everyone -- filter down to your own below.</p>

      <label className="flex min-h-11 items-center gap-2 text-sm text-paper/80">
        <input
          type="checkbox"
          checked={mineOnly}
          onChange={(e) => setMineOnly(e.target.checked)}
          className="h-4 w-4 flex-shrink-0 accent-gold"
        />
        My games only
      </label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ladderOptions.length > 0 && (
          <Select label="Ladder" value={ladderFilter} onChange={(e) => setFilter('ladder', e.target.value)}>
            <option value="">All ladders</option>
            {ladderOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Faction" value={factionFilter} onChange={(e) => setFilter('faction', e.target.value)}>
          <option value="">All factions</option>
          {factions.data?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <Select
          label="Force Disposition"
          value={dispositionFilter}
          onChange={(e) => setFilter('disposition', e.target.value)}
        >
          <option value="">All dispositions</option>
          {forceDispositions.data?.map((fd) => (
            <option key={fd.id} value={fd.id}>
              {fd.name}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 && (
        <EmptyState title="No games match these filters" description="Try clearing a filter." />
      )}

      <ul className="flex flex-col gap-2">
        {visible.map((game) => (
          <HistoryGameRow
            key={game.gameId}
            game={game}
            userId={user?.id}
            onCancel={() => setCancelingGameId(game.gameId)}
          />
        ))}
      </ul>

      <ConfirmSheet
        open={cancelingGameId !== null}
        onClose={() => setCancelingGameId(null)}
        onConfirm={async () => {
          if (!cancelingGameId) return
          try {
            await deleteGame.mutateAsync(cancelingGameId)
            setCancelingGameId(null)
          } catch {
            // error already surfaced via toast in useDeleteGame; keep the sheet open to retry
          }
        }}
        title="Cancel this game?"
        message="This removes it completely for both players -- scores, setup, everything, from both your histories. This can't be undone."
        confirmLabel="Cancel game"
        pending={deleteGame.isPending}
      />
    </div>
  )
}

/**
 * One shape for every row, regardless of whether the viewer played in it -- the same "seat1 vs
 * seat2, winner bolded" layout `LaddersPage`'s own game list already uses, not a
 * "vs opponent"/mine-first framing that only applied to the viewer's own games. Deliberately
 * unpersonalized: a game the viewer played shouldn't look different from one they didn't.
 *
 * Factions lead, players follow: this is a browse-all-games view, so which armies fought is the
 * primary thing being scanned for, and who played them is secondary detail underneath. The faction
 * line therefore carries the winner-bold treatment and the player-name line is a plain, dimmer row
 * beneath it (and, since `PlayerNameLink` renders its own `<a>`, it stays outside the summary
 * `Link` below rather than nested inside it).
 *
 * Cancel and Verify are the one exception -- gated on the viewer actually holding a seat (their
 * own account, or a ladder member they solo-entered on behalf of), since those aren't a framing
 * choice, they're real actions only a participant can take at all (RLS backs this up server-side
 * regardless, so this is just not offering a button that would fail).
 *
 * The whole row navigates to the game's summary on click/Enter (not just the meta/VP line) --
 * same `role="link"`/`navigate` pattern as `LaddersPage`'s `GamesList` row, rather than an `<a>`,
 * since `PlayerNameLink` inside already renders its own `<a>` and nesting anchors isn't valid
 * HTML. The trash and Verify buttons stop propagation so they don't also trigger the navigation.
 */
function HistoryGameRow({
  game,
  userId,
  onCancel,
}: {
  game: AllGamesRow
  userId: string | undefined
  onCancel: () => void
}) {
  const verifySeat = useVerifySeat(game.gameId)
  const navigate = useNavigate()
  const endedAt = new Date(game.endedAt).toLocaleDateString()

  const mySeat =
    userId && game.seat1.userId === userId ? game.seat1 : userId && game.seat2.userId === userId ? game.seat2 : null
  const unverifiedOtherSeat = [game.seat1, game.seat2].find(
    (s) => s.needsVerification && s.gamePlayerId !== mySeat?.gamePlayerId,
  )
  const goToSummary = () => navigate(`/game/${game.gameId}/summary`)

  return (
    <li
      role="link"
      tabIndex={0}
      onClick={goToSummary}
      onKeyDown={(e) => {
        if (e.key === 'Enter') goToSummary()
      }}
      className="cursor-pointer rounded-xl border border-veil-strong bg-veil hover:bg-veil-strong"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <p className="min-w-0 truncate text-sm text-paper">
          <span className={game.outcome === 'seat_1' ? 'font-semibold text-paper' : 'text-paper/70'}>
            {game.seat1.factionName ?? 'No faction'}
          </span>
          <span className="text-paper/40"> vs </span>
          <span className={game.outcome === 'seat_2' ? 'font-semibold text-paper' : 'text-paper/70'}>
            {game.seat2.factionName ?? 'No faction'}
          </span>
        </p>
        {mySeat && !game.isLocked && (
          <button
            type="button"
            aria-label="Cancel game"
            onClick={(e) => {
              e.stopPropagation()
              onCancel()
            }}
            className="flex-shrink-0 text-paper/40 hover:text-danger"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
        )}
      </div>
      <p className="min-w-0 truncate px-4 pt-0.5 text-xs text-paper/50">
        <PlayerNameLink userId={game.seat1.userId} name={game.seat1.displayName} avatarUrl={game.seat1.avatarUrl} />
        <span className="text-paper/30"> vs </span>
        <PlayerNameLink userId={game.seat2.userId} name={game.seat2.displayName} avatarUrl={game.seat2.avatarUrl} />
      </p>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1.5">
        <p className="min-w-0 truncate text-xs text-paper/50">
          {game.pointsLimit} pts · {endedAt}
          {game.ladderName ? ` · ${game.ladderName}` : ''}
          {game.status === 'abandoned' ? ' · Abandoned' : ''}
          {game.isLocked ? ' · Locked' : ''}
        </p>
        <span className="flex-shrink-0 text-sm text-paper/50">
          {game.seat1.totalVp}-{game.seat2.totalVp}
        </span>
      </div>
      {mySeat?.needsVerification && userId && (
        <div className="flex items-center justify-between gap-2 border-t border-veil-strong px-4 py-2">
          <p className="text-[11px] text-paper/40">Entered on your behalf -- does this look right?</p>
          <Button
            variant="secondary"
            disabled={verifySeat.isPending}
            onClick={(e) => {
              e.stopPropagation()
              verifySeat.mutate({ gamePlayerId: mySeat.gamePlayerId, userId })
            }}
          >
            {verifySeat.isPending ? 'Verifying…' : 'Verify'}
          </Button>
        </div>
      )}
      {!mySeat?.needsVerification && unverifiedOtherSeat && (
        <p className="border-t border-veil-strong px-4 py-2 text-[11px] text-paper/40">
          Unverified -- awaiting {unverifiedOtherSeat.displayName}'s confirmation
        </p>
      )}
    </li>
  )
}

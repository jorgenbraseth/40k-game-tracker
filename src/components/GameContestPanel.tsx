import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ReasonSheet } from '@/components/ReasonSheet'
import { useContestGame, useWithdrawGameContest, type GameDetail } from '@/lib/queries/games'

/**
 * Contest state for a ladder game, on its summary (see 20260928000000_game_contests.sql). A
 * recorded result counts as-is -- nobody has to confirm anything. This panel only appears when
 * there's something to say or do:
 *
 * - an invalidation (public): the ladder admin removed this game from that ladder's standings,
 *   with their reason;
 * - an open contest (only the game's players and the ladder admin can see these, via RLS);
 * - a "Contest this result" action, for a player holding a seat (their own, or one attributed to
 *   them) while at least one of the game's ladders has neither an open contest nor an
 *   invalidation.
 *
 * Resolving a contest (dismiss / invalidate) happens on the Ladders page, where the admin sees
 * every open contest for their ladder in one place -- here they just get a pointer to it.
 */
export function GameContestPanel({ detail, userId }: { detail: GameDetail; userId: string | undefined }) {
  const contest = useContestGame(detail.game.id)
  const withdraw = useWithdrawGameContest(detail.game.id)
  const [sheetOpen, setSheetOpen] = useState(false)

  const ladderById = new Map(detail.ladders.map((l) => [l.id, l]))
  const ladderName = (ladderId: string) => ladderById.get(ladderId)?.name ?? 'Unknown ladder'
  const personName = (id: string) => (id === userId ? 'you' : (detail.profileNames[id] ?? 'Someone'))

  const isSeatHolder =
    Boolean(userId) &&
    detail.players.some((p) => p.player.user_id === userId || p.player.represents_user_id === userId)
  const invalidatedLadderIds = new Set(detail.invalidations.map((i) => i.ladder_id))
  const contestedLadderIds = new Set(detail.pendingContests.map((c) => c.ladder_id))
  const canContest =
    isSeatHolder &&
    detail.ladderIds.some((id) => !invalidatedLadderIds.has(id) && !contestedLadderIds.has(id))
  const iHaveOpenContest = detail.pendingContests.some((c) => c.contested_by === userId)

  if (detail.invalidations.length === 0 && detail.pendingContests.length === 0 && !canContest) return null

  return (
    <div className="flex flex-col gap-2">
      {detail.invalidations.map((inv) => (
        <div key={inv.ladder_id} className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <p className="text-paper/80">
            <span className="font-medium text-danger">Invalidated on {ladderName(inv.ladder_id)}. </span>
            Doesn't count toward that ladder's standings.
          </p>
          <p className="mt-1 text-paper/60">
            “{inv.reason}” -- {personName(inv.invalidated_by)}, {new Date(inv.invalidated_at).toLocaleDateString()}
          </p>
        </div>
      ))}

      {detail.pendingContests.map((c) => {
        const iAmAdmin = Boolean(userId) && ladderById.get(c.ladder_id)?.createdBy === userId
        return (
          <div key={c.id} className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm">
            <p className="text-paper/80">
              <span className="font-medium text-gold">Contested on {ladderName(c.ladder_id)} </span>
              by {personName(c.contested_by)}.
            </p>
            <p className="mt-1 text-paper/60">“{c.reason}”</p>
            <p className="mt-1 text-xs text-paper/50">
              {iAmAdmin ? (
                <>
                  You're this ladder's admin --{' '}
                  <Link to="/ladders" className="underline hover:text-paper">
                    review it on the Ladders page
                  </Link>
                  .
                </>
              ) : (
                "Still counts until the ladder's admin decides otherwise."
              )}
            </p>
          </div>
        )
      })}

      {iHaveOpenContest && (
        <Button
          type="button"
          variant="ghost"
          disabled={withdraw.isPending}
          onClick={() => withdraw.mutate()}
          className="self-start text-sm"
        >
          {withdraw.isPending ? 'Withdrawing…' : 'Withdraw my contest'}
        </Button>
      )}

      {canContest && (
        <div className="flex flex-col items-center gap-1">
          <Button type="button" variant="ghost" onClick={() => setSheetOpen(true)} className="text-sm">
            Contest this result
          </Button>
        </div>
      )}

      <ReasonSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={(reason) => contest.mutateAsync(reason)}
        title="Contest this result?"
        message="The result keeps counting for now. The ladder's admin will see your contest and can remove the game from the ladder if it's wrong."
        label="What's wrong with it?"
        placeholder="e.g. the scores are swapped, we never played this game…"
        submitLabel="Contest"
        pending={contest.isPending}
      />
    </div>
  )
}

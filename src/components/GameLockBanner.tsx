import { Button } from '@/components/Button'
import {
  isGameLocked,
  playerLabel,
  useApproveGameUnlockRequest,
  useCancelGameUnlockRequest,
  useRejectGameUnlockRequest,
  useRequestGameUnlock,
  type GameDetail,
} from '@/lib/queries/games'

/**
 * Issue #72: once both seats in a game have confirmed its result, neither player can unilaterally
 * change or delete it any more (enforced server-side via RLS -- see
 * 20260402000000_verified_game_lock.sql -- this banner is purely the UI for that, never the
 * boundary itself). Shown in both Scoreboard (where an edit would otherwise just silently fail to
 * save) and SummaryPage (where the confirm-result action itself lives).
 *
 * Unlocking is propose/approve, not a diff: one participant requests it, and either the *other*
 * participant or a ladder admin for a ladder this game is tagged to (dispute-resolution override,
 * for when the other player simply won't respond) approves it. Approval's only effect is clearing
 * both seats' verifications, which is the entire "unlock" -- there's no separate unlocked state to
 * show once that happens, this banner just stops rendering (isGameLocked goes false and there's no
 * longer a pending request either).
 */
export function GameLockBanner({ detail, userId }: { detail: GameDetail; userId: string | undefined }) {
  const locked = isGameLocked(detail.players, detail.verifications)
  const request = detail.pendingUnlockRequest
  const requestUnlock = useRequestGameUnlock(detail.game.id)
  const approve = useApproveGameUnlockRequest(detail.game.id)
  const reject = useRejectGameUnlockRequest(detail.game.id)
  const cancel = useCancelGameUnlockRequest(detail.game.id)

  if (!locked && !request) return null

  const isParticipant = Boolean(userId) && detail.players.some((p) => p.player.user_id === userId)
  const isAdmin = Boolean(userId) && detail.ladderAdminIds.includes(userId as string)
  const requester = request ? detail.players.find((p) => p.player.user_id === request.requested_by) : undefined
  const iAmRequester = Boolean(request) && request?.requested_by === userId
  const canResolve = Boolean(request) && !iAmRequester && (isParticipant || isAdmin)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm">
      <p className="text-paper/80">
        <span className="font-medium text-gold">Locked. </span>
        Both players confirmed this result -- editing or deleting it now needs the other player's
        (or a ladder admin's) sign-off.
      </p>

      {!request && isParticipant && (
        <Button
          type="button"
          variant="secondary"
          disabled={requestUnlock.isPending}
          onClick={() => requestUnlock.mutate()}
          className="self-start"
        >
          {requestUnlock.isPending ? 'Requesting…' : 'Request permission to edit'}
        </Button>
      )}

      {request && iAmRequester && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-paper/60">Waiting for the other player (or a ladder admin) to respond.</p>
          <Button
            type="button"
            variant="ghost"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(request.id)}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel request'}
          </Button>
        </div>
      )}

      {request && !iAmRequester && (
        <div className="flex flex-col gap-2">
          <p className="text-paper/60">
            {playerLabel(requester, 'The other player')} requested permission to edit this result.
          </p>
          {canResolve && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={approve.isPending}
                onClick={() => approve.mutate(request.id)}
              >
                {approve.isPending ? 'Approving…' : 'Approve'}
              </Button>
              <Button type="button" variant="ghost" disabled={reject.isPending} onClick={() => reject.mutate(request.id)}>
                {reject.isPending ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

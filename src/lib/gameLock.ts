import type { Database, GameStatus } from '@/lib/database.types'

type GamePlayerRow = Database['public']['Tables']['game_players']['Row']
type VerificationRow = Database['public']['Tables']['game_player_verifications']['Row']

/**
 * Pure logic split out of src/lib/queries/games.ts so it's importable from a unit test without
 * dragging in supabase.ts -- that module reads import.meta.env at import time (see
 * src/lib/env.ts) and throws when the Supabase env vars aren't set, which they deliberately
 * aren't for the plain `npm run test` CI step (only the later build step supplies them). games.ts
 * re-exports both functions below, so every existing call site keeps importing them from
 * '@/lib/queries/games' unchanged.
 *
 * A seat's result hasn't been confirmed by whoever's actually behind it yet: a claimed seat's own
 * occupant (user_id), or -- for a still-unclaimed, solo-entered seat -- the real ladder member it
 * was attributed to (represents_user_id, issue #46's original case). Either way the game has to
 * have actually finished (verifying a still-in-progress score is premature) and nobody's verified
 * it yet. A seat with neither -- unclaimed and unattributed -- is never "unverified": there's
 * nobody who could confirm it.
 *
 * Once *every* seat in a game has been verified this way, the game becomes locked (issue #72):
 * see is_game_fully_verified() in 20260402000000_verified_game_lock.sql.
 */
export function needsVerification(
  entry: { player: GamePlayerRow },
  gameStatus: GameStatus,
  verifications: VerificationRow[],
): boolean {
  return (
    Boolean(entry.player.user_id ?? entry.player.represents_user_id) &&
    (gameStatus === 'complete' || gameStatus === 'abandoned') &&
    !verifications.some((v) => v.game_player_id === entry.player.id)
  )
}

/** True once every seat in the game has a verification row -- see is_game_fully_verified() in
 * 20260402000000_verified_game_lock.sql, which this mirrors client-side purely for UI gating (the
 * database function is what actually enforces the lock, via RLS -- this is never a security
 * boundary on its own). */
export function isGameLocked(players: { player: GamePlayerRow }[], verifications: VerificationRow[]): boolean {
  return players.length > 0 && players.every((p) => verifications.some((v) => v.game_player_id === p.player.id))
}

import { useSyncExternalStore } from 'react'

/**
 * Edit mode for a finished game: an explicit Edit → change things → Save / Cancel, so just
 * looking at an old game can't accidentally change it.
 *
 * Every game mutation hook in games.ts already applies its change to the query cache
 * optimistically before writing to the database. While a draft is open for a game, the hooks keep
 * doing the optimistic cache patch but hand their database write to `writeOrQueue`, which parks it
 * here instead of running it. So the screen shows the edited game exactly as it will look once
 * saved, while nothing has reached the server yet:
 *
 * - **Save** (`commitDraft`) replays the queued writes in the order they were made -- the same
 *   writes, in the same order, that would have run live -- then closes the draft.
 * - **Cancel** (`discardDraft`) drops the queue; the caller refetches the game to throw away the
 *   optimistic edits.
 *
 * While drafting, nothing may refetch the game over the top of the unsaved edits: the mutation
 * hooks' own post-write invalidation goes through `settleGame`-style guards, the realtime channel
 * skips its invalidation, and `useGame` stops refetching on focus/reconnect/mount (see games.ts and
 * useGameChannel.ts). The flip side is that the other player's changes made during your edit
 * aren't shown until you save or cancel -- and saving writes your values over theirs, same
 * last-write-wins as live editing.
 *
 * Module-level rather than React state, since the mutation hooks (not components) are the ones
 * that need to consult it, and a draft only ever lives for one open Scoreboard in one tab.
 */
type Write = () => Promise<void>

const queues = new Map<string, Write[]>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function isDrafting(gameId: string): boolean {
  return queues.has(gameId)
}

/** Read at call time rather than render time -- for checks that run outside React's render
 * cycle, like a navigation blocker firing right after the draft was discarded. */
export function hasPendingChanges(gameId: string): boolean {
  return (queues.get(gameId)?.length ?? 0) > 0
}

export function startDraft(gameId: string) {
  if (queues.has(gameId)) return
  queues.set(gameId, [])
  emit()
}

/** Runs the write now, or -- while this game has an open draft -- queues it for Save. */
export function writeOrQueue(gameId: string, write: Write): Promise<void> {
  const queue = queues.get(gameId)
  if (!queue) return write()
  queue.push(write)
  emit()
  return Promise.resolve()
}

/** Sends every queued write in order, then closes the draft. On a failure the failed write and
 * everything after it stay queued (and the draft stays open), so Save can simply be retried. */
export async function commitDraft(gameId: string) {
  const queue = queues.get(gameId)
  if (!queue) return
  while (queue.length > 0) {
    await queue[0]()
    queue.shift()
    emit()
  }
  queues.delete(gameId)
  emit()
}

export function discardDraft(gameId: string) {
  if (!queues.delete(gameId)) return
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether this game has an open draft, and how many unsaved writes it holds. */
export function useGameDraft(gameId: string | undefined): { drafting: boolean; pendingChanges: number } {
  // A single number as the snapshot (-1 = no draft) keeps useSyncExternalStore's identity check
  // trivially stable.
  const snapshot = useSyncExternalStore(subscribe, () => (gameId ? (queues.get(gameId)?.length ?? -1) : -1))
  return { drafting: snapshot >= 0, pendingChanges: Math.max(snapshot, 0) }
}

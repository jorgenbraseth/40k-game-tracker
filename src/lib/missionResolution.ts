import type { Database } from './database.types'

type MissionPairingRow = Pick<
  Database['public']['Tables']['missions']['Row'],
  'id' | 'force_disposition_id' | 'opponent_force_disposition_id'
>

/**
 * Mirrors resolve_game_mission() (the server-side RPC) exactly: a mission is keyed by (this
 * seat's own Force Disposition, the opponent's) -- asymmetric, so swapping the two sides can (and
 * usually does) point at a different mission. Used to optimistically predict each seat's mission
 * the instant both Force Dispositions are known, instead of waiting on the RPC round trip before
 * anything that depends on it (the terrain layout picker, the primary scoring checklist) can show.
 */
export function resolveMissionId(
  missions: MissionPairingRow[],
  myForceDispositionId: string | null,
  opponentForceDispositionId: string | null,
): string | null {
  if (!myForceDispositionId || !opponentForceDispositionId) return null
  return (
    missions.find(
      (m) =>
        m.force_disposition_id === myForceDispositionId &&
        m.opponent_force_disposition_id === opponentForceDispositionId,
    )?.id ?? null
  )
}

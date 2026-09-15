import { useQuery } from '@tanstack/react-query'
import { needsVerification } from '@/lib/queries/games'
import { supabase } from '@/lib/supabase'

export interface CompletedGameRow {
  gameId: string
  endedAt: string
  /** The current user's own Primary Mission -- each player has their own, see resolve_game_mission(). */
  missionName: string
  opponentMissionName: string
  pointsLimit: number
  mySeat: 1 | 2
  myGamePlayerId: string
  myFactionName: string | null
  myArmyName: string | null
  myTotalVp: number
  opponentName: string
  /** The account behind opponentName, if there is one (their own, or whoever an unclaimed seat
   * was attributed to) -- null when there's nobody to link to (unclaimed and unattributed). */
  opponentUserId: string | null
  opponentFactionName: string | null
  opponentTotalVp: number
  result: 'win' | 'loss' | 'draw' | 'abandoned'
  ladderId: string | null
  ladderName: string | null
  /** True when this game was solo-entered on the viewer's behalf and the viewer hasn't confirmed
   * it yet (issue #46) -- HistoryPage offers a "Verify" action right on the row for this. */
  needsMyVerification: boolean
  /** True when the *opponent's* seat is the one still awaiting their confirmation -- informational
   * only, the viewer can't act on someone else's verification. */
  opponentUnverified: boolean
}

export const historyKeys = {
  list: (userId: string) => ['history', userId] as const,
}

export async function fetchCompletedGames(userId: string): Promise<CompletedGameRow[]> {
  // A game counts as this user's own if they claimed a seat directly (user_id), or -- for a
  // solo-bookkept game -- if a bookkeeper attributed an unclaimed seat to them
  // (represents_user_id), same identity resolution fetchLadderStandings already uses. Two
  // separate queries rather than a single .or() filter, since this codebase doesn't otherwise
  // build raw PostgREST filter strings and userId can come straight from a route param.
  const [ownSeatRows, representedSeatRows] = await Promise.all([
    supabase.from('game_players').select('game_id').eq('user_id', userId),
    supabase.from('game_players').select('game_id').eq('represents_user_id', userId),
  ])
  if (ownSeatRows.error) throw ownSeatRows.error
  if (representedSeatRows.error) throw representedSeatRows.error

  const gameIds = [...new Set([...ownSeatRows.data, ...representedSeatRows.data].map((r) => r.game_id))]
  if (gameIds.length === 0) return []

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .in('id', gameIds)
    .in('status', ['complete', 'abandoned'])
    .order('ended_at', { ascending: false })
  if (gamesError) throw gamesError
  if (games.length === 0) return []

  const completeGameIds = games.map((g) => g.id)
  const ladderIds = [...new Set(games.map((g) => g.ladder_id).filter((id): id is string => Boolean(id)))]

  const [playersRes, totalsRes, laddersRes, verificationsRes] = await Promise.all([
    supabase.from('game_players').select('*').in('game_id', completeGameIds),
    supabase.from('game_totals').select('*').in('game_id', completeGameIds),
    ladderIds.length
      ? supabase.from('ladders').select('id, name').in('id', ladderIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('game_player_verifications').select('*').in('game_id', completeGameIds),
  ])
  if (playersRes.error) throw playersRes.error
  if (totalsRes.error) throw totalsRes.error
  if (laddersRes.error) throw laddersRes.error
  if (verificationsRes.error) throw verificationsRes.error

  const missionIds = [
    ...new Set(playersRes.data.map((p) => p.mission_id).filter((id): id is string => Boolean(id))),
  ]
  const missionsRes = missionIds.length
    ? await supabase.from('missions').select('id, name').in('id', missionIds)
    : { data: [], error: null }
  if (missionsRes.error) throw missionsRes.error

  const profileIds = [
    ...new Set(
      playersRes.data.flatMap((p) => [p.user_id, p.represents_user_id]).filter((id): id is string => Boolean(id)),
    ),
  ]
  const factionIds = [...new Set(playersRes.data.map((p) => p.faction_id).filter((id): id is string => Boolean(id)))]

  const [profilesRes, factionsRes] = await Promise.all([
    profileIds.length
      ? supabase.from('profiles').select('id, display_name').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
    factionIds.length
      ? supabase.from('factions').select('id, name').in('id', factionIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (profilesRes.error) throw profilesRes.error
  if (factionsRes.error) throw factionsRes.error

  const missionById = new Map(missionsRes.data.map((m) => [m.id, m.name]))
  const ladderById = new Map(laddersRes.data?.map((l) => [l.id, l.name]))
  const profileById = new Map(profilesRes.data?.map((p) => [p.id, p.display_name]))
  const factionById = new Map(factionsRes.data?.map((f) => [f.id, f.name]))
  const totalByPlayerId = new Map(totalsRes.data.map((t) => [t.game_player_id, t.total_vp]))
  const playersByGameId = new Map<string, typeof playersRes.data>()
  for (const p of playersRes.data) {
    const list = playersByGameId.get(p.game_id) ?? []
    list.push(p)
    playersByGameId.set(p.game_id, list)
  }

  const rows: CompletedGameRow[] = []
  for (const game of games) {
    const players = playersByGameId.get(game.id) ?? []
    const me = players.find((p) => p.user_id === userId || p.represents_user_id === userId)
    if (!me) continue
    const opponent = players.find((p) => p.id !== me.id)
    if (!game.outcome && game.status !== 'abandoned') continue

    const result: CompletedGameRow['result'] = !game.outcome
      ? 'abandoned'
      : game.outcome === 'draw'
        ? 'draw'
        : game.outcome === `seat_${me.seat}`
          ? 'win'
          : 'loss'

    rows.push({
      gameId: game.id,
      endedAt: game.ended_at ?? game.created_at,
      missionName: (me.mission_id && missionById.get(me.mission_id)) || 'Unknown mission',
      opponentMissionName: (opponent?.mission_id && missionById.get(opponent.mission_id)) || 'Unknown mission',
      pointsLimit: game.points_limit,
      mySeat: me.seat,
      myGamePlayerId: me.id,
      myFactionName: me.faction_id ? (factionById.get(me.faction_id) ?? null) : null,
      myArmyName: me.army_name,
      myTotalVp: totalByPlayerId.get(me.id) ?? 0,
      opponentName: !opponent
        ? 'No opponent'
        : opponent.user_id
          ? (profileById.get(opponent.user_id) ?? 'Unknown opponent')
          : opponent.represents_user_id
            ? (profileById.get(opponent.represents_user_id) ?? 'Unknown opponent')
            : opponent.army_name || 'Unnamed opponent',
      opponentUserId: opponent ? (opponent.user_id ?? opponent.represents_user_id ?? null) : null,
      opponentFactionName: opponent?.faction_id ? (factionById.get(opponent.faction_id) ?? null) : null,
      opponentTotalVp: opponent ? (totalByPlayerId.get(opponent.id) ?? 0) : 0,
      result,
      ladderId: game.ladder_id,
      ladderName: game.ladder_id ? (ladderById.get(game.ladder_id) ?? 'Unknown ladder') : null,
      needsMyVerification: needsVerification({ player: me }, game.status, verificationsRes.data),
      opponentUnverified: opponent
        ? needsVerification({ player: opponent }, game.status, verificationsRes.data)
        : false,
    })
  }

  return rows
}

export function useCompletedGames(userId: string | undefined) {
  return useQuery({
    queryKey: historyKeys.list(userId ?? ''),
    queryFn: () => fetchCompletedGames(userId as string),
    enabled: Boolean(userId),
  })
}

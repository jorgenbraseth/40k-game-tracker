import { useQuery } from '@tanstack/react-query'
import { isGameLocked, needsVerification } from '@/lib/queries/games'
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
  myForceDispositionName: string | null
  myArmyName: string | null
  myTotalVp: number
  opponentName: string
  /** The account behind opponentName, if there is one (their own, or whoever an unclaimed seat
   * was attributed to) -- null when there's nobody to link to (unclaimed and unattributed). */
  opponentUserId: string | null
  opponentAvatarUrl: string | null
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

export interface HistoryGameSeat {
  gamePlayerId: string
  /** The account behind this seat, if any -- their own, or whoever an unclaimed seat was
   * attributed to -- null when there's nobody to link to. */
  userId: string | null
  displayName: string
  avatarUrl: string | null
  factionId: string | null
  factionName: string | null
  forceDispositionId: string | null
  forceDispositionName: string | null
  armyName: string | null
  missionName: string
  totalVp: number
  needsVerification: boolean
}

export interface AllGamesRow {
  gameId: string
  endedAt: string
  pointsLimit: number
  seat1: HistoryGameSeat
  seat2: HistoryGameSeat
  /** null means the game was abandoned rather than actually finishing with a result. */
  outcome: 'seat_1' | 'seat_2' | 'draw' | null
  status: 'complete' | 'abandoned'
  ladderId: string | null
  ladderName: string | null
  /** True once both seats have confirmed this result -- locked (issue #72), so History no longer
   * offers Cancel for it; editing/deleting it needs the unlock-request flow on Scoreboard/Summary
   * instead. Mirrors isGameLocked()/is_game_fully_verified() -- see those for what "confirmed"
   * means for each kind of seat. */
  isLocked: boolean
}

export const historyKeys = {
  list: (userId: string) => ['history', userId] as const,
  all: ['history', 'all'] as const,
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

  const [playersRes, totalsRes, gameLaddersRes, verificationsRes] = await Promise.all([
    supabase.from('game_players').select('*').in('game_id', completeGameIds),
    supabase.from('game_totals').select('*').in('game_id', completeGameIds),
    supabase.from('game_ladders').select('game_id, ladder_id').in('game_id', completeGameIds),
    supabase.from('game_player_verifications').select('*').in('game_id', completeGameIds),
  ])
  if (playersRes.error) throw playersRes.error
  if (totalsRes.error) throw totalsRes.error
  if (gameLaddersRes.error) throw gameLaddersRes.error
  if (verificationsRes.error) throw verificationsRes.error

  // A game can be tagged to more than one ladder now (issue #75), but this row still only ever
  // shows one -- the filter/display here hasn't grown a multi-value UI yet, so this just takes the
  // first tag per game, same single-ladder-per-row shape as before.
  const ladderIdByGameId = new Map(gameLaddersRes.data.map((r) => [r.game_id, r.ladder_id]))
  const ladderIds = [...new Set(gameLaddersRes.data.map((r) => r.ladder_id))]
  const laddersRes = ladderIds.length
    ? await supabase.from('ladders').select('id, name').in('id', ladderIds)
    : { data: [], error: null }
  if (laddersRes.error) throw laddersRes.error

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
  const forceDispositionIds = [
    ...new Set(playersRes.data.map((p) => p.force_disposition_id).filter((id): id is string => Boolean(id))),
  ]

  const [profilesRes, factionsRes, forceDispositionsRes] = await Promise.all([
    profileIds.length
      ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
    factionIds.length
      ? supabase.from('factions').select('id, name').in('id', factionIds)
      : Promise.resolve({ data: [], error: null }),
    forceDispositionIds.length
      ? supabase.from('force_dispositions').select('id, name').in('id', forceDispositionIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (profilesRes.error) throw profilesRes.error
  if (factionsRes.error) throw factionsRes.error
  if (forceDispositionsRes.error) throw forceDispositionsRes.error

  const missionById = new Map(missionsRes.data.map((m) => [m.id, m.name]))
  const ladderById = new Map(laddersRes.data?.map((l) => [l.id, l.name]))
  const profileById = new Map(profilesRes.data?.map((p) => [p.id, p.display_name]))
  const avatarByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.avatar_url]))
  const factionById = new Map(factionsRes.data?.map((f) => [f.id, f.name]))
  const forceDispositionById = new Map(forceDispositionsRes.data?.map((fd) => [fd.id, fd.name]))
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
      myForceDispositionName: me.force_disposition_id ? (forceDispositionById.get(me.force_disposition_id) ?? null) : null,
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
      opponentAvatarUrl: (() => {
        const opponentUserId = opponent ? (opponent.user_id ?? opponent.represents_user_id ?? null) : null
        return opponentUserId ? (avatarByUserId.get(opponentUserId) ?? null) : null
      })(),
      opponentFactionName: opponent?.faction_id ? (factionById.get(opponent.faction_id) ?? null) : null,
      opponentTotalVp: opponent ? (totalByPlayerId.get(opponent.id) ?? 0) : 0,
      result,
      ladderId: ladderIdByGameId.get(game.id) ?? null,
      ladderName: (() => {
        const ladderId = ladderIdByGameId.get(game.id)
        return ladderId ? (ladderById.get(ladderId) ?? 'Unknown ladder') : null
      })(),
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

/** Every finished game, full stop -- not scoped to one player the way fetchCompletedGames is
 * (that shape stays exactly as-is; StatsPage still depends on its my/opponent framing for
 * computeStats). RLS already allows any signed-in user to read every finished game's rows (see
 * 20260314000000_finished_game_visibility.sql) -- HistoryPage's own "my games only" filtering was
 * purely a query-layer choice, not a backend restriction, so widening it here needed no migration.
 * Seats are generic (seat1/seat2, not my/opponent), same shape as fetchLadderGames/
 * fetchTournamentGames, since there's no "viewer" to be relative to until the caller checks a
 * seat's userId against whoever's actually looking. */
export async function fetchAllCompletedGames(): Promise<AllGamesRow[]> {
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .in('status', ['complete', 'abandoned'])
    .order('ended_at', { ascending: false })
  if (gamesError) throw gamesError
  if (games.length === 0) return []

  const gameIds = games.map((g) => g.id)

  const [playersRes, totalsRes, gameLaddersRes, verificationsRes] = await Promise.all([
    supabase.from('game_players').select('*').in('game_id', gameIds).order('seat'),
    supabase.from('game_totals').select('*').in('game_id', gameIds),
    supabase.from('game_ladders').select('game_id, ladder_id').in('game_id', gameIds),
    supabase.from('game_player_verifications').select('*').in('game_id', gameIds),
  ])
  if (playersRes.error) throw playersRes.error
  if (totalsRes.error) throw totalsRes.error
  if (gameLaddersRes.error) throw gameLaddersRes.error
  if (verificationsRes.error) throw verificationsRes.error

  // Same "only the first tag per game" simplification as fetchCompletedGames -- see its own
  // comment for why (issue #75 lets a game carry more than one, but neither row shape has grown a
  // multi-value display for it yet).
  const ladderIdByGameId = new Map(gameLaddersRes.data.map((r) => [r.game_id, r.ladder_id]))
  const ladderIds = [...new Set(gameLaddersRes.data.map((r) => r.ladder_id))]
  const laddersRes = ladderIds.length
    ? await supabase.from('ladders').select('id, name').in('id', ladderIds)
    : { data: [], error: null }
  if (laddersRes.error) throw laddersRes.error

  const missionIds = [
    ...new Set(playersRes.data.map((p) => p.mission_id).filter((id): id is string => Boolean(id))),
  ]
  const factionIds = [...new Set(playersRes.data.map((p) => p.faction_id).filter((id): id is string => Boolean(id)))]
  const forceDispositionIds = [
    ...new Set(playersRes.data.map((p) => p.force_disposition_id).filter((id): id is string => Boolean(id))),
  ]
  const profileIds = [
    ...new Set(
      playersRes.data.flatMap((p) => [p.user_id, p.represents_user_id]).filter((id): id is string => Boolean(id)),
    ),
  ]

  const [missionsRes, factionsRes, forceDispositionsRes, profilesRes] = await Promise.all([
    missionIds.length
      ? supabase.from('missions').select('id, name').in('id', missionIds)
      : Promise.resolve({ data: [], error: null }),
    factionIds.length
      ? supabase.from('factions').select('id, name').in('id', factionIds)
      : Promise.resolve({ data: [], error: null }),
    forceDispositionIds.length
      ? supabase.from('force_dispositions').select('id, name').in('id', forceDispositionIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (missionsRes.error) throw missionsRes.error
  if (factionsRes.error) throw factionsRes.error
  if (forceDispositionsRes.error) throw forceDispositionsRes.error
  if (profilesRes.error) throw profilesRes.error

  const missionById = new Map(missionsRes.data?.map((m) => [m.id, m.name]))
  const factionById = new Map(factionsRes.data?.map((f) => [f.id, f.name]))
  const forceDispositionById = new Map(forceDispositionsRes.data?.map((fd) => [fd.id, fd.name]))
  const ladderById = new Map(laddersRes.data?.map((l) => [l.id, l.name]))
  const nameByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.display_name]))
  const avatarByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.avatar_url]))
  const totalByPlayerId = new Map(totalsRes.data.map((t) => [t.game_player_id, t.total_vp]))
  const playersByGameId = new Map<string, typeof playersRes.data>()
  for (const p of playersRes.data) {
    const list = playersByGameId.get(p.game_id) ?? []
    list.push(p)
    playersByGameId.set(p.game_id, list)
  }

  const seatFor = (p: (typeof playersRes.data)[number], gameStatus: 'complete' | 'abandoned'): HistoryGameSeat => {
    const userId = p.user_id ?? p.represents_user_id
    return {
      gamePlayerId: p.id,
      userId,
      displayName: userId ? (nameByUserId.get(userId) ?? 'Unknown player') : p.army_name || 'Unnamed player',
      avatarUrl: userId ? (avatarByUserId.get(userId) ?? null) : null,
      factionId: p.faction_id,
      factionName: p.faction_id ? (factionById.get(p.faction_id) ?? null) : null,
      forceDispositionId: p.force_disposition_id,
      forceDispositionName: p.force_disposition_id ? (forceDispositionById.get(p.force_disposition_id) ?? null) : null,
      armyName: p.army_name,
      missionName: (p.mission_id && missionById.get(p.mission_id)) || 'Unknown mission',
      totalVp: totalByPlayerId.get(p.id) ?? 0,
      needsVerification: needsVerification({ player: p }, gameStatus, verificationsRes.data),
    }
  }

  const rows: AllGamesRow[] = []
  for (const game of games) {
    if (!game.outcome && game.status !== 'abandoned') continue
    const [p1, p2] = playersByGameId.get(game.id) ?? []
    if (!p1 || !p2) continue // shouldn't happen -- create_game always seats both -- skip defensively

    rows.push({
      gameId: game.id,
      endedAt: game.ended_at ?? game.created_at,
      pointsLimit: game.points_limit,
      seat1: seatFor(p1, game.status as 'complete' | 'abandoned'),
      seat2: seatFor(p2, game.status as 'complete' | 'abandoned'),
      outcome: game.outcome,
      status: game.status as 'complete' | 'abandoned',
      ladderId: ladderIdByGameId.get(game.id) ?? null,
      ladderName: (() => {
        const ladderId = ladderIdByGameId.get(game.id)
        return ladderId ? (ladderById.get(ladderId) ?? 'Unknown ladder') : null
      })(),
      isLocked: isGameLocked([{ player: p1 }, { player: p2 }], verificationsRes.data),
    })
  }

  return rows
}

export function useAllCompletedGames() {
  return useQuery({
    queryKey: historyKeys.all,
    queryFn: fetchAllCompletedGames,
  })
}

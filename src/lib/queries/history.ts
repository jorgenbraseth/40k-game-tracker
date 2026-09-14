import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface CompletedGameRow {
  gameId: string
  endedAt: string
  missionName: string
  deploymentName: string
  pointsLimit: number
  mySeat: 1 | 2
  myFactionName: string | null
  myArmyName: string | null
  myTotalVp: number
  opponentName: string
  opponentFactionName: string | null
  opponentTotalVp: number
  result: 'win' | 'loss' | 'draw'
}

export const historyKeys = {
  list: (userId: string) => ['history', userId] as const,
}

export async function fetchCompletedGames(userId: string): Promise<CompletedGameRow[]> {
  const { data: myPlayerRows, error: myPlayerError } = await supabase
    .from('game_players')
    .select('game_id')
    .eq('user_id', userId)
  if (myPlayerError) throw myPlayerError

  const gameIds = myPlayerRows.map((r) => r.game_id)
  if (gameIds.length === 0) return []

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .in('id', gameIds)
    .eq('status', 'complete')
    .order('ended_at', { ascending: false })
  if (gamesError) throw gamesError
  if (games.length === 0) return []

  const completeGameIds = games.map((g) => g.id)
  const missionIds = [...new Set(games.map((g) => g.mission_id))]
  const deploymentIds = [...new Set(games.map((g) => g.deployment_id))]

  const [playersRes, totalsRes, missionsRes, deploymentsRes] = await Promise.all([
    supabase.from('game_players').select('*').in('game_id', completeGameIds),
    supabase.from('game_totals').select('*').in('game_id', completeGameIds),
    supabase.from('missions').select('id, name').in('id', missionIds),
    supabase.from('deployments').select('id, name').in('id', deploymentIds),
  ])
  if (playersRes.error) throw playersRes.error
  if (totalsRes.error) throw totalsRes.error
  if (missionsRes.error) throw missionsRes.error
  if (deploymentsRes.error) throw deploymentsRes.error

  const profileIds = [...new Set(playersRes.data.map((p) => p.user_id))]
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
  const deploymentById = new Map(deploymentsRes.data.map((d) => [d.id, d.name]))
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
    const me = players.find((p) => p.user_id === userId)
    const opponent = players.find((p) => p.user_id !== userId)
    if (!me || !game.outcome) continue

    const result: CompletedGameRow['result'] =
      game.outcome === 'draw' ? 'draw' : game.outcome === `seat_${me.seat}` ? 'win' : 'loss'

    rows.push({
      gameId: game.id,
      endedAt: game.ended_at ?? game.created_at,
      missionName: missionById.get(game.mission_id) ?? 'Unknown mission',
      deploymentName: deploymentById.get(game.deployment_id) ?? 'Unknown deployment',
      pointsLimit: game.points_limit,
      mySeat: me.seat,
      myFactionName: me.faction_id ? (factionById.get(me.faction_id) ?? null) : null,
      myArmyName: me.army_name,
      myTotalVp: totalByPlayerId.get(me.id) ?? 0,
      opponentName: opponent ? (profileById.get(opponent.user_id) ?? 'Unknown opponent') : 'No opponent',
      opponentFactionName: opponent?.faction_id ? (factionById.get(opponent.faction_id) ?? null) : null,
      opponentTotalVp: opponent ? (totalByPlayerId.get(opponent.id) ?? 0) : 0,
      result,
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

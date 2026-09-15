import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'

export interface LadderSummary {
  id: string
  name: string
  createdBy: string | null
  createdAt: string
  memberCount: number
  isMember: boolean
}

export interface LadderStandingRow {
  userId: string
  displayName: string
  gamesPlayed: number
  wins: number
  draws: number
  losses: number
  points: number
  vpFor: number
  vpAgainst: number
}

export const ladderKeys = {
  list: (userId: string) => ['ladders', userId] as const,
  standings: (ladderId: string) => ['ladder-standings', ladderId] as const,
}

/** Every ladder, with membership counts and whether the current user is in it -- powers the
 * "your ladders" / "browse others'" split on the Ladders page. Reference-scale data (a handful
 * of ladders for a friend group), so one query fetching everything is simplest. */
export async function fetchLadders(userId: string): Promise<LadderSummary[]> {
  const [laddersRes, membersRes] = await Promise.all([
    supabase.from('ladders').select('*').order('created_at', { ascending: false }),
    supabase.from('ladder_members').select('ladder_id, user_id'),
  ])
  if (laddersRes.error) throw laddersRes.error
  if (membersRes.error) throw membersRes.error

  const memberCountByLadder = new Map<string, number>()
  const isMemberByLadder = new Set<string>()
  for (const m of membersRes.data) {
    memberCountByLadder.set(m.ladder_id, (memberCountByLadder.get(m.ladder_id) ?? 0) + 1)
    if (m.user_id === userId) isMemberByLadder.add(m.ladder_id)
  }

  return laddersRes.data.map((l) => ({
    id: l.id,
    name: l.name,
    createdBy: l.created_by,
    createdAt: l.created_at,
    memberCount: memberCountByLadder.get(l.id) ?? 0,
    isMember: isMemberByLadder.has(l.id),
  }))
}

export function useLadders(userId: string | undefined) {
  return useQuery({
    queryKey: ladderKeys.list(userId ?? ''),
    queryFn: () => fetchLadders(userId as string),
    enabled: Boolean(userId),
  })
}

export function useCreateLadder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('create_ladder', { p_name: name })
      if (error) throw error
      return data
    },
    onError: () => showToast("Couldn't create the ladder. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ladders'] }),
  })
}

export function useJoinLadder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ladderId: string; userId: string }) => {
      const { error } = await supabase
        .from('ladder_members')
        .insert({ ladder_id: input.ladderId, user_id: input.userId })
      if (error) throw error
    },
    onError: () => showToast("Couldn't join the ladder. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ladders'] }),
  })
}

export function useLeaveLadder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ladderId: string; userId: string }) => {
      const { error } = await supabase
        .from('ladder_members')
        .delete()
        .eq('ladder_id', input.ladderId)
        .eq('user_id', input.userId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't leave the ladder. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ladders'] }),
  })
}

/** Standings, computed fresh from every *completed* game tagged with this ladder -- never
 * stored, so editing a score or cancelling a game (which deletes its row outright) is correct
 * again the instant this is re-queried, with no separate recalculation step. Solo-tracked
 * "opponent" seats (no user_id) can't be aggregated across games, since each one is a fresh,
 * unclaimed seat with no stable identity -- they're excluded from the table. */
export async function fetchLadderStandings(ladderId: string): Promise<LadderStandingRow[]> {
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, outcome')
    .eq('ladder_id', ladderId)
    .eq('status', 'complete')
  if (gamesError) throw gamesError
  if (games.length === 0) return []

  const gameIds = games.map((g) => g.id)
  const outcomeByGameId = new Map(games.map((g) => [g.id, g.outcome]))

  const [playersRes, totalsRes] = await Promise.all([
    supabase.from('game_players').select('*').in('game_id', gameIds),
    supabase.from('game_totals').select('*').in('game_id', gameIds),
  ])
  if (playersRes.error) throw playersRes.error
  if (totalsRes.error) throw totalsRes.error

  const totalByPlayerId = new Map(totalsRes.data.map((t) => [t.game_player_id, t.total_vp]))
  const playersByGameId = new Map<string, typeof playersRes.data>()
  for (const p of playersRes.data) {
    const list = playersByGameId.get(p.game_id) ?? []
    list.push(p)
    playersByGameId.set(p.game_id, list)
  }

  const profileIds = [...new Set(playersRes.data.map((p) => p.user_id).filter((id): id is string => Boolean(id)))]
  const profilesRes = profileIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', profileIds)
    : { data: [], error: null }
  if (profilesRes.error) throw profilesRes.error
  const nameByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.display_name]))

  const rowByUserId = new Map<string, LadderStandingRow>()

  for (const gameId of gameIds) {
    const outcome = outcomeByGameId.get(gameId)
    if (!outcome) continue
    const players = playersByGameId.get(gameId) ?? []
    for (const p of players) {
      if (!p.user_id) continue
      const opponent = players.find((o) => o.id !== p.id)
      const result = outcome === 'draw' ? 'draw' : outcome === `seat_${p.seat}` ? 'win' : 'loss'
      const row = rowByUserId.get(p.user_id) ?? {
        userId: p.user_id,
        displayName: nameByUserId.get(p.user_id) ?? 'Unknown player',
        gamesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        vpFor: 0,
        vpAgainst: 0,
      }
      row.gamesPlayed += 1
      row.vpFor += totalByPlayerId.get(p.id) ?? 0
      row.vpAgainst += opponent ? (totalByPlayerId.get(opponent.id) ?? 0) : 0
      if (result === 'win') {
        row.wins += 1
        row.points += 3
      } else if (result === 'draw') {
        row.draws += 1
        row.points += 1
      } else {
        row.losses += 1
      }
      rowByUserId.set(p.user_id, row)
    }
  }

  return [...rowByUserId.values()].sort(
    (a, b) => b.points - a.points || b.vpFor - b.vpAgainst - (a.vpFor - a.vpAgainst),
  )
}

export function useLadderStandings(ladderId: string | undefined) {
  return useQuery({
    queryKey: ladderKeys.standings(ladderId ?? ''),
    queryFn: () => fetchLadderStandings(ladderId as string),
    enabled: Boolean(ladderId),
  })
}

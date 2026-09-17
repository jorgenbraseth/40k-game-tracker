import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'

export interface TournamentSummary {
  id: string
  name: string
  createdBy: string | null
  createdAt: string
  memberCount: number
  isMember: boolean
  archivedAt: string | null
  /** Purely descriptive -- shown on the card, never enforced against when a game can be tagged to
   * this tournament (same "bookkeeping tool, not guided workflow" philosophy as everything else
   * here). Either or both can be unset. */
  startsOn: string | null
  endsOn: string | null
}

export interface TournamentMember {
  userId: string
  displayName: string
}

/** No rating here, unlike LadderStandingRow -- a one-off bounded event has no ongoing skill to
 * track between events, so Elo/Glicko-2 doesn't apply (see the tournaments migration's own doc
 * comment). Sorted by wins, then VP diff, as the simplest possible standings a tagged pool of
 * games can produce. */
export interface TournamentStandingRow {
  userId: string
  displayName: string
  avatarUrl: string | null
  gamesPlayed: number
  wins: number
  draws: number
  losses: number
  vpFor: number
  vpAgainst: number
}

export interface TournamentGameSeat {
  userId: string | null
  displayName: string
  avatarUrl: string | null
  vp: number
}

export interface TournamentGameRow {
  gameId: string
  endedAt: string
  seat1: TournamentGameSeat
  seat2: TournamentGameSeat
  outcome: 'seat_1' | 'seat_2' | 'draw'
}

export const tournamentKeys = {
  list: (userId: string) => ['tournaments', userId] as const,
  standings: (tournamentId: string) => ['tournament-standings', tournamentId] as const,
  games: (tournamentId: string) => ['tournament-games', tournamentId] as const,
  members: (tournamentId: string) => ['tournament-members', tournamentId] as const,
  inviteCode: (tournamentId: string) => ['tournament-invite-code', tournamentId] as const,
}

/** Mirrors fetchLadders exactly -- see its own doc comment. Explicit column list for the same
 * reason: invite_code is excluded from the general select grant. */
export async function fetchTournaments(userId: string): Promise<TournamentSummary[]> {
  const [tournamentsRes, membersRes] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, name, created_by, created_at, archived_at, starts_on, ends_on')
      .order('created_at', { ascending: false }),
    supabase.from('tournament_members').select('tournament_id, user_id'),
  ])
  if (tournamentsRes.error) throw tournamentsRes.error
  if (membersRes.error) throw membersRes.error

  const memberCountByTournament = new Map<string, number>()
  const isMemberByTournament = new Set<string>()
  for (const m of membersRes.data) {
    memberCountByTournament.set(m.tournament_id, (memberCountByTournament.get(m.tournament_id) ?? 0) + 1)
    if (m.user_id === userId) isMemberByTournament.add(m.tournament_id)
  }

  return tournamentsRes.data.map((t) => ({
    id: t.id,
    name: t.name,
    createdBy: t.created_by,
    createdAt: t.created_at,
    memberCount: memberCountByTournament.get(t.id) ?? 0,
    isMember: isMemberByTournament.has(t.id),
    archivedAt: t.archived_at,
    startsOn: t.starts_on,
    endsOn: t.ends_on,
  }))
}

export function useTournaments(userId: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.list(userId ?? ''),
    queryFn: () => fetchTournaments(userId as string),
    enabled: Boolean(userId),
  })
}

export function useCreateTournament() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; startsOn?: string | null; endsOn?: string | null }) => {
      const { data, error } = await supabase.rpc('create_tournament', {
        p_name: input.name,
        p_starts_on: input.startsOn ?? null,
        p_ends_on: input.endsOn ?? null,
      })
      if (error) throw error
      return data
    },
    onError: () => showToast("Couldn't create the tournament. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  })
}

export function useArchiveTournament() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { tournamentId: string; archived: boolean }) => {
      const { error } = await supabase
        .from('tournaments')
        .update({ archived_at: input.archived ? new Date().toISOString() : null })
        .eq('id', input.tournamentId)
      if (error) throw error
    },
    onError: (_error, input) =>
      showToast(`Couldn't ${input.archived ? 'archive' : 'restore'} the tournament. Try again.`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  })
}

export function useDeleteTournament() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't delete the tournament. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  })
}

export function useJoinTournamentByCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { tournamentId: string; code: string }) => {
      const { error } = await supabase.rpc('join_tournament_by_code', {
        p_tournament_id: input.tournamentId,
        p_code: input.code,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  })
}

export function useTournamentInviteCode(tournamentId: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.inviteCode(tournamentId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tournament_invite_code', {
        p_tournament_id: tournamentId as string,
      })
      if (error) throw error
      return data
    },
    enabled: Boolean(tournamentId),
  })
}

export function useRegenerateTournamentInviteCode(tournamentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regenerate_tournament_invite_code', {
        p_tournament_id: tournamentId,
      })
      if (error) throw error
      return data
    },
    onError: () => showToast("Couldn't regenerate the invite code. Try again."),
    onSuccess: (code) => queryClient.setQueryData(tournamentKeys.inviteCode(tournamentId), code),
  })
}

export function useLeaveTournament() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { tournamentId: string; userId: string }) => {
      const { error } = await supabase
        .from('tournament_members')
        .delete()
        .eq('tournament_id', input.tournamentId)
        .eq('user_id', input.userId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't leave the tournament. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  })
}

export async function fetchTournamentMembers(tournamentId: string): Promise<TournamentMember[]> {
  const { data: members, error: membersError } = await supabase
    .from('tournament_members')
    .select('user_id')
    .eq('tournament_id', tournamentId)
  if (membersError) throw membersError
  if (members.length === 0) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in(
      'id',
      members.map((m) => m.user_id),
    )
  if (profilesError) throw profilesError

  const nameById = new Map(profiles.map((p) => [p.id, p.display_name]))
  return members
    .map((m) => ({ userId: m.user_id, displayName: nameById.get(m.user_id) ?? 'Unknown player' }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function useTournamentMembers(tournamentId: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.members(tournamentId ?? ''),
    queryFn: () => fetchTournamentMembers(tournamentId as string),
    enabled: Boolean(tournamentId),
  })
}

/** Standings computed fresh from every completed game tagged to this tournament via
 * game_tournaments -- same never-stored, always-correct-on-read shape as fetchLadderStandings, but
 * a plain W/D/L + VP tally instead of a rating (see this module's own doc comment for why). */
export async function fetchTournamentStandings(tournamentId: string): Promise<TournamentStandingRow[]> {
  const { data: tags, error: tagsError } = await supabase
    .from('game_tournaments')
    .select('game_id')
    .eq('tournament_id', tournamentId)
  if (tagsError) throw tagsError
  if (tags.length === 0) return []

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, outcome')
    .in(
      'id',
      tags.map((t) => t.game_id),
    )
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

  const profileIds = [
    ...new Set(
      playersRes.data.flatMap((p) => [p.user_id, p.represents_user_id]).filter((id): id is string => Boolean(id)),
    ),
  ]
  const profilesRes = profileIds.length
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', profileIds)
    : { data: [], error: null }
  if (profilesRes.error) throw profilesRes.error
  const nameByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.display_name]))
  const avatarByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.avatar_url]))

  const rowByUserId = new Map<string, TournamentStandingRow>()

  for (const gameId of gameIds) {
    const outcome = outcomeByGameId.get(gameId)
    if (!outcome) continue
    const players = playersByGameId.get(gameId) ?? []
    for (const p of players) {
      const standingUserId = p.user_id ?? p.represents_user_id
      if (!standingUserId) continue
      const opponent = players.find((o) => o.id !== p.id)
      const result = outcome === 'draw' ? 'draw' : outcome === `seat_${p.seat}` ? 'win' : 'loss'
      const row = rowByUserId.get(standingUserId) ?? {
        userId: standingUserId,
        displayName: nameByUserId.get(standingUserId) ?? 'Unknown player',
        avatarUrl: avatarByUserId.get(standingUserId) ?? null,
        gamesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        vpFor: 0,
        vpAgainst: 0,
      }
      row.gamesPlayed += 1
      row.vpFor += totalByPlayerId.get(p.id) ?? 0
      row.vpAgainst += opponent ? (totalByPlayerId.get(opponent.id) ?? 0) : 0
      if (result === 'win') row.wins += 1
      else if (result === 'draw') row.draws += 1
      else row.losses += 1
      rowByUserId.set(standingUserId, row)
    }
  }

  return [...rowByUserId.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.vpFor - b.vpAgainst - (a.vpFor - a.vpAgainst)
  })
}

export function useTournamentStandings(tournamentId: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.standings(tournamentId ?? ''),
    queryFn: () => fetchTournamentStandings(tournamentId as string),
    enabled: Boolean(tournamentId),
  })
}

/** Mirrors fetchLadderGames -- see its own doc comment. */
export async function fetchTournamentGames(tournamentId: string): Promise<TournamentGameRow[]> {
  const { data: tags, error: tagsError } = await supabase
    .from('game_tournaments')
    .select('game_id')
    .eq('tournament_id', tournamentId)
  if (tagsError) throw tagsError
  if (tags.length === 0) return []

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, outcome, ended_at, created_at')
    .in(
      'id',
      tags.map((t) => t.game_id),
    )
    .eq('status', 'complete')
    .order('ended_at', { ascending: false })
  if (gamesError) throw gamesError
  if (games.length === 0) return []

  const gameIds = games.map((g) => g.id)
  const [playersRes, totalsRes] = await Promise.all([
    supabase.from('game_players').select('*').in('game_id', gameIds).order('seat'),
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

  const profileIds = [
    ...new Set(
      playersRes.data.flatMap((p) => [p.user_id, p.represents_user_id]).filter((id): id is string => Boolean(id)),
    ),
  ]
  const profilesRes = profileIds.length
    ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', profileIds)
    : { data: [], error: null }
  if (profilesRes.error) throw profilesRes.error
  const nameByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.display_name]))
  const avatarByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.avatar_url]))

  const seatFor = (p: (typeof playersRes.data)[number] | undefined): TournamentGameSeat => {
    if (!p) return { userId: null, displayName: 'No opponent', avatarUrl: null, vp: 0 }
    const userId = p.user_id ?? p.represents_user_id
    return {
      userId,
      displayName: userId ? (nameByUserId.get(userId) ?? 'Unknown player') : p.army_name || 'Unnamed player',
      avatarUrl: userId ? (avatarByUserId.get(userId) ?? null) : null,
      vp: totalByPlayerId.get(p.id) ?? 0,
    }
  }

  return games
    .filter((g): g is typeof g & { outcome: NonNullable<(typeof g)['outcome']> } => Boolean(g.outcome))
    .map((g) => {
      const [p1, p2] = playersByGameId.get(g.id) ?? []
      return {
        gameId: g.id,
        endedAt: g.ended_at ?? g.created_at,
        outcome: g.outcome,
        seat1: seatFor(p1),
        seat2: seatFor(p2),
      }
    })
}

export function useTournamentGames(tournamentId: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.games(tournamentId ?? ''),
    queryFn: () => fetchTournamentGames(tournamentId as string),
    enabled: Boolean(tournamentId),
  })
}

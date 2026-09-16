import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { computeEloRatings, ELO_STARTING_RATING, type EloGame } from '@/lib/elo'
import { computeGlicko2Ratings, GLICKO2_STARTING_RATING } from '@/lib/glicko2'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'

export type LadderRankingType = 'elo' | 'glicko2'

export const RANKING_TYPE_LABELS: Record<LadderRankingType, string> = {
  elo: 'Elo',
  glicko2: 'Glicko-2',
}

export interface LadderSummary {
  id: string
  name: string
  createdBy: string | null
  createdAt: string
  memberCount: number
  isMember: boolean
  /** Set once the creator archives this ladder (fully reversible -- see useArchiveLadder) --
   * archived ladders drop out of the default browse list and the "tag this game" picker, but
   * their standings/game log and every game's own ladder name keep working exactly as before. */
  archivedAt: string | null
  /** Which rating system this ladder's standings are computed with (issue #68) -- creator-only to
   * change, like every other ladder-level setting. Standings are never stored, so switching this
   * just replays the same game history through a different formula next time they're viewed. */
  rankingType: LadderRankingType
}

export interface LadderMember {
  userId: string
  displayName: string
}

export interface LadderStandingRow {
  userId: string
  displayName: string
  gamesPlayed: number
  wins: number
  draws: number
  losses: number
  rating: number
  vpFor: number
  vpAgainst: number
}

export interface LadderGameSeat {
  /** The account behind this seat, if any -- their own, or whoever an unclaimed seat was
   * attributed to -- null when there's nobody to link to. */
  userId: string | null
  displayName: string
  vp: number
}

export interface LadderGameRow {
  gameId: string
  endedAt: string
  seat1: LadderGameSeat
  seat2: LadderGameSeat
  outcome: 'seat_1' | 'seat_2' | 'draw'
}

export const ladderKeys = {
  list: (userId: string) => ['ladders', userId] as const,
  standings: (ladderId: string) => ['ladder-standings', ladderId] as const,
  games: (ladderId: string) => ['ladder-games', ladderId] as const,
  members: (ladderId: string) => ['ladder-members', ladderId] as const,
  inviteCode: (ladderId: string) => ['ladder-invite-code', ladderId] as const,
}

/** Every ladder, with membership counts and whether the current user is in it -- powers the
 * "your ladders" / "browse others'" split on the Ladders page. Reference-scale data (a handful
 * of ladders for a friend group), so one query fetching everything is simplest. Explicit column
 * list rather than `select('*')` -- invite_code is deliberately excluded from this table's general
 * select grant (see 20260325000000_ladder_invite_codes.sql), so `*` wouldn't include it anyway;
 * spelling the columns out here is just being explicit about that rather than relying on it. */
export async function fetchLadders(userId: string): Promise<LadderSummary[]> {
  const [laddersRes, membersRes] = await Promise.all([
    supabase
      .from('ladders')
      .select('id, name, created_by, created_at, archived_at, ranking_type')
      .order('created_at', { ascending: false }),
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
    archivedAt: l.archived_at,
    rankingType: l.ranking_type,
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

/** Toggles archived_at (now(), or back to null to unarchive) -- fully reversible, gated by the
 * creator-only update policy on ladders. */
export function useArchiveLadder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ladderId: string; archived: boolean }) => {
      const { error } = await supabase
        .from('ladders')
        .update({ archived_at: input.archived ? new Date().toISOString() : null })
        .eq('id', input.ladderId)
      if (error) throw error
    },
    onError: (_error, input) =>
      showToast(`Couldn't ${input.archived ? 'archive' : 'restore'} the ladder. Try again.`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ladders'] }),
  })
}

/** Switches which rating system a ladder's standings are computed with (issue #68) -- gated by
 * the same creator-only update policy as archiving. Standings aren't stored, so this takes effect
 * the moment they're next viewed, no recalculation step of its own needed. */
export function useSetLadderRankingType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ladderId: string; rankingType: LadderRankingType }) => {
      const { error } = await supabase
        .from('ladders')
        .update({ ranking_type: input.rankingType })
        .eq('id', input.ladderId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't change the ranking type. Try again."),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['ladders'] })
      queryClient.invalidateQueries({ queryKey: ladderKeys.standings(input.ladderId) })
    },
  })
}

/** Permanently deletes a ladder -- distinct from archiving, this actually removes the row.
 * ladder_members and game_ladders both cascade (see 20260328000000_game_ladders.sql), so tagged
 * games simply become untagged rather than losing any history. Gated by the creator-only delete
 * policy on ladders. */
export function useDeleteLadder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ladderId: string) => {
      const { error } = await supabase.from('ladders').delete().eq('id', ladderId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't delete the ladder. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ladders'] }),
  })
}

/** Joining now always goes through the invite code (issue #70) -- checked server-side by
 * join_ladder_by_code, since a direct client insert into ladder_members can no longer succeed
 * (the old self-service insert policy is gone). Errors (wrong code, ladder not found) surface via
 * the caller's own onError rather than the generic toast here, since "wrong code" deserves inline
 * feedback next to the field, not a toast that's already gone by the time you look back at it. */
export function useJoinLadderByCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ladderId: string; code: string }) => {
      const { error } = await supabase.rpc('join_ladder_by_code', {
        p_ladder_id: input.ladderId,
        p_code: input.code,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ladders'] }),
  })
}

/** A ladder's own invite code -- only resolvable for a current member (get_ladder_invite_code
 * checks membership server-side), so the caller passes `undefined` for a ladder the viewer hasn't
 * joined rather than this hook trying and failing. */
export function useLadderInviteCode(ladderId: string | undefined) {
  return useQuery({
    queryKey: ladderKeys.inviteCode(ladderId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ladder_invite_code', { p_ladder_id: ladderId as string })
      if (error) throw error
      return data
    },
    enabled: Boolean(ladderId),
  })
}

/** Replaces the ladder's invite code with a fresh one, invalidating whatever the old one was --
 * creator-only, same as archiving/deleting the ladder itself. */
export function useRegenerateLadderInviteCode(ladderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regenerate_ladder_invite_code', { p_ladder_id: ladderId })
      if (error) throw error
      return data
    },
    onError: () => showToast("Couldn't regenerate the invite code. Try again."),
    onSuccess: (code) => queryClient.setQueryData(ladderKeys.inviteCode(ladderId), code),
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

/** The people in a ladder, by display name -- powers the "which of you is this?" picker a
 * bookkeeper sees on an unclaimed seat when the game is tagged to this ladder. */
export async function fetchLadderMembers(ladderId: string): Promise<LadderMember[]> {
  const { data: members, error: membersError } = await supabase
    .from('ladder_members')
    .select('user_id')
    .eq('ladder_id', ladderId)
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

export function useLadderMembers(ladderId: string | undefined) {
  return useQuery({
    queryKey: ladderKeys.members(ladderId ?? ''),
    queryFn: () => fetchLadderMembers(ladderId as string),
    enabled: Boolean(ladderId),
  })
}

/** Standings, computed fresh from every *completed* game tagged with this ladder -- never
 * stored, so editing a score or cancelling a game (which deletes its row outright) is correct
 * again the instant this is re-queried, with no separate recalculation step. An unclaimed seat
 * only counts toward standings if the bookkeeper attributed it to a ladder member
 * (game_players.represents_user_id) -- otherwise there's no stable identity to aggregate by.
 *
 * Ranking is Elo or Glicko-2 (issue #68, see src/lib/elo.ts and src/lib/glicko2.ts), whichever
 * this ladder's own ranking_type is set to: each ladder is its own independent rating pool,
 * replayed from scratch in chronological order every time this is called. Both are
 * sequential/path-dependent -- unlike a flat points sum, a rating depends on the order every
 * prior game happened in -- but replaying a ladder's full history is cheap at this app's scale,
 * so an edited score or a cancelled game (deleted outright) is still reflected correctly the
 * instant standings are re-queried, no separate recalculation step needed. A game only feeds the
 * rating replay when *both* seats resolve to a stable identity -- there's no rating to exchange
 * points with an unattributed opponent -- but it still counts toward the descriptive W/D/L/VP
 * columns for whichever side does. */
export async function fetchLadderStandings(ladderId: string): Promise<LadderStandingRow[]> {
  const [ladderRes, tagsRes] = await Promise.all([
    supabase.from('ladders').select('ranking_type').eq('id', ladderId).single(),
    supabase.from('game_ladders').select('game_id').eq('ladder_id', ladderId),
  ])
  if (ladderRes.error) throw ladderRes.error
  if (tagsRes.error) throw tagsRes.error
  if (tagsRes.data.length === 0) return []

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, outcome, ended_at, created_at')
    .in(
      'id',
      tagsRes.data.map((t) => t.game_id),
    )
    .eq('status', 'complete')
  if (gamesError) throw gamesError
  if (games.length === 0) return []

  const rankingType = ladderRes.data.ranking_type
  const startingRating = rankingType === 'glicko2' ? GLICKO2_STARTING_RATING : ELO_STARTING_RATING

  const gameIds = games.map((g) => g.id)
  const outcomeByGameId = new Map(games.map((g) => [g.id, g.outcome]))
  const playedAtByGameId = new Map(games.map((g) => [g.id, g.ended_at ?? g.created_at]))

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
    ? await supabase.from('profiles').select('id, display_name').in('id', profileIds)
    : { data: [], error: null }
  if (profilesRes.error) throw profilesRes.error
  const nameByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.display_name]))

  const rowByUserId = new Map<string, LadderStandingRow>()
  const ratingGames: EloGame[] = []

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
        gamesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        rating: startingRating,
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

    const [p1, p2] = players
    const id1 = p1 ? (p1.user_id ?? p1.represents_user_id) : null
    const id2 = p2 ? (p2.user_id ?? p2.represents_user_id) : null
    if (players.length === 2 && id1 && id2) {
      const scoreForA = outcome === 'draw' ? 0.5 : outcome === `seat_${p1.seat}` ? 1 : 0
      ratingGames.push({ playedAt: playedAtByGameId.get(gameId) ?? '', playerAId: id1, playerBId: id2, scoreForA })
    }
  }

  const ratingByUserId =
    rankingType === 'glicko2' ? computeGlicko2Ratings(ratingGames) : computeEloRatings(ratingGames)
  for (const row of rowByUserId.values()) {
    row.rating = Math.round(ratingByUserId.get(row.userId) ?? startingRating)
  }

  return [...rowByUserId.values()].sort((a, b) => b.rating - a.rating)
}

export function useLadderStandings(ladderId: string | undefined) {
  return useQuery({
    queryKey: ladderKeys.standings(ladderId ?? ''),
    queryFn: () => fetchLadderStandings(ladderId as string),
    enabled: Boolean(ladderId),
  })
}

/** Every completed game tagged with this ladder, most recent first -- not just the viewer's own
 * (same RLS as standings: any signed-in user can read a ladder-tagged game's rows, see
 * 20260310000000_ladder_game_visibility.sql). Kept as its own query, separate from
 * fetchLadderStandings, since the games list is opt-in (collapsed until asked for) while
 * standings load whenever a ladder row is expanded. */
export async function fetchLadderGames(ladderId: string): Promise<LadderGameRow[]> {
  const { data: tags, error: tagsError } = await supabase
    .from('game_ladders')
    .select('game_id')
    .eq('ladder_id', ladderId)
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
    ? await supabase.from('profiles').select('id, display_name').in('id', profileIds)
    : { data: [], error: null }
  if (profilesRes.error) throw profilesRes.error
  const nameByUserId = new Map(profilesRes.data?.map((p) => [p.id, p.display_name]))

  const seatFor = (p: (typeof playersRes.data)[number] | undefined): LadderGameSeat => {
    if (!p) return { userId: null, displayName: 'No opponent', vp: 0 }
    const userId = p.user_id ?? p.represents_user_id
    return {
      userId,
      displayName: userId ? (nameByUserId.get(userId) ?? 'Unknown player') : p.army_name || 'Unnamed player',
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

export function useLadderGames(ladderId: string | undefined) {
  return useQuery({
    queryKey: ladderKeys.games(ladderId ?? ''),
    queryFn: () => fetchLadderGames(ladderId as string),
    enabled: Boolean(ladderId),
  })
}

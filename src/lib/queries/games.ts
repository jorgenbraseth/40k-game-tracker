import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'

type GamePlayerRow = Database['public']['Tables']['game_players']['Row']
type GameRow = Database['public']['Tables']['games']['Row']

export const gameKeys = {
  detail: (gameId: string) => ['game', gameId] as const,
}

export interface GameDetail {
  game: GameRow
  players: Array<{
    player: GamePlayerRow
    profile: { display_name: string; avatar_url: string | null } | null
    factionName: string | null
    forceDispositionName: string | null
    primaryTotal: number
    secondaryTotal: number
    totalVp: number
  }>
  roundScores: Database['public']['Tables']['round_scores']['Row'][]
  secondaryScores: Database['public']['Tables']['secondary_scores']['Row'][]
}

export async function fetchGameDetail(gameId: string): Promise<GameDetail> {
  const [gameRes, playersRes, roundRes, secondaryRes, totalsRes] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).single(),
    supabase.from('game_players').select('*').eq('game_id', gameId).order('seat'),
    supabase.from('round_scores').select('*').eq('game_id', gameId),
    supabase.from('secondary_scores').select('*').eq('game_id', gameId),
    supabase.from('game_totals').select('*').eq('game_id', gameId),
  ])

  if (gameRes.error) throw gameRes.error
  if (playersRes.error) throw playersRes.error
  if (roundRes.error) throw roundRes.error
  if (secondaryRes.error) throw secondaryRes.error
  if (totalsRes.error) throw totalsRes.error

  // A seat nobody has joined yet has user_id = null (a solo-tracked
  // "opponent" the creator fills in themselves) -- filter it out rather
  // than looking up a profile for it.
  const userIds = playersRes.data.map((p) => p.user_id).filter((id): id is string => Boolean(id))
  const factionIds = playersRes.data.map((p) => p.faction_id).filter((id): id is string => Boolean(id))
  const forceDispositionIds = playersRes.data
    .map((p) => p.force_disposition_id)
    .filter((id): id is string => Boolean(id))

  const [profilesRes, factionsRes, forceDispositionsRes] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
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

  const profileById = new Map(profilesRes.data?.map((p) => [p.id, p]))
  const factionById = new Map(factionsRes.data?.map((f) => [f.id, f.name]))
  const forceDispositionById = new Map(forceDispositionsRes.data?.map((f) => [f.id, f.name]))
  const totalsByPlayerId = new Map(totalsRes.data?.map((t) => [t.game_player_id, t]))

  return {
    game: gameRes.data,
    players: playersRes.data.map((player) => {
      const totals = totalsByPlayerId.get(player.id)
      const profile = player.user_id ? profileById.get(player.user_id) : undefined
      return {
        player,
        profile: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : null,
        factionName: player.faction_id ? (factionById.get(player.faction_id) ?? null) : null,
        forceDispositionName: player.force_disposition_id
          ? (forceDispositionById.get(player.force_disposition_id) ?? null)
          : null,
        primaryTotal: totals?.primary_total ?? 0,
        secondaryTotal: totals?.secondary_total ?? 0,
        totalVp: totals?.total_vp ?? 0,
      }
    }),
    roundScores: roundRes.data,
    secondaryScores: secondaryRes.data,
  }
}

/** Optimistic-patch helpers -- keep the score UI responsive (and correct while offline/paused) without waiting on a round-trip. */

function patchRoundScore(
  detail: GameDetail,
  input: { gamePlayerId: string; battleRound: number; primaryVp: number; userId: string },
): GameDetail {
  const existing = detail.roundScores.find(
    (r) => r.game_player_id === input.gamePlayerId && r.battle_round === input.battleRound,
  )
  const delta = input.primaryVp - (existing?.primary_vp ?? 0)
  const now = new Date().toISOString()
  const roundScores = existing
    ? detail.roundScores.map((r) =>
        r === existing ? { ...r, primary_vp: input.primaryVp, updated_by: input.userId, updated_at: now } : r,
      )
    : [
        ...detail.roundScores,
        {
          id: `optimistic-${input.gamePlayerId}-${input.battleRound}`,
          game_id: detail.game.id,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          primary_vp: input.primaryVp,
          updated_by: input.userId,
          updated_at: now,
        },
      ]
  return {
    ...detail,
    roundScores,
    players: detail.players.map((p) =>
      p.player.id === input.gamePlayerId
        ? { ...p, primaryTotal: p.primaryTotal + delta, totalVp: p.totalVp + delta }
        : p,
    ),
  }
}

function patchSecondaryUpsert(
  detail: GameDetail,
  input: { gamePlayerId: string; battleRound: number; secondaryObjectiveId: string; vpScored: number; userId: string },
): GameDetail {
  const existing = detail.secondaryScores.find(
    (s) =>
      s.game_player_id === input.gamePlayerId &&
      s.battle_round === input.battleRound &&
      s.secondary_objective_id === input.secondaryObjectiveId,
  )
  const delta = input.vpScored - (existing?.vp_scored ?? 0)
  const now = new Date().toISOString()
  const secondaryScores = existing
    ? detail.secondaryScores.map((s) =>
        s === existing ? { ...s, vp_scored: input.vpScored, updated_by: input.userId, updated_at: now } : s,
      )
    : [
        ...detail.secondaryScores,
        {
          id: `optimistic-${input.gamePlayerId}-${input.battleRound}-${input.secondaryObjectiveId}`,
          game_id: detail.game.id,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          secondary_objective_id: input.secondaryObjectiveId,
          vp_scored: input.vpScored,
          updated_by: input.userId,
          updated_at: now,
        },
      ]
  return {
    ...detail,
    secondaryScores,
    players: detail.players.map((p) =>
      p.player.id === input.gamePlayerId
        ? { ...p, secondaryTotal: p.secondaryTotal + delta, totalVp: p.totalVp + delta }
        : p,
    ),
  }
}

function patchSecondaryRemove(
  detail: GameDetail,
  input: { gamePlayerId: string; battleRound: number; secondaryObjectiveId: string },
): GameDetail {
  const existing = detail.secondaryScores.find(
    (s) =>
      s.game_player_id === input.gamePlayerId &&
      s.battle_round === input.battleRound &&
      s.secondary_objective_id === input.secondaryObjectiveId,
  )
  if (!existing) return detail
  return {
    ...detail,
    secondaryScores: detail.secondaryScores.filter((s) => s !== existing),
    players: detail.players.map((p) =>
      p.player.id === input.gamePlayerId
        ? { ...p, secondaryTotal: p.secondaryTotal - existing.vp_scored, totalVp: p.totalVp - existing.vp_scored }
        : p,
    ),
  }
}

/** A joined player's account name, else the army name a solo tracker gave this seat, else the seat number. */
export function playerLabel(entry: GameDetail['players'][number] | undefined, fallback: string): string {
  return entry?.profile?.display_name ?? entry?.player.army_name ?? fallback
}

export function useGame(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.detail(gameId ?? ''),
    queryFn: () => fetchGameDetail(gameId as string),
    enabled: Boolean(gameId),
    staleTime: 0,
  })
}

export function useCreateGame() {
  return useMutation({
    mutationFn: async (input: {
      deploymentId: string
      pointsLimit: number
      forceDispositionId?: string
      factionId?: string
      armyName?: string
    }) => {
      const { data, error } = await supabase.rpc('create_game', {
        p_deployment_id: input.deploymentId,
        p_points_limit: input.pointsLimit,
        p_force_disposition_id: input.forceDispositionId ?? null,
        p_faction_id: input.factionId ?? null,
        p_army_name: input.armyName ?? null,
      })
      if (error) throw error
      return data
    },
  })
}

export function useJoinGame() {
  return useMutation({
    mutationFn: async (input: {
      code: string
      forceDispositionId?: string
      factionId?: string
      armyName?: string
    }) => {
      const { data, error } = await supabase.rpc('join_game_by_code', {
        p_code: input.code,
        p_force_disposition_id: input.forceDispositionId ?? null,
        p_faction_id: input.factionId ?? null,
        p_army_name: input.armyName ?? null,
      })
      if (error) throw error
      if (!data) throw new Error("That code doesn't match an open game. Double-check it with your opponent.")
      return data
    },
  })
}

export function useSetReady(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; isReady: boolean }) => {
      const { error } = await supabase
        .from('game_players')
        .update({ is_ready: input.isReady })
        .eq('id', input.gamePlayerId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't update ready status. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useUpdatePlayerSetup(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      gamePlayerId: string
      factionId?: string | null
      armyName?: string | null
      forceDispositionId?: string | null
    }) => {
      const patch: Database['public']['Tables']['game_players']['Update'] = {}
      if ('factionId' in input) patch.faction_id = input.factionId
      if ('armyName' in input) patch.army_name = input.armyName
      if ('forceDispositionId' in input) patch.force_disposition_id = input.forceDispositionId

      const { error } = await supabase.from('game_players').update(patch).eq('id', input.gamePlayerId)
      if (error) throw error

      // Both players' Force Dispositions might now be set, or a player
      // corrected a wrong pick -- resolve_game_mission always recomputes
      // both seats' missions from the current picks, so this is always
      // safe to call, whether it's the first resolution or a correction.
      if ('forceDispositionId' in input) {
        await supabase.rpc('resolve_game_mission', { p_game_id: gameId })
      }
    },
    onError: () => showToast("Couldn't save your setup. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useSetRole(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; role: 'attacker' | 'defender' | null }) => {
      const { error } = await supabase.from('game_players').update({ role: input.role }).eq('id', input.gamePlayerId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't update your role. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useStartGame(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('start_game', { p_game_id: gameId })
      if (error) throw error
    },
    onError: (error) =>
      showToast(error instanceof Error && error.message ? error.message : "Couldn't start the game. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useSetCurrentRound(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (round: number) => {
      const { error } = await supabase.from('games').update({ current_round: round }).eq('id', gameId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't advance the round. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useUpsertRoundScore(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; battleRound: number; primaryVp: number; userId: string }) => {
      const { error } = await supabase.from('round_scores').upsert(
        {
          game_id: gameId,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          primary_vp: input.primaryVp,
          updated_by: input.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'game_player_id,battle_round' },
      )
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchRoundScore(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't save that score. Check your connection and try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useUpsertSecondaryScore(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      gamePlayerId: string
      battleRound: number
      secondaryObjectiveId: string
      vpScored: number
      userId: string
    }) => {
      const { error } = await supabase.from('secondary_scores').upsert(
        {
          game_id: gameId,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          secondary_objective_id: input.secondaryObjectiveId,
          vp_scored: input.vpScored,
          updated_by: input.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'game_player_id,battle_round,secondary_objective_id' },
      )
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchSecondaryUpsert(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't save that secondary. Check your connection and try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useRemoveSecondaryScore(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; battleRound: number; secondaryObjectiveId: string }) => {
      const { error } = await supabase
        .from('secondary_scores')
        .delete()
        .eq('game_player_id', input.gamePlayerId)
        .eq('battle_round', input.battleRound)
        .eq('secondary_objective_id', input.secondaryObjectiveId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchSecondaryRemove(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't remove that secondary. Check your connection and try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useFinishGame(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (outcome: 'seat_1' | 'seat_2' | 'draw') => {
      const { error } = await supabase
        .from('games')
        .update({ status: 'complete', ended_at: new Date().toISOString(), outcome })
        .eq('id', gameId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't save the result. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useAbandonGame(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('games')
        .update({ status: 'abandoned', ended_at: new Date().toISOString() })
        .eq('id', gameId)
      if (error) throw error
    },
    onError: () => showToast("Couldn't end the game. Try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

/**
 * Cancels a game outright -- unlike abandoning, this removes it from
 * every list (Home, History) entirely rather than keeping a record.
 * game_players/round_scores/secondary_scores cascade-delete with it.
 * Takes the game id per-call rather than a bound gameId so it works from
 * list rows (Home/History) as well as from inside a single game.
 */
export function useDeleteGame() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase.from('games').delete().eq('id', gameId)
      if (error) throw error
      return gameId
    },
    onError: () => showToast("Couldn't cancel the game. Try again."),
    onSuccess: (gameId) => {
      queryClient.removeQueries({ queryKey: gameKeys.detail(gameId) })
      queryClient.invalidateQueries({ queryKey: ['games'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    },
  })
}

/** Active (lobby/active) games the current user is part of, most recent first. */
export function useMyActiveGames(userId: string | undefined) {
  return useQuery({
    queryKey: ['games', 'active', userId],
    queryFn: async () => {
      const { data: playerRows, error: playerError } = await supabase
        .from('game_players')
        .select('game_id')
        .eq('user_id', userId as string)
      if (playerError) throw playerError

      const gameIds = playerRows.map((p) => p.game_id)
      if (gameIds.length === 0) return []

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .in('id', gameIds)
        .in('status', ['lobby', 'active'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: Boolean(userId),
  })
}

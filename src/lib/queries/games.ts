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
    /** Set only when the seat is unclaimed and the bookkeeper attributed it to a real ladder
     * member (game_players.represents_user_id) -- purely descriptive, grants that account no
     * access to this game. */
    representsDisplayName: string | null
    factionName: string | null
    forceDispositionName: string | null
    primaryTotal: number
    secondaryTotal: number
    totalVp: number
  }>
  roundScores: Database['public']['Tables']['round_scores']['Row'][]
  secondaryScores: Database['public']['Tables']['secondary_scores']['Row'][]
  secondaryDraws: Database['public']['Tables']['secondary_draws']['Row'][]
  primaryTicks: Database['public']['Tables']['primary_objective_ticks']['Row'][]
  secondaryTicks: Database['public']['Tables']['secondary_objective_ticks']['Row'][]
}

export async function fetchGameDetail(gameId: string): Promise<GameDetail> {
  const [gameRes, playersRes, roundRes, secondaryRes, secondaryDrawsRes, totalsRes, primaryTicksRes, secondaryTicksRes] =
    await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('game_players').select('*').eq('game_id', gameId).order('seat'),
      supabase.from('round_scores').select('*').eq('game_id', gameId),
      supabase.from('secondary_scores').select('*').eq('game_id', gameId),
      supabase.from('secondary_draws').select('*').eq('game_id', gameId),
      supabase.from('game_totals').select('*').eq('game_id', gameId),
      supabase.from('primary_objective_ticks').select('*').eq('game_id', gameId),
      supabase.from('secondary_objective_ticks').select('*').eq('game_id', gameId),
    ])

  if (gameRes.error) throw gameRes.error
  if (playersRes.error) throw playersRes.error
  if (roundRes.error) throw roundRes.error
  if (secondaryRes.error) throw secondaryRes.error
  if (secondaryDrawsRes.error) throw secondaryDrawsRes.error
  if (totalsRes.error) throw totalsRes.error
  if (primaryTicksRes.error) throw primaryTicksRes.error
  if (secondaryTicksRes.error) throw secondaryTicksRes.error

  // A seat nobody has joined yet has user_id = null (the bookkeeper can
  // fill it in themselves, on behalf of a player who never needs to sign
  // in at all) -- look up profiles for whichever accounts are actually
  // linked, whether claimed (user_id) or just attributed for ladder
  // standings (represents_user_id).
  const userIds = [
    ...new Set(
      playersRes.data
        .flatMap((p) => [p.user_id, p.represents_user_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ]
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
      const representsProfile = player.represents_user_id ? profileById.get(player.represents_user_id) : undefined
      return {
        player,
        profile: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : null,
        representsDisplayName: representsProfile?.display_name ?? null,
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
    secondaryDraws: secondaryDrawsRes.data,
    primaryTicks: primaryTicksRes.data,
    secondaryTicks: secondaryTicksRes.data,
  }
}

/** Optimistic-patch helpers -- keep the score UI responsive (and correct while offline/paused) without waiting on a round-trip. */

function patchPlayerField(detail: GameDetail, gamePlayerId: string, patch: Partial<GamePlayerRow>): GameDetail {
  return {
    ...detail,
    players: detail.players.map((p) => (p.player.id === gamePlayerId ? { ...p, player: { ...p.player, ...patch } } : p)),
  }
}

function patchGame(detail: GameDetail, patch: Partial<GameRow>): GameDetail {
  return { ...detail, game: { ...detail.game, ...patch } }
}

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

function patchSecondaryDraw(
  detail: GameDetail,
  input: { gamePlayerId: string; battleRound: number; secondaryObjectiveId: string; userId: string },
): GameDetail {
  if (
    detail.secondaryDraws.some(
      (d) => d.game_player_id === input.gamePlayerId && d.secondary_objective_id === input.secondaryObjectiveId,
    )
  ) {
    return detail
  }
  return {
    ...detail,
    secondaryDraws: [
      ...detail.secondaryDraws,
      {
        id: `optimistic-${input.gamePlayerId}-${input.secondaryObjectiveId}`,
        game_id: detail.game.id,
        game_player_id: input.gamePlayerId,
        secondary_objective_id: input.secondaryObjectiveId,
        battle_round: input.battleRound,
        drawn_by: input.userId,
        drawn_at: new Date().toISOString(),
      },
    ],
  }
}

function patchSecondaryUndraw(
  detail: GameDetail,
  input: { gamePlayerId: string; secondaryObjectiveId: string },
): GameDetail {
  return {
    ...detail,
    secondaryDraws: detail.secondaryDraws.filter(
      (d) => !(d.game_player_id === input.gamePlayerId && d.secondary_objective_id === input.secondaryObjectiveId),
    ),
  }
}

/** A joined player's own account name, else the ladder member the bookkeeper attributed this
 * unclaimed seat to, else whatever army name was entered for it, else the seat number. */
export function playerLabel(entry: GameDetail['players'][number] | undefined, fallback: string): string {
  return entry?.profile?.display_name ?? entry?.representsDisplayName ?? entry?.player.army_name ?? fallback
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
      ladderId?: string
    }) => {
      const { data, error } = await supabase.rpc('create_game', {
        p_deployment_id: input.deploymentId,
        p_points_limit: input.pointsLimit,
        p_force_disposition_id: input.forceDispositionId ?? null,
        p_faction_id: input.factionId ?? null,
        p_army_name: input.armyName ?? null,
        p_ladder_id: input.ladderId ?? null,
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

export function useUpdatePlayerSetup(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      gamePlayerId: string
      factionId?: string | null
      armyName?: string | null
      forceDispositionId?: string | null
      representsUserId?: string | null
    }) => {
      const patch: Database['public']['Tables']['game_players']['Update'] = {}
      if ('factionId' in input) patch.faction_id = input.factionId
      if ('armyName' in input) patch.army_name = input.armyName
      if ('forceDispositionId' in input) patch.force_disposition_id = input.forceDispositionId
      if ('representsUserId' in input) patch.represents_user_id = input.representsUserId

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
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      const patch: Partial<GamePlayerRow> = {}
      if ('factionId' in input) patch.faction_id = input.factionId
      if ('armyName' in input) patch.army_name = input.armyName
      if ('forceDispositionId' in input) patch.force_disposition_id = input.forceDispositionId
      if ('representsUserId' in input) patch.represents_user_id = input.representsUserId
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchPlayerField(previous, input.gamePlayerId, patch))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't save your setup. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

/**
 * Role and turn order are each mutually exclusive between the two seats in a game (only one
 * Attacker, only one who went first) -- picking one for yourself should set the other seat to
 * the complement, not leave the bookkeeper to also go flip it themselves. Only mirrors onto a
 * seat the caller is actually allowed to write to under RLS: unclaimed, or the caller's own
 * other seat (impossible in practice, kept for completeness) -- never a real second player's
 * claimed seat, since silently overriding their pick isn't this bookkeeper's call to make.
 *
 * Clears the other seat first, unconditionally, before setting either final value: both target
 * values are always distinct from whatever's currently on the *other* seat once that clear lands,
 * so this can never transiently collide with the field's per-game uniqueness constraint no matter
 * how the two seats' values were arranged beforehand (a straight swap included).
 */
export async function setMirroredField<T extends string>(
  setField: (gamePlayerId: string, value: T | null) => Promise<void>,
  currentUserId: string,
  me: GameDetail['players'][number],
  opponent: GameDetail['players'][number] | undefined,
  value: T | null,
  complementOf: (value: T) => T,
) {
  const canMirror = value && opponent && (!opponent.player.user_id || opponent.player.user_id === currentUserId)
  if (canMirror && opponent) {
    await setField(opponent.player.id, null)
    await setField(me.player.id, value)
    await setField(opponent.player.id, complementOf(value))
  } else {
    await setField(me.player.id, value)
  }
}

export function useSetRole(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; role: 'attacker' | 'defender' | null }) => {
      const { error } = await supabase.from('game_players').update({ role: input.role }).eq('id', input.gamePlayerId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchPlayerField(previous, input.gamePlayerId, { role: input.role }))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't update your role. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useSetTurnOrder(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; turnOrder: 'first' | 'second' | null }) => {
      const { error } = await supabase
        .from('game_players')
        .update({ turn_order: input.turnOrder })
        .eq('id', input.gamePlayerId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous)
        queryClient.setQueryData(gameKeys.detail(gameId), patchPlayerField(previous, input.gamePlayerId, { turn_order: input.turnOrder }))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't update turn order. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
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
    onMutate: async (round) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchGame(previous, { current_round: round }))
      return { previous }
    },
    onError: (_error, _round, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't advance the round. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useSetLayoutVariant(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (layoutVariant: Database['public']['Tables']['games']['Row']['layout_variant']) => {
      const { error } = await supabase.from('games').update({ layout_variant: layoutVariant }).eq('id', gameId)
      if (error) throw error
    },
    onMutate: async (layoutVariant) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchGame(previous, { layout_variant: layoutVariant }))
      return { previous }
    },
    onError: (_error, _layoutVariant, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't set the layout. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
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

export function useDrawSecondary(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      gamePlayerId: string
      battleRound: number
      secondaryObjectiveId: string
      userId: string
    }) => {
      const { error } = await supabase.from('secondary_draws').insert({
        game_id: gameId,
        game_player_id: input.gamePlayerId,
        secondary_objective_id: input.secondaryObjectiveId,
        battle_round: input.battleRound,
        drawn_by: input.userId,
      })
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchSecondaryDraw(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't draw that secondary. Check your connection and try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useUndrawSecondary(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; secondaryObjectiveId: string }) => {
      const { error } = await supabase
        .from('secondary_draws')
        .delete()
        .eq('game_player_id', input.gamePlayerId)
        .eq('secondary_objective_id', input.secondaryObjectiveId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchSecondaryUndraw(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't undo that draw. Check your connection and try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

function patchPrimaryTick(
  detail: GameDetail,
  input: { gamePlayerId: string; battleRound: number; missionObjectiveLineId: string; count: number; userId: string },
): GameDetail {
  const existing = detail.primaryTicks.find(
    (t) =>
      t.game_player_id === input.gamePlayerId &&
      t.battle_round === input.battleRound &&
      t.mission_objective_line_id === input.missionObjectiveLineId,
  )
  const now = new Date().toISOString()
  const primaryTicks = existing
    ? detail.primaryTicks.map((t) => (t === existing ? { ...t, count: input.count, updated_by: input.userId, updated_at: now } : t))
    : [
        ...detail.primaryTicks,
        {
          id: `optimistic-${input.gamePlayerId}-${input.battleRound}-${input.missionObjectiveLineId}`,
          game_id: detail.game.id,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          mission_objective_line_id: input.missionObjectiveLineId,
          count: input.count,
          updated_by: input.userId,
          updated_at: now,
        },
      ]
  return { ...detail, primaryTicks }
}

function patchSecondaryTick(
  detail: GameDetail,
  input: {
    gamePlayerId: string
    battleRound: number
    secondaryObjectiveLineId: string
    count: number
    userId: string
  },
): GameDetail {
  const existing = detail.secondaryTicks.find(
    (t) =>
      t.game_player_id === input.gamePlayerId &&
      t.battle_round === input.battleRound &&
      t.secondary_objective_line_id === input.secondaryObjectiveLineId,
  )
  const now = new Date().toISOString()
  const secondaryTicks = existing
    ? detail.secondaryTicks.map((t) =>
        t === existing ? { ...t, count: input.count, updated_by: input.userId, updated_at: now } : t,
      )
    : [
        ...detail.secondaryTicks,
        {
          id: `optimistic-${input.gamePlayerId}-${input.battleRound}-${input.secondaryObjectiveLineId}`,
          game_id: detail.game.id,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          secondary_objective_line_id: input.secondaryObjectiveLineId,
          count: input.count,
          updated_by: input.userId,
          updated_at: now,
        },
      ]
  return { ...detail, secondaryTicks }
}

/**
 * Ticks a mission objective line on/off (or sets a "for each" count).
 * Purely a record of *how* the round's primary VP was reached -- the
 * caller is responsible for also calling useUpsertRoundScore with the
 * recomputed total, since round_scores.primary_vp stays the source of
 * truth (and stays directly editable, independent of any tick).
 */
export function useUpsertPrimaryObjectiveTick(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      gamePlayerId: string
      battleRound: number
      missionObjectiveLineId: string
      count: number
      userId: string
    }) => {
      const { error } = await supabase.from('primary_objective_ticks').upsert(
        {
          game_id: gameId,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          mission_objective_line_id: input.missionObjectiveLineId,
          count: input.count,
          updated_by: input.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'game_player_id,battle_round,mission_objective_line_id' },
      )
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchPrimaryTick(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't save that. Check your connection and try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

/** Same as useUpsertPrimaryObjectiveTick, for a secondary's scoring lines. */
export function useUpsertSecondaryObjectiveTick(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      gamePlayerId: string
      battleRound: number
      secondaryObjectiveLineId: string
      count: number
      userId: string
    }) => {
      const { error } = await supabase.from('secondary_objective_ticks').upsert(
        {
          game_id: gameId,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          secondary_objective_line_id: input.secondaryObjectiveLineId,
          count: input.count,
          updated_by: input.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'game_player_id,battle_round,secondary_objective_line_id' },
      )
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchSecondaryTick(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't save that. Check your connection and try again.")
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

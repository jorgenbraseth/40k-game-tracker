import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { isGameLocked, needsVerification } from '@/lib/gameLock'
import { resolveMissionId } from '@/lib/missionResolution'
import { referenceKeys } from '@/lib/queries/referenceData'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/lib/toast'

// Re-exported so every existing call site can keep importing these from '@/lib/queries/games' --
// see gameLock.ts's own doc comment for why the actual logic lives there instead (importable from
// a unit test without pulling in supabase.ts).
export { isGameLocked, needsVerification }

type MissionPairingRow = Database['public']['Tables']['missions']['Row']

type GamePlayerRow = Database['public']['Tables']['game_players']['Row']
type GameRow = Database['public']['Tables']['games']['Row']

export const gameKeys = {
  detail: (gameId: string) => ['game', gameId] as const,
}

export interface GameDetail {
  game: GameRow
  /** Every ladder/tournament this game is tagged to (issue #75) -- a game can belong to any
   * combination of groupings at once now, not just one, so these live as their own arrays rather
   * than a single nullable column on `game` the way games.ladder_id used to work. */
  ladderIds: string[]
  tournamentIds: string[]
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
    /** +10VP if this player's army is painted (game_players.painted_bonus) -- its own thing, not
     * primary or secondary VP, entered on the End of Game screen. */
    paintedBonusVp: number
    totalVp: number
  }>
  roundScores: Database['public']['Tables']['round_scores']['Row'][]
  /** Command Points gained/spent per seat per battle round -- entered manually, same as every
   * other score, never auto-granted. Remaining CP is just the running sum, computed where it's
   * displayed rather than stored (see 20260322000000_command_points.sql). */
  commandPoints: Database['public']['Tables']['command_points']['Row'][]
  secondaryScores: Database['public']['Tables']['secondary_scores']['Row'][]
  secondaryDraws: Database['public']['Tables']['secondary_draws']['Row'][]
  primaryTicks: Database['public']['Tables']['primary_objective_ticks']['Row'][]
  secondaryTicks: Database['public']['Tables']['secondary_objective_ticks']['Row'][]
  /** One row per seat that's confirmed the result (issue #46, widened by #72 to cover a claimed
   * seat's own occupant too) -- see needsVerification() for what "still needs it" means, and
   * isGameLocked() for what "every seat has" means. */
  verifications: Database['public']['Tables']['game_player_verifications']['Row'][]
  /** The one currently-pending request to unlock this game, if any (issue #72) -- at most one at
   * a time (game_unlock_requests' own partial unique index enforces that server-side). Doesn't
   * include already-resolved requests; there's no history UI for those yet. */
  pendingUnlockRequest: Database['public']['Tables']['game_unlock_requests']['Row'] | null
  /** created_by of every ladder this game is tagged to (parallel to ladderIds) -- who may approve
   * an unlock request as a dispute-resolution override, per is_ladder_admin_for_game(). */
  ladderAdminIds: string[]
}

export async function fetchGameDetail(gameId: string): Promise<GameDetail> {
  const [
    gameRes,
    playersRes,
    roundRes,
    secondaryRes,
    secondaryDrawsRes,
    totalsRes,
    primaryTicksRes,
    secondaryTicksRes,
    verificationsRes,
    commandPointsRes,
    gameLaddersRes,
    gameTournamentsRes,
    unlockRequestRes,
  ] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).single(),
    supabase.from('game_players').select('*').eq('game_id', gameId).order('seat'),
    supabase.from('round_scores').select('*').eq('game_id', gameId),
    supabase.from('secondary_scores').select('*').eq('game_id', gameId),
    supabase.from('secondary_draws').select('*').eq('game_id', gameId),
    supabase.from('game_totals').select('*').eq('game_id', gameId),
    supabase.from('primary_objective_ticks').select('*').eq('game_id', gameId),
    supabase.from('secondary_objective_ticks').select('*').eq('game_id', gameId),
    supabase.from('game_player_verifications').select('*').eq('game_id', gameId),
    supabase.from('command_points').select('*').eq('game_id', gameId),
    supabase.from('game_ladders').select('ladder_id').eq('game_id', gameId),
    supabase.from('game_tournaments').select('tournament_id').eq('game_id', gameId),
    supabase.from('game_unlock_requests').select('*').eq('game_id', gameId).eq('status', 'pending').maybeSingle(),
  ])

  if (gameRes.error) throw gameRes.error
  if (playersRes.error) throw playersRes.error
  if (roundRes.error) throw roundRes.error
  if (secondaryRes.error) throw secondaryRes.error
  if (secondaryDrawsRes.error) throw secondaryDrawsRes.error
  if (totalsRes.error) throw totalsRes.error
  if (primaryTicksRes.error) throw primaryTicksRes.error
  if (secondaryTicksRes.error) throw secondaryTicksRes.error
  if (verificationsRes.error) throw verificationsRes.error
  if (commandPointsRes.error) throw commandPointsRes.error
  if (gameLaddersRes.error) throw gameLaddersRes.error
  if (gameTournamentsRes.error) throw gameTournamentsRes.error
  if (unlockRequestRes.error) throw unlockRequestRes.error

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

  const ladderIds = gameLaddersRes.data.map((r) => r.ladder_id)

  const [profilesRes, factionsRes, forceDispositionsRes, laddersRes] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    factionIds.length
      ? supabase.from('factions').select('id, name').in('id', factionIds)
      : Promise.resolve({ data: [], error: null }),
    forceDispositionIds.length
      ? supabase.from('force_dispositions').select('id, name').in('id', forceDispositionIds)
      : Promise.resolve({ data: [], error: null }),
    // Only who may approve an unlock request as a dispute-resolution override -- cheap enough to
    // always fetch alongside everything else rather than only when a request is actually pending.
    ladderIds.length
      ? supabase.from('ladders').select('created_by').in('id', ladderIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (profilesRes.error) throw profilesRes.error
  if (factionsRes.error) throw factionsRes.error
  if (forceDispositionsRes.error) throw forceDispositionsRes.error
  if (laddersRes.error) throw laddersRes.error

  const profileById = new Map(profilesRes.data?.map((p) => [p.id, p]))
  const factionById = new Map(factionsRes.data?.map((f) => [f.id, f.name]))
  const forceDispositionById = new Map(forceDispositionsRes.data?.map((f) => [f.id, f.name]))
  const totalsByPlayerId = new Map(totalsRes.data?.map((t) => [t.game_player_id, t]))

  return {
    game: gameRes.data,
    ladderIds,
    tournamentIds: gameTournamentsRes.data.map((r) => r.tournament_id),
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
        paintedBonusVp: totals?.painted_bonus_vp ?? 0,
        totalVp: totals?.total_vp ?? 0,
      }
    }),
    roundScores: roundRes.data,
    commandPoints: commandPointsRes.data,
    secondaryScores: secondaryRes.data,
    secondaryDraws: secondaryDrawsRes.data,
    primaryTicks: primaryTicksRes.data,
    secondaryTicks: secondaryTicksRes.data,
    verifications: verificationsRes.data,
    pendingUnlockRequest: unlockRequestRes.data,
    ladderAdminIds: [...new Set(laddersRes.data?.map((l) => l.created_by).filter((id): id is string => Boolean(id)))],
  }
}

/** A seat's running CP total: every round's cp_gained, minus every round's cp_spent, added up --
 * never stored, computed here the same "replay the rows live" way game_totals used to be
 * miscomputed server-side (see 20260321000000_fix_game_totals_fanout.sql) and everywhere else in
 * this app trusts a live sum over a cached one. */
export function remainingCp(commandPoints: GameDetail['commandPoints'], gamePlayerId: string): number {
  return commandPoints
    .filter((cp) => cp.game_player_id === gamePlayerId)
    .reduce((sum, cp) => sum + cp.cp_gained - cp.cp_spent, 0)
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

function patchCommandPoints(
  detail: GameDetail,
  input: { gamePlayerId: string; battleRound: number; cpGained: number; cpSpent: number; userId: string },
): GameDetail {
  const existing = detail.commandPoints.find(
    (cp) => cp.game_player_id === input.gamePlayerId && cp.battle_round === input.battleRound,
  )
  const now = new Date().toISOString()
  const commandPoints = existing
    ? detail.commandPoints.map((cp) =>
        cp === existing
          ? { ...cp, cp_gained: input.cpGained, cp_spent: input.cpSpent, updated_by: input.userId, updated_at: now }
          : cp,
      )
    : [
        ...detail.commandPoints,
        {
          id: `optimistic-${input.gamePlayerId}-${input.battleRound}`,
          game_id: detail.game.id,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          cp_gained: input.cpGained,
          cp_spent: input.cpSpent,
          updated_by: input.userId,
          updated_at: now,
        },
      ]
  return { ...detail, commandPoints }
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

/** The stable account behind a seat, if any -- for `PlayerNameLink` -- same priority as
 * `playerLabel`'s identity sources (own account, then whoever an unclaimed seat was attributed
 * to), but null when both are missing since there's nobody to link to yet (an army name alone
 * isn't a linkable identity). */
export function playerUserId(entry: GameDetail['players'][number] | undefined): string | null {
  return entry?.player.user_id ?? entry?.player.represents_user_id ?? null
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
      pointsLimit: number
      forceDispositionId?: string
      factionId?: string
      armyName?: string
      ladderIds?: string[]
      tournamentIds?: string[]
    }) => {
      const { data, error } = await supabase.rpc('create_game', {
        p_points_limit: input.pointsLimit,
        p_force_disposition_id: input.forceDispositionId ?? null,
        p_faction_id: input.factionId ?? null,
        p_army_name: input.armyName ?? null,
        p_ladder_ids: input.ladderIds ?? [],
        p_tournament_ids: input.tournamentIds ?? [],
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

/**
 * `missions` is this game's whole mission pack (see useMissionsForPack) -- only used to predict
 * each seat's mission optimistically (see onMutate below) the instant both Force Dispositions are
 * known, purely client-side. The actual write still always goes through resolve_game_mission
 * server-side, same as before; onSettled's invalidate reconciles with whatever it actually
 * computed, so a wrong or stale local guess (there shouldn't be one -- the same lookup the RPC
 * does) can never stick.
 */
export function useUpdatePlayerSetup(gameId: string, missions: MissionPairingRow[] = []) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      gamePlayerId: string
      factionId?: string | null
      armyName?: string | null
      armyListUrl?: string | null
      forceDispositionId?: string | null
      representsUserId?: string | null
      secondaryMode?: Database['public']['Tables']['game_players']['Row']['secondary_mode']
    }) => {
      const patch: Database['public']['Tables']['game_players']['Update'] = {}
      if ('factionId' in input) patch.faction_id = input.factionId
      if ('armyName' in input) patch.army_name = input.armyName
      if ('armyListUrl' in input) patch.army_list_url = input.armyListUrl
      if ('forceDispositionId' in input) patch.force_disposition_id = input.forceDispositionId
      if ('representsUserId' in input) patch.represents_user_id = input.representsUserId
      if ('secondaryMode' in input) patch.secondary_mode = input.secondaryMode

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
      if (!previous) return { previous }

      const patch: Partial<GamePlayerRow> = {}
      if ('factionId' in input) patch.faction_id = input.factionId
      if ('armyName' in input) patch.army_name = input.armyName
      if ('armyListUrl' in input) patch.army_list_url = input.armyListUrl
      if ('forceDispositionId' in input) patch.force_disposition_id = input.forceDispositionId
      if ('representsUserId' in input) patch.represents_user_id = input.representsUserId
      if ('secondaryMode' in input) patch.secondary_mode = input.secondaryMode
      let next = patchPlayerField(previous, input.gamePlayerId, patch)

      // Predict resolve_game_mission's result so anything depending on a resolved mission (the
      // terrain layout picker, the primary scoring checklist) doesn't sit waiting on the RPC
      // round trip -- same "patch now, reconcile on settle" as every other mutation here. Also
      // seeds useMission's own cache entry for each predicted id directly from the already-
      // in-memory pack (rather than just setting the id and letting useMission go fetch it by
      // id), since the row is right there -- so the mission's name/layout images appear the same
      // render as the id does, not one more round trip later.
      if ('forceDispositionId' in input && missions.length > 0) {
        const [p1, p2] = next.players
        if (p1 && p2) {
          const p1MissionId = resolveMissionId(missions, p1.player.force_disposition_id, p2.player.force_disposition_id)
          const p2MissionId = resolveMissionId(missions, p2.player.force_disposition_id, p1.player.force_disposition_id)
          next = patchPlayerField(next, p1.player.id, { mission_id: p1MissionId })
          next = patchPlayerField(next, p2.player.id, { mission_id: p2MissionId })
          for (const missionId of [p1MissionId, p2MissionId]) {
            const mission = missionId ? missions.find((m) => m.id === missionId) : undefined
            if (mission) queryClient.setQueryData(referenceKeys.mission(mission.id), mission)
          }
        }
      }

      queryClient.setQueryData(gameKeys.detail(gameId), next)
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
 * Role and turn order are each a single decision between the two seats, not an independent
 * choice per player (only one Attacker, only one who went first) -- like an actual roll-off at
 * the table, whoever calls it sets both seats at once. Both mutations take the id of the seat
 * that "wins" (becomes attacker / goes first) -- or null to clear both seats back to undecided --
 * and go through the set_role/set_turn_order RPCs (security definer) so either participant can
 * set the *other* seat too, even a real second player's already-claimed one; see
 * 20260324000000_shared_role_and_turn_order.sql for why a direct table update can't do that.
 */
function patchRole(detail: GameDetail, attackerGamePlayerId: string | null): GameDetail {
  return {
    ...detail,
    players: detail.players.map((p) => ({
      ...p,
      player: { ...p.player, role: attackerGamePlayerId === null ? null : p.player.id === attackerGamePlayerId ? 'attacker' : 'defender' },
    })),
  }
}

function patchTurnOrder(detail: GameDetail, firstGamePlayerId: string | null): GameDetail {
  return {
    ...detail,
    players: detail.players.map((p) => ({
      ...p,
      player: { ...p.player, turn_order: firstGamePlayerId === null ? null : p.player.id === firstGamePlayerId ? 'first' : 'second' },
    })),
  }
}

export function useSetRole(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (attackerGamePlayerId: string | null) => {
      const { error } = await supabase.rpc('set_role', { p_game_id: gameId, p_attacker_game_player_id: attackerGamePlayerId })
      if (error) throw error
    },
    onMutate: async (attackerGamePlayerId) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchRole(previous, attackerGamePlayerId))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't update the role. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useSetTurnOrder(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (firstGamePlayerId: string | null) => {
      const { error } = await supabase.rpc('set_turn_order', { p_game_id: gameId, p_first_game_player_id: firstGamePlayerId })
      if (error) throw error
    },
    onMutate: async (firstGamePlayerId) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchTurnOrder(previous, firstGamePlayerId))
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

/** Which ladders and/or tournaments this game's tagged to (issue #75) -- a shared, game-level
 * decision same as layout, so it lives in GameConfigPicker alongside it, and stays editable for
 * the life of the game like everything else here. A game can be tagged to any combination of
 * groupings at once now, not just one -- set_game_ladders/set_game_tournaments each replace their
 * own full tag set atomically (20260329000000_tournaments.sql), gated by the same server-side
 * membership check create_game already does at creation time. Both are called together here since
 * the UI edits both grouping kinds from one shared multi-select (GroupingsPicker). */
export function useSetGameGroupings(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ladderIds: string[]; tournamentIds: string[] }) => {
      const [laddersRes, tournamentsRes] = await Promise.all([
        supabase.rpc('set_game_ladders', { p_game_id: gameId, p_ladder_ids: input.ladderIds }),
        supabase.rpc('set_game_tournaments', { p_game_id: gameId, p_tournament_ids: input.tournamentIds }),
      ])
      if (laddersRes.error) throw laddersRes.error
      if (tournamentsRes.error) throw tournamentsRes.error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) {
        queryClient.setQueryData(gameKeys.detail(gameId), {
          ...previous,
          ladderIds: input.ladderIds,
          tournamentIds: input.tournamentIds,
        })
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't change the ladders/tournaments. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

/**
 * The painted-army bonus (+10VP each, if a player's army is painted) is entered on the End of
 * Game screen -- either player may set either seat's, same "bookkeeper enters both sides"
 * reasoning as round/secondary scores, not the "own seat only" rule setup fields use.
 */
export function useSetPaintedBonus(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; paintedBonus: boolean }) => {
      const { error } = await supabase
        .from('game_players')
        .update({ painted_bonus: input.paintedBonus })
        .eq('id', input.gamePlayerId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous) {
        const delta = (input.paintedBonus ? 10 : 0) - (previous.players.find((p) => p.player.id === input.gamePlayerId)?.paintedBonusVp ?? 0)
        const withPlayerField = patchPlayerField(previous, input.gamePlayerId, { painted_bonus: input.paintedBonus })
        queryClient.setQueryData(gameKeys.detail(gameId), {
          ...withPlayerField,
          players: withPlayerField.players.map((p) =>
            p.player.id === input.gamePlayerId
              ? { ...p, paintedBonusVp: p.paintedBonusVp + delta, totalVp: p.totalVp + delta }
              : p,
          ),
        })
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't save the painted bonus. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

/**
 * Confirming a seat's result is correct -- either its own occupant confirming their own claimed
 * seat, or the represented player confirming a solo-entered result is theirs (issue #46). Insert
 * -only, no "unverify": RLS only lets `verified_by` insert this for a seat they actually own
 * (user_id or represents_user_id match) on a finished game -- see
 * 20260315000000_seat_verification.sql for why this is its own table rather than a column on
 * game_players, and 20260402000000_verified_game_lock.sql for the second policy that added the
 * claimed-seat case. Once every seat in a game is verified this way it locks (isGameLocked/
 * is_game_fully_verified) -- the only way back out is the unlock request flow below.
 */
export function useVerifySeat(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { gamePlayerId: string; userId: string }) => {
      const { error } = await supabase.from('game_player_verifications').insert({
        game_player_id: input.gamePlayerId,
        game_id: gameId,
        verified_by: input.userId,
      })
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: gameKeys.detail(gameId) })
      const previous = queryClient.getQueryData<GameDetail>(gameKeys.detail(gameId))
      if (previous && !previous.verifications.some((v) => v.game_player_id === input.gamePlayerId)) {
        queryClient.setQueryData(gameKeys.detail(gameId), {
          ...previous,
          verifications: [
            ...previous.verifications,
            {
              game_player_id: input.gamePlayerId,
              game_id: gameId,
              verified_by: input.userId,
              verified_at: new Date().toISOString(),
            },
          ],
        })
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't verify this result. Try again.")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

/**
 * Propose unlocking a fully-verified game (issue #72) -- the RPC itself re-checks participancy,
 * that the game's actually locked, and that nothing's already pending, so this is a thin wrapper.
 * No optimistic update: a request needs its `id` back from the server before Approve/Reject/Cancel
 * have anything to act on, and this is rare enough that the round-trip cost doesn't matter.
 */
export function useRequestGameUnlock(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('request_game_unlock', { p_game_id: gameId })
      if (error) throw error
    },
    onError: () => showToast("Couldn't request an unlock. Try again."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

/**
 * Approving is what actually unlocks the game -- the RPC deletes both seats' verification rows as
 * part of the same transaction, so is_game_fully_verified drops back to false immediately (see
 * 20260402000000_verified_game_lock.sql's own comment on why approval alone does this rather than
 * tracking a separate "unlocked" state). Callable by the other participant or a ladder admin for a
 * ladder this game is tagged to -- the RPC is what actually enforces that; the UI just doesn't
 * offer the button to someone who plainly isn't either.
 */
export function useApproveGameUnlockRequest(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('approve_game_unlock_request', { p_request_id: requestId })
      if (error) throw error
    },
    onError: () => showToast("Couldn't approve that request. Try again."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

export function useRejectGameUnlockRequest(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('reject_game_unlock_request', { p_request_id: requestId })
      if (error) throw error
    },
    onError: () => showToast("Couldn't reject that request. Try again."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
  })
}

/** Lets the requester stand down their own still-pending request (e.g. they realize they didn't
 * need it after all) without waiting on the other side to reject it. */
export function useCancelGameUnlockRequest(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('cancel_game_unlock_request', { p_request_id: requestId })
      if (error) throw error
    },
    onError: () => showToast("Couldn't cancel that request. Try again."),
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

export function useUpsertCommandPoints(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      gamePlayerId: string
      battleRound: number
      cpGained: number
      cpSpent: number
      userId: string
    }) => {
      const { error } = await supabase.from('command_points').upsert(
        {
          game_id: gameId,
          game_player_id: input.gamePlayerId,
          battle_round: input.battleRound,
          cp_gained: input.cpGained,
          cp_spent: input.cpSpent,
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
      if (previous) queryClient.setQueryData(gameKeys.detail(gameId), patchCommandPoints(previous, input))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(gameKeys.detail(gameId), context.previous)
      showToast("Couldn't save Command Points. Check your connection and try again.")
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

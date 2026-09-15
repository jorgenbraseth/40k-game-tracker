import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { gameKeys } from '@/lib/queries/games'
import { supabase } from '@/lib/supabase'

interface PresenceMeta {
  userId: string
  displayName: string
  /** 'spectator' for a signed-in viewer who isn't one of this game's two seats -- excluded from
   * the "opponent online" indicator (see below), which is about the other *player*, not just
   * anyone else currently looking at the page. */
  role: 'player' | 'spectator'
}

/**
 * One realtime channel per game: subscribes to postgres_changes on every table
 * fetchGameDetail reads from (filtered to this game) and tracks presence so we
 * can show an "opponent connected" indicator. Each change event just
 * invalidates the game query rather than patching cache by hand -- simpler
 * and self-healing if an event is missed. Every table GameDetail is built
 * from needs its own subscription here -- draws, ticks, and verifications
 * are each their own table, not folded into round_scores/secondary_scores,
 * so a write to just one of them (e.g. drawing a secondary, with no
 * accompanying score write) wouldn't otherwise trigger a live refetch on
 * the other client until some later action happened to touch a watched
 * table.
 */
export function useGameChannel(gameId: string | undefined, me: PresenceMeta | null) {
  const queryClient = useQueryClient()
  const [opponentOnline, setOpponentOnline] = useState(false)

  useEffect(() => {
    if (!gameId || !me) return

    const invalidate = () => queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) })

    const channel = supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, invalidate)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_scores', filter: `game_id=eq.${gameId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'secondary_scores', filter: `game_id=eq.${gameId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'secondary_draws', filter: `game_id=eq.${gameId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'primary_objective_ticks', filter: `game_id=eq.${gameId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'secondary_objective_ticks', filter: `game_id=eq.${gameId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_player_verifications', filter: `game_id=eq.${gameId}` },
        invalidate,
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceMeta>()
        const otherPlayers = Object.values(state)
          .flat()
          .filter((p) => p.userId !== me.userId && p.role === 'player')
        setOpponentOnline(otherPlayers.length > 0)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          invalidate()
          await channel.track(me)
        }
      })

    return () => {
      setOpponentOnline(false)
      supabase.removeChannel(channel)
    }
    // Intentionally keyed on me.userId rather than the whole `me` object
    // (a fresh literal every render) or queryClient (a stable singleton).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, me?.userId])

  return { opponentOnline }
}

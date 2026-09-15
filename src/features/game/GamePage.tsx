import { useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { useAuth } from '@/features/auth/AuthProvider'
import { useGame } from '@/lib/queries/games'
import { useGameChannel } from '@/lib/realtime/useGameChannel'
import { Scoreboard } from './Scoreboard'
import { WaitingRoom } from './WaitingRoom'

// This is a bookkeeping tool, not a guided workflow -- a finished or
// abandoned game still opens here (not a forced redirect to /summary), so
// scores, setup and the declared result all stay correctable at any time.
//
// Any signed-in user can open any game and watch its current state, not just its own two
// participants (see 20260320000000_spectating.sql) -- isParticipant is threaded down to
// WaitingRoom/Scoreboard so they can render everything read-only for anyone else, same data,
// no tappable controls that would just fail server-side anyway.
export function GamePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useGame(id)

  const myPlayer = data?.players.find((p) => p.player.user_id === user?.id)
  const isParticipant = Boolean(myPlayer)
  // Realtime presence is broadcast to everyone subscribed to this game's channel -- never send
  // the user's email through it, only their chosen display name (already never the email either,
  // see handle_new_user) -- and tag whether this viewer is actually a player, so a spectator
  // showing up never flips the other player's "opponent online" indicator on.
  const me =
    data && user
      ? {
          userId: user.id,
          displayName: myPlayer?.profile?.display_name ?? user.id,
          role: isParticipant ? ('player' as const) : ('spectator' as const),
        }
      : null
  const { opponentOnline } = useGameChannel(id, me)

  if (isLoading) return <Spinner label="Loading game…" />
  if (isError || !data) return <ErrorBanner message="Couldn't load this game." onRetry={() => refetch()} />

  if (data.game.status === 'lobby') {
    return <WaitingRoom detail={data} opponentOnline={opponentOnline} isParticipant={isParticipant} />
  }

  return <Scoreboard detail={data} opponentOnline={opponentOnline} isParticipant={isParticipant} />
}

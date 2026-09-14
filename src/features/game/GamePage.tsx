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
export function GamePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useGame(id)

  const myPlayer = data?.players.find((p) => p.player.user_id === user?.id)
  // Realtime presence is broadcast to everyone subscribed to this game's
  // channel -- never send the user's email through it, only their chosen
  // display name (already never the email either, see handle_new_user).
  const me = data && user ? { userId: user.id, displayName: myPlayer?.profile?.display_name ?? user.id } : null
  const { opponentOnline } = useGameChannel(id, me)

  if (isLoading) return <Spinner label="Loading game…" />
  if (isError || !data) return <ErrorBanner message="Couldn't load this game." onRetry={() => refetch()} />

  if (!myPlayer) {
    return <ErrorBanner message="You're not a participant in this game." />
  }

  if (data.game.status === 'lobby') {
    return <WaitingRoom detail={data} opponentOnline={opponentOnline} />
  }

  return <Scoreboard detail={data} opponentOnline={opponentOnline} />
}

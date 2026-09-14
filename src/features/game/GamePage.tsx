import { Navigate, useParams } from 'react-router-dom'
import { ErrorBanner, Spinner } from '@/components/Feedback'
import { useAuth } from '@/features/auth/AuthProvider'
import { useGame } from '@/lib/queries/games'
import { useGameChannel } from '@/lib/realtime/useGameChannel'
import { Scoreboard } from './Scoreboard'
import { WaitingRoom } from './WaitingRoom'

export function GamePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useGame(id)

  const me = data && user ? { userId: user.id, displayName: user.email ?? user.id } : null
  const { opponentOnline } = useGameChannel(id, me)

  if (isLoading) return <Spinner label="Loading game…" />
  if (isError || !data) return <ErrorBanner message="Couldn't load this game." onRetry={() => refetch()} />

  if (data.game.status === 'complete' || data.game.status === 'abandoned') {
    return <Navigate to={`/game/${id}/summary`} replace />
  }

  const myPlayer = data.players.find((p) => p.player.user_id === user?.id)
  if (!myPlayer) {
    return <ErrorBanner message="You're not a participant in this game." />
  }

  if (data.game.status === 'lobby') {
    return <WaitingRoom detail={data} opponentOnline={opponentOnline} />
  }

  return <Scoreboard detail={data} opponentOnline={opponentOnline} />
}

import { createBrowserRouter } from 'react-router-dom'
import { AuthCallback } from '@/features/auth/AuthCallback'
import { LandingPage } from '@/features/auth/LandingPage'
import { GamePage } from '@/features/game/GamePage'
import { SummaryPage } from '@/features/game/SummaryPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { LadderJoinPage } from '@/features/ladders/LadderJoinPage'
import { LaddersPage } from '@/features/ladders/LaddersPage'
import { PrivacyPage } from '@/features/legal/PrivacyPage'
import { GameLobbyPage } from '@/features/lobby/GameLobbyPage'
import { HomePage } from '@/features/lobby/HomePage'
import { JoinGamePage } from '@/features/lobby/JoinGamePage'
import { LogGamePage } from '@/features/lobby/LogGamePage'
import { NewGamePage } from '@/features/lobby/NewGamePage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { StatsPage } from '@/features/stats/StatsPage'
import { Layout } from './Layout'
import { ProtectedRoute } from './ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/privacy', element: <PrivacyPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/game/lobby', element: <GameLobbyPage /> },
          { path: '/game/new', element: <NewGamePage /> },
          { path: '/game/join', element: <JoinGamePage /> },
          { path: '/game/join/:code', element: <JoinGamePage /> },
          { path: '/game/log', element: <LogGamePage /> },
          { path: '/game/:id', element: <GamePage /> },
          { path: '/game/:id/summary', element: <SummaryPage /> },
          { path: '/history', element: <HistoryPage /> },
          { path: '/ladders', element: <LaddersPage /> },
          { path: '/ladders/join/:code', element: <LadderJoinPage /> },
          { path: '/stats', element: <StatsPage /> },
          { path: '/players/:userId', element: <StatsPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <LandingPage /> },
])

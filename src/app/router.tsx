import { createBrowserRouter } from 'react-router-dom'
import { AuthCallback } from '@/features/auth/AuthCallback'
import { LandingPage } from '@/features/auth/LandingPage'
import { GamePage } from '@/features/game/GamePage'
import { SummaryPage } from '@/features/game/SummaryPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { HomePage } from '@/features/lobby/HomePage'
import { JoinGamePage } from '@/features/lobby/JoinGamePage'
import { NewGamePage } from '@/features/lobby/NewGamePage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { StatsPage } from '@/features/stats/StatsPage'
import { Layout } from './Layout'
import { ProtectedRoute } from './ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/game/new', element: <NewGamePage /> },
          { path: '/game/join', element: <JoinGamePage /> },
          { path: '/game/:id', element: <GamePage /> },
          { path: '/game/:id/summary', element: <SummaryPage /> },
          { path: '/history', element: <HistoryPage /> },
          { path: '/stats', element: <StatsPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <LandingPage /> },
])

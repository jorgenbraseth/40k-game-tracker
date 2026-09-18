import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from './app/ErrorBoundary'
import { LogoSync } from './app/LogoSync'
import { queryClient } from './app/queryClient'
import { router } from './app/router'
import { ThemeSync } from './app/ThemeSync'
import { Toaster } from './components/Toaster'
import { AuthProvider } from './features/auth/AuthProvider'

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeSync />
          <LogoSync />
          <RouterProvider router={router} />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

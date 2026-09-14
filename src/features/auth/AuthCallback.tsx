import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '@/components/Feedback'
import { useAuth } from './AuthProvider'

/**
 * OAuth redirect target. supabase-js's `detectSessionInUrl` exchanges the
 * code for a session automatically; we just wait for AuthProvider to pick
 * it up and then move on.
 */
export function AuthCallback() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      // Session exchange failed or this was opened directly with no code.
    }
  }, [loading, user])

  if (loading) return <Spinner label="Signing you in…" />
  return <Navigate to={user ? '/home' : '/'} replace />
}

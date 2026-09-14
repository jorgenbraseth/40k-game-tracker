import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '@/components/Feedback'
import { showToast } from '@/lib/toast'
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
      showToast("Sign-in didn't go through. Please try again.")
    }
  }, [loading, user])

  if (loading) return <Spinner label="Signing you in…" />
  return <Navigate to={user ? '/home' : '/'} replace />
}

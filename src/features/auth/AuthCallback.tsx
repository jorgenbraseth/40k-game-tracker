import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!loading && !user) {
      showToast("Sign-in didn't go through. Please try again.")
    }
  }, [loading, user])

  if (loading) return <Spinner label="Signing you in…" />
  // `next` is round-tripped through LandingPage's own redirectTo/emailRedirectTo, so it's always
  // one of this app's own paths -- still only accepted if it looks like one ("/", not "//...",
  // which a browser would treat as protocol-relative to another host) before it's trusted.
  const next = searchParams.get('next')
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/home'
  return <Navigate to={user ? safeNext : '/'} replace />
}

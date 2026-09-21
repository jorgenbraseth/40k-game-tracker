import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { NATIVE_OAUTH_REDIRECT, openNativeOAuth } from '@/lib/nativeAuth'
import { isNativePlatform } from '@/lib/platform'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

type Mode = 'login' | 'signup'

export function LandingPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)

  // Where to send the viewer once they're signed in: ProtectedRoute stashes the page they were
  // trying to reach (e.g. an invite link, /ladders/join/<code>) as location.state.from when it
  // bounces them here, so signing in lands them back where they meant to go instead of always at
  // /home. Safe to trust as a same-origin path -- it only ever comes from this app's own router
  // state, never from anything externally supplied.
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from
  const next = from ? `${from.pathname}${from.search}` : '/home'

  if (!loading && user) return <Navigate to={next} replace />

  const signInWithGoogle = async () => {
    setError(null)
    // Native (Capacitor) can't complete OAuth inside its own WebView -- Google blocks it -- so it
    // hands off to the system browser instead and picks the result back up via a deep link
    // (see src/lib/nativeAuth.ts) rather than the web build's https /auth/callback redirect.
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: isNativePlatform()
        ? { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true }
        : { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (oauthError) {
      setError(oauthError.message)
      return
    }
    if (isNativePlatform() && data.url) openNativeOAuth(data.url)
  }

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        })
        if (signUpError) throw signUpError
        setConfirmSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center text-center">
        <h1 className="sr-only">40K Tracker</h1>
        <BrandLogo altVariant="quote" className="h-36 w-auto drop-shadow-xl drop-shadow-gold/30 sm:h-44" />
        <p className="mt-3 text-paper/60">Live score tracking for tabletop Warhammer 40,000.</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-veil-strong bg-veil p-6">
        {confirmSent ? (
          <div className="text-center">
            <p className="text-paper">Check your email to confirm your account.</p>
            <button
              type="button"
              className="mt-4 text-sm text-gold underline"
              onClick={() => {
                setConfirmSent(false)
                setMode('login')
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex rounded-lg bg-veil p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`min-h-9 flex-1 rounded-md text-sm font-medium ${mode === 'login' ? 'bg-veil-strong text-paper' : 'text-paper/50'}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`min-h-9 flex-1 rounded-md text-sm font-medium ${mode === 'signup' ? 'bg-veil-strong text-paper' : 'text-paper/50'}`}
              >
                Sign up
              </button>
            </div>

            <Button type="button" variant="secondary" fullWidth onClick={signInWithGoogle}>
              Continue with Google
            </Button>

            <div className="my-4 flex items-center gap-3 text-xs text-paper/40">
              <div className="h-px flex-1 bg-veil-strong" />
              or with email
              <div className="h-px flex-1 bg-veil-strong" />
            </div>

            <form onSubmit={submitEmail} className="flex flex-col gap-3">
              {mode === 'signup' && (
                <TextField
                  label="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  placeholder="What opponents will see -- not your email"
                  required
                  minLength={2}
                />
              )}
              <TextField
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <TextField
                label="Password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={busy} fullWidth>
                {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

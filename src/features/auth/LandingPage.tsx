import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

type Mode = 'login' | 'signup'

export function LandingPage() {
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)

  if (!loading && user) return <Navigate to="/home" replace />

  const signInWithGoogle = async () => {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (oauthError) setError(oauthError.message)
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
            emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-wide text-gold">40K Tracker</h1>
        <p className="mt-2 text-paper/60">Live score tracking for tabletop Warhammer 40,000.</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
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
            <div className="mb-5 flex rounded-lg bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`min-h-9 flex-1 rounded-md text-sm font-medium ${mode === 'login' ? 'bg-white/10 text-paper' : 'text-paper/50'}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`min-h-9 flex-1 rounded-md text-sm font-medium ${mode === 'signup' ? 'bg-white/10 text-paper' : 'text-paper/50'}`}
              >
                Sign up
              </button>
            </div>

            <Button type="button" variant="secondary" fullWidth onClick={signInWithGoogle}>
              Continue with Google
            </Button>

            <div className="my-4 flex items-center gap-3 text-xs text-paper/40">
              <div className="h-px flex-1 bg-white/10" />
              or with email
              <div className="h-px flex-1 bg-white/10" />
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
              {error && <p className="text-sm text-red-400">{error}</p>}
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

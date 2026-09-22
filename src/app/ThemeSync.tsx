import { useEffect } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/lib/queries/profile'
import { applyColorMode, applyTheme, getCachedColorMode } from '@/lib/theme'

/** Keeps <html data-theme>/<html data-mode> in sync with the signed-in user's saved theme and
 * light/dark/system preference. Renders nothing -- the inline script in index.html already
 * applied the last-cached theme and resolved mode before React mounted, so there's no flash; this
 * just corrects both once the real profile loads (e.g. after signing in on a new device) and
 * re-caches them for next time.
 *
 * Also re-resolves 'system' if the OS-level preference changes while the app is open (e.g. the
 * device flips to dark mode at sunset) -- listens whenever *some* mode preference is cached
 * (covers the signed-out landing page too, not just a loaded profile), matching a signed-in
 * 'system' choice or the pre-sign-in default alike. */
export function ThemeSync() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)

  useEffect(() => {
    if (profile) applyTheme(profile.theme)
  }, [profile])

  useEffect(() => {
    if (profile) applyColorMode(profile.color_mode)
  }, [profile])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const mode = profile?.color_mode ?? getCachedColorMode()
      if (mode === 'system') applyColorMode(mode)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [profile])

  return null
}

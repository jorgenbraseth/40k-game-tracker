import { useEffect } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/lib/queries/profile'
import { applyTheme } from '@/lib/theme'

/** Keeps <html data-theme> in sync with the signed-in user's saved theme. Renders nothing -- the
 * inline script in index.html already applied the last-cached theme before React mounted, so
 * there's no flash; this just corrects it once the real profile loads (e.g. after signing in on a
 * new device) and re-caches it for next time. */
export function ThemeSync() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)

  useEffect(() => {
    if (profile) applyTheme(profile.theme)
  }, [profile])

  return null
}

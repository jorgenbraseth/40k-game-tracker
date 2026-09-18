import { useEffect } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { cacheLogo } from '@/lib/logo'
import { useProfile } from '@/lib/queries/profile'

/** Keeps the cached logo choice (see logo.ts) in sync with the signed-in user's saved profile --
 * same "correct/re-cache once the real profile loads" shape as ThemeSync. */
export function LogoSync() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)

  useEffect(() => {
    if (profile) cacheLogo(profile.logo)
  }, [profile])

  return null
}

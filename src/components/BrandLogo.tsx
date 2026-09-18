import { useAuth } from '@/features/auth/AuthProvider'
import { getCachedLogo, getLogo } from '@/lib/logo'
import { useProfile } from '@/lib/queries/profile'

/**
 * The app's crest, wherever it's shown -- the header (Layout) and the sign-in screen
 * (LandingPage). Resolves to the signed-in user's chosen logo once their profile has loaded;
 * until then (including the whole time on the signed-out landing page) falls back to whatever was
 * last cached for this device (see logo.ts), so there's no flash back to the default for a
 * returning visitor.
 */
export function BrandLogo({ className }: { className?: string }) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const logo = getLogo(profile?.logo ?? getCachedLogo())

  return <img src={logo.src} alt="40K Tracker" width={logo.width} height={logo.height} className={className} />
}

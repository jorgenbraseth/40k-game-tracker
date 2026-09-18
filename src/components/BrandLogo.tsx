import { useAuth } from '@/features/auth/AuthProvider'
import { getCachedLogo, getLogo } from '@/lib/logo'
import { useProfile } from '@/lib/queries/profile'

/**
 * The app's crest, wherever it's shown -- the header (Layout) and the sign-in screen
 * (LandingPage). Resolves to the signed-in user's chosen logo once their profile has loaded;
 * until then (including the whole time on the signed-out landing page) falls back to whatever was
 * last cached for this device (see logo.ts), so there's no flash back to the default for a
 * returning visitor.
 *
 * `altVariant="quote"` swaps the plain "40K Tracker" alt text for that crest's own flavor line
 * (see LOGOS in logo.ts) -- used on the landing page, where the logo has no surrounding nav link
 * already naming the app for a screen reader, unlike the header's NavLink wrapper.
 */
export function BrandLogo({
  className,
  altVariant = 'name',
}: {
  className?: string
  altVariant?: 'name' | 'quote'
}) {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const logo = getLogo(profile?.logo ?? getCachedLogo())
  const alt = altVariant === 'quote' ? logo.quote : '40K Tracker'

  return <img src={logo.src} alt={alt} width={logo.width} height={logo.height} className={className} />
}

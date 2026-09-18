import type { Logo } from '@/lib/database.types'

export const LOGO_STORAGE_KEY = '40k-logo'
export const DEFAULT_LOGO: Logo = 'default'

/** width/height are each file's own intrinsic pixel size (they don't share one aspect ratio) --
 * passed through to the rendered <img> so the browser can reserve the right box before it loads,
 * same reason Layout's original hardcoded logo img had them. */
export const LOGOS: { id: Logo; label: string; src: string; width: number; height: number }[] = [
  { id: 'default', label: 'Classic', src: '/images/brand/logo.webp', width: 283, height: 220 },
  { id: 'mechanicus', label: 'Mechanicus', src: '/images/brand/logo-mechanicus.webp', width: 700, height: 567 },
  { id: 'tyranid', label: 'Tyranid', src: '/images/brand/logo-tyranid.webp', width: 700, height: 576 },
  { id: 'custodes', label: 'Custodes', src: '/images/brand/logo-custodes.webp', width: 700, height: 561 },
  { id: 'orks', label: 'Orks', src: '/images/brand/logo-orks.webp', width: 700, height: 542 },
  { id: 'chaos', label: 'Chaos', src: '/images/brand/logo-chaos.webp', width: 700, height: 600 },
]

const LOGO_BY_ID = new Map(LOGOS.map((l) => [l.id, l]))

export function getLogo(id: Logo): (typeof LOGOS)[number] {
  return LOGO_BY_ID.get(id) ?? LOGO_BY_ID.get(DEFAULT_LOGO)!
}

/** Caches the signed-in user's chosen logo in localStorage, purely so a returning visit --
 * including the signed-out landing page, before any profile has loaded -- can render the right
 * crest immediately instead of a flash of the default. Mirrors theme.ts's same device-level
 * caching, minus the inline index.html bootstrap script theme needs to avoid a whole-page color
 * flash: a single swapped <img> is a far smaller flash, so reading this synchronously on mount
 * (see useLogoSrc) is enough. */
export function cacheLogo(logo: Logo) {
  try {
    localStorage.setItem(LOGO_STORAGE_KEY, logo)
  } catch {
    // storage unavailable (private browsing, etc.) -- logo still applies for this session
  }
}

export function getCachedLogo(): Logo {
  try {
    const cached = localStorage.getItem(LOGO_STORAGE_KEY)
    if (cached && LOGO_BY_ID.has(cached as Logo)) return cached as Logo
  } catch {
    // storage unavailable -- fall through to the default
  }
  return DEFAULT_LOGO
}

import type { Logo } from '@/lib/database.types'

export const LOGO_STORAGE_KEY = '40k-logo'
export const DEFAULT_LOGO: Logo = 'default'

/** width/height are each file's own intrinsic pixel size (they don't share one aspect ratio) --
 * passed through to the rendered <img> so the browser can reserve the right box before it loads,
 * same reason Layout's original hardcoded logo img had them. `quote` is a flavor line for the
 * chosen crest -- used as the landing page's alt text (see BrandLogo's `altVariant`) instead of
 * the plain "40K Tracker" the header uses, since the sign-in screen's logo has no surrounding nav
 * link to already name the app for a screen reader. */
export const LOGOS: { id: Logo; label: string; src: string; width: number; height: number; quote: string }[] = [
  {
    id: 'default',
    label: 'Classic',
    src: '/images/brand/logo.webp',
    width: 283,
    height: 220,
    quote: '40K Tracker -- the Emperor protects.',
  },
  {
    id: 'votann',
    label: 'Votann',
    src: '/images/brand/logo-votann.webp',
    width: 700,
    height: 567,
    quote: '40K Tracker -- for kin, clan, and the Ancestors watching.',
  },
  {
    id: 'tyranid',
    label: 'Tyranid',
    src: '/images/brand/logo-tyranid.webp',
    width: 700,
    height: 576,
    quote: '40K Tracker -- the Great Devourer hungers.',
  },
  {
    id: 'custodes',
    label: 'Custodes',
    src: '/images/brand/logo-custodes.webp',
    width: 700,
    height: 561,
    quote: '40K Tracker -- Ave Imperator, none shall pass unchallenged.',
  },
  {
    id: 'orks',
    label: 'Orks',
    src: '/images/brand/logo-orks.webp',
    width: 700,
    height: 542,
    quote: "40K Tracker -- WAAAGH! 'Ere we go, 'ere we go, 'ere we go!",
  },
  {
    id: 'chaos',
    label: 'Chaos',
    src: '/images/brand/logo-chaos.webp',
    width: 700,
    height: 600,
    quote: '40K Tracker -- blood for the Blood God, skulls for the Skull Throne!',
  },
  {
    id: 'sororitas',
    label: 'Sororitas',
    src: '/images/brand/logo-sororitas.webp',
    width: 700,
    height: 549,
    quote: '40K Tracker -- faith is our shield, conviction our sword.',
  },
  {
    id: 'greyknights',
    label: 'Grey Knights',
    src: '/images/brand/logo-greyknights.webp',
    width: 700,
    height: 564,
    quote: '40K Tracker -- kill the daemon, burn the witch, purge the unclean.',
  },
  {
    id: 'mechanicus',
    label: 'Mechanicus',
    src: '/images/brand/logo-mechanicus.webp',
    width: 700,
    height: 554,
    quote: '40K Tracker -- knowledge is power, guard it well.',
  },
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

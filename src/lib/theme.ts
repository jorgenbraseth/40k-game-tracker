import type { ColorMode, Theme } from '@/lib/database.types'

export const THEME_STORAGE_KEY = '40k-theme'
export const DEFAULT_THEME: Theme = 'grimdark'

export const COLOR_MODE_STORAGE_KEY = '40k-color-mode'
export const DEFAULT_COLOR_MODE: ColorMode = 'system'

/**
 * The theme *is* the crest now (see 20260922000000_collapse_theme_and_logo.sql) -- picking
 * "Thousand Sons" gets you both that palette and that logo together, not two separate pickers.
 * `grimdark` is the default, generic look (the original "Classic" logo + the original palette,
 * now one choice); the rest are one per faction.
 *
 * Every theme ships both a dark and a light palette (index.css's `[data-theme][data-mode]`
 * blocks) -- `previewDark`/`previewLight` mirror those, for swatches that need to show all
 * thirteen at once (including ones not currently active, and both of that theme's modes) without
 * reading the live CSS variables.
 *
 * `src`/`width`/`height` are each crest's own intrinsic pixel size (they don't share one aspect
 * ratio) -- passed through to the rendered <img> so the browser can reserve the right box before
 * it loads. `quote` is a flavor line for the crest -- used as the landing page's alt text (see
 * BrandLogo's `altVariant`) instead of the plain "40K Tracker" the header uses, since the sign-in
 * screen's logo has no surrounding nav link already naming the app for a screen reader.
 */
export const THEMES: {
  id: Theme
  label: string
  description: string
  previewDark: { ink: string; blood: string; gold: string }
  previewLight: { ink: string; blood: string; gold: string }
  src: string
  width: number
  height: number
  quote: string
}[] = [
  {
    id: 'grimdark',
    label: 'Grimdark',
    description: 'The original look -- ash, blood and gold.',
    previewDark: { ink: '#0b0c10', blood: '#d0201f', gold: '#e3a83a' },
    previewLight: { ink: '#f0efed', blood: '#d0201f', gold: '#8d6211' },
    src: '/images/brand/logo.webp',
    width: 283,
    height: 220,
    quote: '40K Tracker -- the Emperor protects.',
  },
  {
    id: 'votann',
    label: 'Votann',
    description: 'Forge-dark iron, burnished bronze, and the cold glow of the ancestor cores.',
    previewDark: { ink: '#14120e', blood: '#9a5a24', gold: '#2ea39a' },
    previewLight: { ink: '#f2f0eb', blood: '#9a5a24', gold: '#207973' },
    src: '/images/brand/logo-votann.webp',
    width: 700,
    height: 567,
    quote: '40K Tracker -- for kin, clan, and the Ancestors watching.',
  },
  {
    id: 'tyranid',
    label: 'Tyranid',
    description: 'Hive-void purple, bleached bone, and a synapse-green pulse.',
    previewDark: { ink: '#17101f', blood: '#6a3fa0', gold: '#9fd63c' },
    previewLight: { ink: '#f2efeb', blood: '#6a3fa0', gold: '#527416' },
    src: '/images/brand/logo-tyranid.webp',
    width: 700,
    height: 576,
    quote: '40K Tracker -- the Great Devourer hungers.',
  },
  {
    id: 'tau',
    label: "T'au",
    description: 'Sept white, pulse-rifle orange, and cold caste blue.',
    previewDark: { ink: '#0f1012', blood: '#a8451c', gold: '#5daedf' },
    previewLight: { ink: '#f2ede1', blood: '#a8451c', gold: '#1c5a80' },
    src: '/images/brand/logo-tau.webp',
    width: 700,
    height: 561,
    quote: '40K Tracker -- for the Greater Good.',
  },
  {
    id: 'orks',
    label: 'Orks',
    description: 'Oily green, scrap rust, and a flash of loot-yellow.',
    previewDark: { ink: '#12150e', blood: '#4f7322', gold: '#e8c12a' },
    previewLight: { ink: '#f2f0ea', blood: '#4f7322', gold: '#7f6810' },
    src: '/images/brand/logo-orks.webp',
    width: 700,
    height: 542,
    quote: "40K Tracker -- WAAAGH! 'Ere we go, 'ere we go, 'ere we go!",
  },
  {
    id: 'chaos',
    label: 'Chaos',
    description: 'Black iron, tarnished brass, and oathbound blood.',
    previewDark: { ink: '#0a0908', blood: '#7a1b1e', gold: '#a9812f' },
    previewLight: { ink: '#f2f0eb', blood: '#7a1b1e', gold: '#8a6823' },
    src: '/images/brand/logo-chaos.webp',
    width: 700,
    height: 600,
    quote: '40K Tracker -- blood for the Blood God, skulls for the Skull Throne!',
  },
  {
    id: 'sororitas',
    label: 'Sororitas',
    description: "Cathedral white, martyr's red, and gilded brass.",
    previewDark: { ink: '#12100f', blood: '#a3222c', gold: '#e5ba57' },
    previewLight: { ink: '#f5eeea', blood: '#a3222c', gold: '#7a5c16' },
    src: '/images/brand/logo-sororitas.webp',
    width: 700,
    height: 549,
    quote: '40K Tracker -- faith is our shield, conviction our sword.',
  },
  {
    id: 'greyknights',
    label: 'Grey Knights',
    description: 'Storm-blue steel, daemon-silver, and liberator gold.',
    previewDark: { ink: '#0f1420', blood: '#3a4f8f', gold: '#c9a53f' },
    previewLight: { ink: '#edeef0', blood: '#3a4f8f', gold: '#826922' },
    src: '/images/brand/logo-greyknights.webp',
    width: 700,
    height: 564,
    quote: '40K Tracker -- kill the daemon, burn the witch, purge the unclean.',
  },
  {
    id: 'mechanicus',
    label: 'Mechanicus',
    description: 'Oxide red, iron grey, and brazen cog-gold.',
    previewDark: { ink: '#170e0a', blood: '#8c2a1e', gold: '#b8823a' },
    previewLight: { ink: '#f4f0e9', blood: '#8c2a1e', gold: '#8e632a' },
    src: '/images/brand/logo-mechanicus.webp',
    width: 700,
    height: 554,
    quote: '40K Tracker -- knowledge is power, guard it well.',
  },
  {
    id: 'thousandsons',
    label: 'Thousand Sons',
    description: "Sorcerous blue, iron, and Prospero's gold.",
    previewDark: { ink: '#0d1626', blood: '#1f6f78', gold: '#d9a92f' },
    previewLight: { ink: '#f4f1e9', blood: '#1f6f78', gold: '#886816' },
    src: '/images/brand/logo-thousandsons.webp',
    width: 700,
    height: 546,
    quote: '40K Tracker -- trust in your allotted flaw.',
  },
  {
    id: 'darkangels',
    label: 'Dark Angels',
    description: 'Secret-keeper green, bone white, and gilded oath.',
    previewDark: { ink: '#0c1410', blood: '#1f4a34', gold: '#c9b27a' },
    previewLight: { ink: '#f2f0ea', blood: '#1f4a34', gold: '#816a32' },
    src: '/images/brand/logo-darkangels.webp',
    width: 700,
    height: 547,
    quote: '40K Tracker -- repent, redeem, endure.',
  },
  {
    id: 'worldeaters',
    label: 'World Eaters',
    description: 'Blood-hot red, brass, and skull-bone white.',
    previewDark: { ink: '#120605', blood: '#b31f1a', gold: '#b8823a' },
    previewLight: { ink: '#f3efea', blood: '#b31f1a', gold: '#8e632a' },
    src: '/images/brand/logo-worldeaters.webp',
    width: 700,
    height: 546,
    quote: '40K Tracker -- kill! maim! burn!',
  },
  {
    id: 'spacewolves',
    label: 'Space Wolves',
    description: 'Fenrisian frost, iron-grey, and rune-bronze.',
    previewDark: { ink: '#0e1013', blood: '#3c5a72', gold: '#e0ab5d' },
    previewLight: { ink: '#eef1f4', blood: '#3c5a72', gold: '#8a5f1e' },
    src: '/images/brand/logo-spacewolves.webp',
    width: 700,
    height: 547,
    quote: '40K Tracker -- strength through the pack.',
  },
]

const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]))

export function getTheme(id: Theme): (typeof THEMES)[number] {
  return THEME_BY_ID.get(id) ?? THEME_BY_ID.get(DEFAULT_THEME)!
}

/** Mirrors the inline bootstrap script in index.html, which sets data-theme/data-mode from these
 * same keys before React (and this module) ever load, to avoid a flash of the wrong look. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // storage unavailable (private browsing, etc.) -- theme still applies for this session
  }
}

export function getCachedTheme(): Theme {
  try {
    const cached = localStorage.getItem(THEME_STORAGE_KEY)
    if (cached && THEME_BY_ID.has(cached as Theme)) return cached as Theme
  } catch {
    // storage unavailable -- fall through to the default
  }
  return DEFAULT_THEME
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

/** Resolves 'system' against the OS/browser preference right now -- 'light'/'dark' pass through
 * unchanged. The resolved value (never 'system' itself) is what actually goes on data-mode; the
 * raw preference is what's cached, so a later OS-level change is picked up next resolve rather
 * than baked in. */
export function resolveColorMode(mode: ColorMode): 'light' | 'dark' {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

/** Mirrors the inline bootstrap script in index.html, same shape as applyTheme. */
export function applyColorMode(mode: ColorMode) {
  document.documentElement.setAttribute('data-mode', resolveColorMode(mode))
  try {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
  } catch {
    // storage unavailable (private browsing, etc.) -- mode still applies for this session
  }
}

export function getCachedColorMode(): ColorMode {
  try {
    const cached = localStorage.getItem(COLOR_MODE_STORAGE_KEY)
    if (cached === 'light' || cached === 'dark' || cached === 'system') return cached
  } catch {
    // storage unavailable -- fall through to the default
  }
  return DEFAULT_COLOR_MODE
}

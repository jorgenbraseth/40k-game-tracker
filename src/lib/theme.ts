import type { Theme } from '@/lib/database.types'

export const THEME_STORAGE_KEY = '40k-theme'
export const DEFAULT_THEME: Theme = 'grimdark'

/** `preview` mirrors that theme's [data-theme] block in index.css -- swatches on the profile
 * page's theme picker need to show all four themes at once, including ones not currently active,
 * so they can't just read the live CSS variables. */
export const THEMES: { id: Theme; label: string; description: string; preview: { ink: string; blood: string; gold: string } }[] = [
  {
    id: 'grimdark',
    label: 'Grimdark',
    description: 'The original look -- ash, blood and gold.',
    preview: { ink: '#0b0c10', blood: '#d0201f', gold: '#e3a83a' },
  },
  {
    id: 'astartes',
    label: 'Astartes',
    description: 'Dark power-armor blue with a bold highlight.',
    preview: { ink: '#141a24', blood: '#2e5aa8', gold: '#5b8def' },
  },
  {
    id: 'aeldari',
    label: 'Aeldari',
    description: 'Airy wraithbone with jade and amethyst.',
    preview: { ink: '#f4f1ea', blood: '#5b3a94', gold: '#146356' },
  },
  {
    id: 'parchment',
    label: 'Parchment',
    description: 'Warm Inquisitorial parchment and brass.',
    preview: { ink: '#ede4d3', blood: '#a4222b', gold: '#7a5c16' },
  },
]

/** Mirrors the inline bootstrap script in index.html, which sets data-theme from this same
 * key before React (and this module) ever load, to avoid a flash of the wrong theme. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // storage unavailable (private browsing, etc.) -- theme still applies for this session
  }
}

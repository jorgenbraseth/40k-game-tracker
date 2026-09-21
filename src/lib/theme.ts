import type { Theme } from '@/lib/database.types'

export const THEME_STORAGE_KEY = '40k-theme'
export const DEFAULT_THEME: Theme = 'grimdark'

/** `preview` mirrors that theme's [data-theme] block in index.css -- swatches on the profile
 * page's theme picker need to show all sixteen themes at once, including ones not currently
 * active, so they can't just read the live CSS variables. */
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
  // Faction-paired themes below -- one per non-default crest in logo.ts's LOGOS, same id as the
  // matching Logo value so the two are easy to reason about together, though theme and crest stay
  // two fully independent pickers on the profile page, same as the four generic themes above.
  {
    id: 'votann',
    label: 'Votann',
    description: 'Forge-dark iron, burnished bronze, and the cold glow of the ancestor cores.',
    preview: { ink: '#14120e', blood: '#9a5a24', gold: '#2ea39a' },
  },
  {
    id: 'tyranid',
    label: 'Tyranid',
    description: 'Hive-void purple, bleached bone, and a synapse-green pulse.',
    preview: { ink: '#17101f', blood: '#6a3fa0', gold: '#9fd63c' },
  },
  {
    id: 'tau',
    label: "T'au",
    description: 'Sept white, pulse-rifle orange, and cold caste blue.',
    preview: { ink: '#f2ede1', blood: '#a8451c', gold: '#1c5a80' },
  },
  {
    id: 'orks',
    label: 'Orks',
    description: 'Oily green, scrap rust, and a flash of loot-yellow.',
    preview: { ink: '#12150e', blood: '#4f7322', gold: '#e8c12a' },
  },
  {
    id: 'chaos',
    label: 'Chaos',
    description: 'Black iron, tarnished brass, and oathbound blood.',
    preview: { ink: '#0a0908', blood: '#7a1b1e', gold: '#a9812f' },
  },
  {
    id: 'sororitas',
    label: 'Sororitas',
    description: "Cathedral white, martyr's red, and gilded brass.",
    preview: { ink: '#f5eeea', blood: '#a3222c', gold: '#7a5c16' },
  },
  {
    id: 'greyknights',
    label: 'Grey Knights',
    description: 'Storm-blue steel, daemon-silver, and liberator gold.',
    preview: { ink: '#0f1420', blood: '#3a4f8f', gold: '#c9a53f' },
  },
  {
    id: 'mechanicus',
    label: 'Mechanicus',
    description: 'Oxide red, iron grey, and brazen cog-gold.',
    preview: { ink: '#170e0a', blood: '#8c2a1e', gold: '#b8823a' },
  },
  {
    id: 'thousandsons',
    label: 'Thousand Sons',
    description: "Sorcerous blue, iron, and Prospero's gold.",
    preview: { ink: '#0d1626', blood: '#1f6f78', gold: '#d9a92f' },
  },
  {
    id: 'darkangels',
    label: 'Dark Angels',
    description: 'Secret-keeper green, bone white, and gilded oath.',
    preview: { ink: '#0c1410', blood: '#1f4a34', gold: '#c9b27a' },
  },
  {
    id: 'worldeaters',
    label: 'World Eaters',
    description: 'Blood-hot red, brass, and skull-bone white.',
    preview: { ink: '#120605', blood: '#b31f1a', gold: '#b8823a' },
  },
  {
    id: 'spacewolves',
    label: 'Space Wolves',
    description: 'Fenrisian frost, iron-grey, and rune-bronze.',
    preview: { ink: '#eef1f4', blood: '#3c5a72', gold: '#8a5f1e' },
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

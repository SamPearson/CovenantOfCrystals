/**
 * UI theme — the single place to tweak the look and feel of the meta UI.
 *
 * No design language is established yet, so every visual value lives here:
 * colors, fonts, spacing, panel and button dimensions. Panels and widgets
 * never hardcode a color or size; they read from THEME.
 */

export const THEME = {
  colors: {
    // backgrounds
    bg: 0x141428,
    panel: 0x1e1e38,
    panelAlt: 0x242446,
    slotEmpty: 0x161630,
    // borders
    border: 0x3a3a66,
    borderLight: 0x4a4a7a,
    // accents
    accent: 0x8b7cf6,
    accentDark: 0x5a4fbf,
    accentSoft: 0x2a2650,
    // states
    hover: 0x2a2a55,
    selected: 0x3d3570,
    disabled: 0x2a2a44,
    // text
    text: '#e0e0f0',
    textMuted: '#9a9ac0',
    textDim: '#6a6a92',
    textOnAccent: '#141428',
    // semantic
    good: '#4ade80',
    warn: '#fbbf24',
    bad: '#f87171',
  },

  rarity: {
    common: '#9ca3af',
    rare: '#60a5fa',
    epic: '#c084fc',
    legendary: '#fbbf24',
  },

  fonts: {
    family: 'monospace',
    size: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 18,
      xl: 26,
    },
  },

  spacing: {
    pad: 12,
    gap: 8,
  },

  panel: {
    alpha: 0.92,
    borderWidth: 2,
  },

  button: {
    width: 150,
    height: 34,
    radius: 6,
  },

  slot: {
    size: 46,
    gap: 4,
    cols: 6,
    rows: 5,
  },

  header: {
    height: 48,
  },

  tabs: {
    height: 40,
  },
} as const

export type Theme = typeof THEME
export type ThemeFontSize = keyof Theme['fonts']['size']
export type ThemeColor = keyof Theme['colors']

/** Converts a '#rrggbb' string to a numeric color (Phaser fill/stroke value). */
export function hexColor(hex: string): number {
  return parseInt(hex.slice(1), 16)
}

/** Converts a numeric Phaser color to a '#rrggbb' string (text styles). */
export function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

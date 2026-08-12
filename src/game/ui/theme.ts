/**
 * UI themes — the single place to tweak the look and feel of the meta UI.
 *
 * Each theme is a complete visual language: colors, fonts, spacing, panel and
 * button dimensions. Panels and widgets never hardcode a color or size; they
 * read from THEME, which points at the active theme. Add a new entry to THEMES
 * to make it selectable later.
 *
 * The default "earthstone" theme is inspired by the carved-stone / aged
 * manuscript menus of Breath of Fire IV and Final Fantasy Tactics: deep green
 * slate and moss, bone-pale borders and a gold-bronze accent, with pale sage
 * and ivory text.
 */

export interface ThemeFonts {
  /** Ornate serif for titles, section headers and button plaques. */
  display: string
  /** Readable serif for body content. */
  body: string
  size: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
  }
}

export interface ThemeColors {
  // backgrounds
  /** Deepest background (dark green-black). */
  bg: number
  /** Deepest tone used for the background vignette edges. */
  bgVignette: number
  // surfaces
  /** Dark carved frame that surrounds panels. */
  panel: number
  /** Stone face of panels and large wells. */
  face: number
  /** Lighter stone for sub-panels and list rows. */
  panelAlt: number
  /** Recessed empty cell (box slots). */
  slotEmpty: number
  // borders
  border: number
  borderLight: number
  // accents
  accent: number
  accentDark: number
  accentSoft: number
  accentBlue: number
  gold: number
  // states
  hover: number
  selected: number
  disabled: number
  // text
  text: string
  textMuted: string
  textDim: string
  textOnAccent: string
  // semantic
  good: string
  warn: string
  bad: string
}

export interface Theme {
  colors: ThemeColors
  rarity: Record<'common' | 'rare' | 'epic' | 'legendary', number>
  fonts: ThemeFonts
  spacing: { pad: number; gap: number }
  panel: { alpha: number; borderWidth: number; radius: number; inset: number }
  button: { width: number; height: number; radius: number }
  slot: { size: number; gap: number; cols: number; rows: number }
  header: { height: number }
  tabs: { height: number }
}

export const THEMES: Record<string, Theme> = {
  earthstone: {
    colors: {
      bg: 0x0a1a2e,
      bgVignette: 0x040d1c,
      panel: 0x0f3a2c,
      face: 0xdbd0b4,
      panelAlt: 0xcdc1a2,
      slotEmpty: 0xb8ac8d,
      border: 0x114031,
      borderLight: 0xeee3c6,
      accent: 0x024a21,
      accentDark: 0x01371c,
      accentSoft: 0xcfe0c4,
      accentBlue: 0x16305e,
      gold: 0xd8b96a,
      hover: 0x0b5c31,
      selected: 0xbfd2ab,
      disabled: 0x3a4a3e,
      text: '#17352b',
      textMuted: '#5a6a5f',
      textDim: '#87917f',
      textOnAccent: '#efe6d0',
      good: '#2f7d4f',
      warn: '#9a6a1f',
      bad: '#a3473f',
    },

    rarity: {
      common: 0x6f6a5c,
      rare: 0x3f6b8f,
      epic: 0x2e7d63,
      legendary: 0x9a6f1f,
    },

    fonts: {
      display: "'IM Fell English', Georgia, 'Times New Roman', serif",
      body: "'EB Garamond', Georgia, 'Times New Roman', serif",
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
      alpha: 0.94,
      borderWidth: 2,
      radius: 8,
      inset: 3,
    },

    button: {
      width: 150,
      height: 34,
      radius: 4,
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
  },
}

export const THEME: Theme = THEMES.earthstone

export type ThemeFontSize = keyof Theme['fonts']['size']
export type ThemeColor = keyof Theme['colors']

/** Converts a '#rrggbb' string to a numeric color (Phaser fill/stroke value). */
export function hexColor(hex: string): number {
  return parseInt(hex.slice(1), 16)
}

/** Converts a numeric Phaser color to a '#rrggbb' string (canvas/text styles). */
export function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

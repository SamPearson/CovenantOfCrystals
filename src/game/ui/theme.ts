/**
 * The active UI theme — the single place widgets read styling from.
 *
 * Panels and widgets never hardcode a color or size; they read `THEME`, which
 * points at the currently active theme. Data model, presets, and the color
 * profile store (create/edit/activate/save/load/delete) live in
 * `core/themes.ts`; this module is the thin UI-side bridge that holds the
 * *active* Theme and re-exports the shared types + helpers.
 *
 * `THEME` is reassigned by `setTheme` (e.g. when a saved color profile is
 * activated), and all importers see the live binding.
 */

import { PRESET_THEMES, themeFromProfile, type ThemeProfile } from '../../core/themes'
import type { Theme } from '../../core/themes'
import { ELEMENTS } from '../../core/data/elements'
import type { Element } from '../../core/types'

export { hexColor, colorHex } from '../../core/themes'
export type { Theme, ThemeColors, ThemeFonts, ThemeRarity, ThemeColorKey } from '../../core/themes'

/**
 * Per-element identity colors used anywhere an element is shown on its own
 * (tooltip chip lines, gear flavor, skill lines). Not part of a Theme profile —
 * these are fixed hues tuned to read on every panel surface.
 */
export const ELEMENT_COLORS: Record<Element, string> = {
  fire: '#c8684a',
  water: '#4a8fb8',
  frost: '#6da7c9',
  earth: '#7d9a55',
  holy: '#c9b25a',
  shadow: '#8669b8',
  none: '#9aa58f',
}

export function elementColor(element: Element): string {
  return ELEMENT_COLORS[element]
}

export function getElementColors(): { element: Element; color: string }[] {
  return ELEMENTS.map((element) => ({ element, color: ELEMENT_COLORS[element] }))
}

export const THEMES: Record<string, Theme> = PRESET_THEMES

export let THEME: Theme = PRESET_THEMES.earthstone

export function setTheme(theme: Theme): void {
  THEME = theme
}

/** Builds the theme for a profile and makes it active. */
export function applyThemeProfile(profile: ThemeProfile): Theme {
  const theme = themeFromProfile(profile)
  setTheme(theme)
  return theme
}

export type ThemeFontSize = keyof Theme['fonts']['size']
export type ThemeColor = keyof Theme['colors']

/**
 * Color theming — data model and profile store.
 *
 * The game UI reads a single active `Theme` (structural layout + colors).
 * Players can create / edit / activate / save / load / delete their own
 * **color profiles**: the palette (backgrounds, surfaces, borders, accents,
 * text, semantic colors) plus the four rarity tints. Fonts, spacing and
 * dimensions are fixed structural presets and are not user-editable.
 *
 * This module is pure logic (no Phaser), so it is fully unit-testable
 * (docs/architecture.md §7). Persistence mirrors `save.service.ts`:
 * localStorage with a schema version. Only user-created profiles are stored;
 * built-in presets live in code and cannot be edited or deleted (they are the
 * safety net / "load defaults").
 */

import { uuid } from './id'
import { ValidationError } from './validation'

export interface ThemeColors {
  // backgrounds
  bg: number
  bgVignette: number
  // surfaces
  panel: number
  face: number
  panelAlt: number
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

export interface ThemeRarity {
  common: number
  rare: number
  epic: number
  legendary: number
}

export interface ThemeFonts {
  display: string
  body: string
  size: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
  }
}

export interface Theme {
  colors: ThemeColors
  rarity: ThemeRarity
  fonts: ThemeFonts
  spacing: { pad: number; gap: number }
  panel: { alpha: number; borderWidth: number; radius: number; inset: number }
  button: { width: number; height: number; radius: number }
  slot: { size: number; gap: number; cols: number; rows: number }
  header: { height: number }
  tabs: { height: number }
}

/** A saved color profile (what the editor edits / the game loads). */
export interface ThemeProfile {
  id: string
  name: string
  colors: ThemeColors
  rarity: ThemeRarity
  createdAt: number
  updatedAt: number
}

export type ThemeColorKey = keyof ThemeColors
export type ThemeRarityKey = keyof ThemeRarity

export interface ThemeColorKeyMeta {
  key: ThemeColorKey
  label: string
  group: string
  /** 'num' = Phaser numeric color; 'str' = '#rrggbb' string (canvas/text styles). */
  kind: 'num' | 'str'
}

/** Ordered, grouped list of editable color keys — drives the editor and validation. */
export const THEME_COLOR_KEYS: ThemeColorKeyMeta[] = [
  { key: 'bg', label: 'Background', group: 'Backgrounds', kind: 'num' },
  { key: 'bgVignette', label: 'Vignette', group: 'Backgrounds', kind: 'num' },
  { key: 'panel', label: 'Panel', group: 'Surfaces', kind: 'num' },
  { key: 'face', label: 'Panel face', group: 'Surfaces', kind: 'num' },
  { key: 'panelAlt', label: 'Alt surface', group: 'Surfaces', kind: 'num' },
  { key: 'slotEmpty', label: 'Empty slot', group: 'Surfaces', kind: 'num' },
  { key: 'border', label: 'Border', group: 'Borders', kind: 'num' },
  { key: 'borderLight', label: 'Border highlight', group: 'Borders', kind: 'num' },
  { key: 'accent', label: 'Accent', group: 'Accents', kind: 'num' },
  { key: 'accentDark', label: 'Accent dark', group: 'Accents', kind: 'num' },
  { key: 'accentSoft', label: 'Accent soft', group: 'Accents', kind: 'num' },
  { key: 'accentBlue', label: 'Accent blue', group: 'Accents', kind: 'num' },
  { key: 'gold', label: 'Gold', group: 'Accents', kind: 'num' },
  { key: 'hover', label: 'Hover', group: 'States', kind: 'num' },
  { key: 'selected', label: 'Selected', group: 'States', kind: 'num' },
  { key: 'disabled', label: 'Disabled', group: 'States', kind: 'num' },
  { key: 'text', label: 'Text', group: 'Text', kind: 'str' },
  { key: 'textMuted', label: 'Text muted', group: 'Text', kind: 'str' },
  { key: 'textDim', label: 'Text dim', group: 'Text', kind: 'str' },
  { key: 'textOnAccent', label: 'Text on accent', group: 'Text', kind: 'str' },
  { key: 'good', label: 'Good', group: 'Semantic', kind: 'str' },
  { key: 'warn', label: 'Warn', group: 'Semantic', kind: 'str' },
  { key: 'bad', label: 'Bad', group: 'Semantic', kind: 'str' },
]

export const RARITY_KEYS: { key: ThemeRarityKey; label: string }[] = [
  { key: 'common', label: 'Common' },
  { key: 'rare', label: 'Rare' },
  { key: 'epic', label: 'Epic' },
  { key: 'legendary', label: 'Legendary' },
]

export const DEFAULT_THEME_ID = 'earthstone'

/**
 * Built-in themes — canonical presets. Structural layout (fonts/spacing/dims)
 * is shared by every preset and defined here once; user profiles only
 * override colors + rarity.
 */
const STRUCTURE: Omit<Theme, 'colors' | 'rarity'> = {
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
}

export const PRESET_THEMES: Record<string, Theme> = {
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

    ...STRUCTURE,
  },

  /**
   * Midnight — cool slate "night watch" palette. All surfaces stay dark, so
   * text, headings and gold read strongly everywhere; the blue accent keeps
   * buttons and chips legible with dark label text.
   */
  midnight: {
    colors: {
      bg: 0x0c1423,
      bgVignette: 0x060b16,
      panel: 0x131d2f,
      face: 0x1a263a,
      panelAlt: 0x22304a,
      slotEmpty: 0x293952,
      border: 0x2c3e5c,
      borderLight: 0x41587d,
      accent: 0x57a0ff,
      accentDark: 0x2c6fd0,
      accentSoft: 0x243a5e,
      accentBlue: 0x3f79c4,
      gold: 0xe8b84a,
      hover: 0x66aaff,
      selected: 0x31507f,
      disabled: 0x1d2739,
      text: '#e7ecf5',
      textMuted: '#a9b8cc',
      textDim: '#71839c',
      textOnAccent: '#081631',
      good: '#66d29b',
      warn: '#f0c355',
      bad: '#ff7a6e',
    },

    rarity: {
      common: 0x62748c,
      rare: 0x4f9be6,
      epic: 0x9a7fe0,
      legendary: 0xe8b84a,
    },

    ...STRUCTURE,
  },

  /**
   * Obsidian — warm charcoal with an ember accent. A cozy mid-contrast dark
   * look: every surface is a dark neutral, so gold headings and muted text
   * never fight a light background.
   */
  obsidian: {
    colors: {
      bg: 0x110d0b,
      bgVignette: 0x070504,
      panel: 0x1a1613,
      face: 0x241e19,
      panelAlt: 0x2c2520,
      slotEmpty: 0x342c25,
      border: 0x453a30,
      borderLight: 0x5c4e41,
      accent: 0xff9f43,
      accentDark: 0xd97a1f,
      accentSoft: 0x3b2e1f,
      accentBlue: 0x7d94c4,
      gold: 0xe8b84a,
      hover: 0xffad5e,
      selected: 0x4a3a2a,
      disabled: 0x2e2823,
      text: '#f1eae0',
      textMuted: '#cbbda8',
      textDim: '#8d7e69',
      textOnAccent: '#2c1704',
      good: '#8fd16a',
      warn: '#e8c15a',
      bad: '#ff7d72',
    },

    rarity: {
      common: 0x7a7064,
      rare: 0x6d8fc9,
      epic: 0x4fa886,
      legendary: 0xe8b84a,
    },

    ...STRUCTURE,
  },

  /**
   * Parchment — light aged-paper palette. The inverse of the darks: everything
   * is warm and light, with dark ink text and a deep bronze-gold accent used
   * for headings (readable on the light card surfaces).
   */
  parchment: {
    colors: {
      bg: 0x968a60,
      bgVignette: 0x6e6345,
      panel: 0xe6dfc9,
      face: 0xf6f1e2,
      panelAlt: 0xece5d0,
      slotEmpty: 0xd9d0b4,
      border: 0xb3a87f,
      borderLight: 0xc9bf9c,
      accent: 0x376b43,
      accentDark: 0x29522f,
      accentSoft: 0xd7e2cd,
      accentBlue: 0x4a6fa5,
      gold: 0x7a5a12,
      hover: 0x468253,
      selected: 0xc6d6b5,
      disabled: 0xcfc8b4,
      text: '#2b2a20',
      textMuted: '#57564a',
      textDim: '#87856d',
      textOnAccent: '#f8f4e5',
      good: '#2e7d3a',
      warn: '#9a6a12',
      bad: '#b23b30',
    },

    rarity: {
      common: 0x8a8672,
      rare: 0x3f6ea0,
      epic: 0x2f8f74,
      legendary: 0x996a16,
    },

    ...STRUCTURE,
  },
}

const PRESET_NAMES: Record<string, string> = {
  earthstone: 'Earthstone',
  midnight: 'Midnight',
  obsidian: 'Obsidian',
  parchment: 'Parchment',
}

/** Converts a '#rrggbb' string to a numeric color (Phaser fill/stroke value). */
export function hexColor(hex: string): number {
  return parseInt(hex.slice(1), 16)
}

/** Converts a numeric Phaser color to a '#rrggbb' string (canvas/text styles). */
export function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export function isPresetProfile(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRESET_THEMES, id)
}

function presetProfiles(): ThemeProfile[] {
  return Object.entries(PRESET_THEMES).map(([id, theme]) => ({
    id,
    name: PRESET_NAMES[id] ?? id,
    colors: { ...theme.colors },
    rarity: { ...theme.rarity },
    createdAt: 0,
    updatedAt: 0,
  }))
}

/** Builds the full `Theme` shown by the UI from a profile's colors + rarity. */
export function themeFromProfile(profile: ThemeProfile): Theme {
  const base = PRESET_THEMES[DEFAULT_THEME_ID]
  return {
    ...base,
    colors: { ...profile.colors },
    rarity: { ...profile.rarity },
  }
}

/** True when two themes differ only structurally (colors + rarity identical). */
export function themesEqual(a: Theme, b: Theme): boolean {
  for (const meta of THEME_COLOR_KEYS) {
    if (a.colors[meta.key] !== b.colors[meta.key]) return false
  }
  for (const r of RARITY_KEYS) {
    if (a.rarity[r.key] !== b.rarity[r.key]) return false
  }
  return true
}

// --- Persistence -----------------------------------------------------------

export const THEMES_KEY = 'covenant.of.crystals.themes'
export const THEMES_SCHEMA_VERSION = 1

interface ThemeStoreFile {
  schemaVersion: number
  activeId: string
  profiles: ThemeProfile[]
}

function storage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    return null
  }
  return null
}

// --- Store --------------------------------------------------------------

let initialized = false
let profiles: ThemeProfile[] = []
let activeId = DEFAULT_THEME_ID
let listeners = new Set<() => void>()

export function initThemes(): void {
  if (initialized) return
  profiles = presetProfiles()
  activeId = DEFAULT_THEME_ID

  const s = storage()
  if (s) {
    const raw = s.getItem(THEMES_KEY)
    if (raw) {
      try {
        const file = validateThemeStoreFile(JSON.parse(raw))
        const userProfiles = file.profiles.filter((p) => !isPresetProfile(p.id))
        profiles = [...presetProfiles(), ...userProfiles]
        if (profiles.some((p) => p.id === file.activeId)) activeId = file.activeId
      } catch {
        // Corrupt theme store — fall back to defaults.
        profiles = presetProfiles()
        activeId = DEFAULT_THEME_ID
      }
    }
  }
  initialized = true
}

/** Test helper: clears in-memory theme state and listeners. */
export function resetThemes(): void {
  initialized = false
  profiles = []
  activeId = DEFAULT_THEME_ID
  listeners = new Set()
}

function saveThemes(): void {
  const s = storage()
  if (s) {
    const file: ThemeStoreFile = {
      schemaVersion: THEMES_SCHEMA_VERSION,
      activeId,
      profiles: profiles.filter((p) => !isPresetProfile(p.id)),
    }
    s.setItem(THEMES_KEY, JSON.stringify(file))
  }
  for (const listener of listeners) listener()
}

export function getThemeProfiles(): ThemeProfile[] {
  initThemes()
  return profiles.map((p) => ({ ...p, colors: { ...p.colors }, rarity: { ...p.rarity } }))
}

export function getProfileById(id: string): ThemeProfile | null {
  initThemes()
  const p = profiles.find((x) => x.id === id)
  return p ? { ...p, colors: { ...p.colors }, rarity: { ...p.rarity } } : null
}

export function getActiveProfile(): ThemeProfile {
  initThemes()
  const p = profiles.find((x) => x.id === activeId) ?? profiles[0]
  return { ...p, colors: { ...p.colors }, rarity: { ...p.rarity } }
}

export function getActiveTheme(): Theme {
  return themeFromProfile(getActiveProfile())
}

export function subscribeThemes(listener: () => void): () => void {
  initThemes()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function requireProfile(id: string): ThemeProfile {
  const p = profiles.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown theme profile: ${id}`)
  return p
}

function assertEditable(id: string): void {
  if (isPresetProfile(id)) throw new Error('Built-in themes cannot be edited or deleted')
}

function touch(p: ThemeProfile): void {
  p.updatedAt = Date.now()
}

/**
 * Creates a profile cloned from an existing one and activates it. User profiles
 * can be edited; built-ins are duplicated first (the "customize from preset"
 * flow).
 */
export function createProfileFrom(sourceId: string, name?: string): ThemeProfile {
  initThemes()
  const source = profiles.find((x) => x.id === sourceId) ?? getActiveProfile()
  const userCount = profiles.filter((p) => !isPresetProfile(p.id)).length
  const now = Date.now()
  const profile: ThemeProfile = {
    id: uuid(),
    name: name?.trim() || `Custom ${userCount + 1}`,
    colors: { ...source.colors },
    rarity: { ...source.rarity },
    createdAt: now,
    updatedAt: now,
  }
  profiles.push(profile)
  activeId = profile.id
  saveThemes()
  return { ...profile, colors: { ...profile.colors }, rarity: { ...profile.rarity } }
}

export function createProfile(name?: string): ThemeProfile {
  return createProfileFrom(getActiveProfile().id, name)
}

export function renameProfile(id: string, name: string): void {
  initThemes()
  assertEditable(id)
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Theme name cannot be empty')
  const p = requireProfile(id)
  p.name = trimmed
  touch(p)
  saveThemes()
}

/**
 * A patch of color values. Either the native Phaser number or a '#rrggbb'
 * string may be given for any key; the store normalizes by the key's kind.
 */
export type ThemeColorPatch = Partial<Record<ThemeColorKey, number | string>>
export type ThemeRarityPatch = Partial<Record<ThemeRarityKey, number | string>>

export function updateProfileColors(id: string, colors: ThemeColorPatch): void {
  initThemes()
  assertEditable(id)
  const p = requireProfile(id)
  for (const [key, value] of Object.entries(colors)) {
    const meta = THEME_COLOR_KEYS.find((m) => m.key === key)
    if (!meta) continue
    ;(p.colors as unknown as Record<string, unknown>)[key] = normalizeColorValue(meta.kind, value)
  }
  touch(p)
  saveThemes()
}

export function updateProfileRarity(id: string, rarity: ThemeRarityPatch): void {
  initThemes()
  assertEditable(id)
  const p = requireProfile(id)
  for (const [key, value] of Object.entries(rarity)) {
    if (!RARITY_KEYS.some((r) => r.key === key)) continue
    ;(p.rarity as unknown as Record<string, unknown>)[key] = normalizeColorValue('num', value)
  }
  touch(p)
  saveThemes()
}

export function activateProfile(id: string): void {
  initThemes()
  requireProfile(id)
  activeId = id
  saveThemes()
}

export function deleteProfile(id: string): void {
  initThemes()
  assertEditable(id)
  requireProfile(id)
  profiles = profiles.filter((p) => p.id !== id)
  if (activeId === id) activeId = DEFAULT_THEME_ID
  saveThemes()
}

/** Explicit save — writes the store file (mutations already persist; this is the "Save" affordance). */
export function persistThemes(): void {
  initThemes()
  saveThemes()
}

function normalizeColorValue(kind: 'num' | 'str', value: unknown): number | string {
  if (kind === 'num') {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) return hexColor(value)
    throw new Error(`Invalid numeric color value: ${String(value)}`)
  }
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) return value
  if (typeof value === 'number' && Number.isFinite(value)) return colorHex(value)
  throw new Error(`Invalid hex color value: ${String(value)}`)
}

// --- Validation ------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function validateThemeProfile(v: unknown): ThemeProfile {
  if (!isRecord(v)) throw new ValidationError('theme: expected object')
  if (!isString(v.id) || !isString(v.name)) {
    throw new ValidationError('theme: expected id and name strings')
  }
  if (!isRecord(v.colors)) throw new ValidationError('theme.colors: expected object')
  for (const meta of THEME_COLOR_KEYS) {
    const val = v.colors[meta.key]
    if (meta.kind === 'num') {
      if (!isNumber(val)) throw new ValidationError(`theme.colors.${meta.key}: expected number`)
    } else {
      if (!isString(val) || !HEX_RE.test(val)) {
        throw new ValidationError(`theme.colors.${meta.key}: expected #rrggbb string`)
      }
    }
  }
  if (!isRecord(v.rarity)) throw new ValidationError('theme.rarity: expected object')
  for (const r of RARITY_KEYS) {
    if (!isNumber(v.rarity[r.key])) throw new ValidationError(`theme.rarity.${r.key}: expected number`)
  }
  if (!isNumber(v.createdAt) || !isNumber(v.updatedAt)) {
    throw new ValidationError('theme: expected createdAt and updatedAt numbers')
  }
  return v as unknown as ThemeProfile
}

export function validateThemeStoreFile(v: unknown): ThemeStoreFile {
  if (!isRecord(v)) throw new ValidationError('themes: expected object')
  if (!isNumber(v.schemaVersion)) throw new ValidationError('themes.schemaVersion: expected number')
  if (!isString(v.activeId)) throw new ValidationError('themes.activeId: expected string')
  if (!Array.isArray(v.profiles)) throw new ValidationError('themes.profiles: expected array')
  v.profiles.forEach((p) => validateThemeProfile(p))
  return v as unknown as ThemeStoreFile
}

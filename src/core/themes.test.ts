import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  initThemes,
  resetThemes,
  getThemeProfiles,
  getProfileById,
  getActiveProfile,
  getActiveTheme,
  createProfile,
  createProfileFrom,
  renameProfile,
  updateProfileColors,
  updateProfileRarity,
  activateProfile,
  deleteProfile,
  persistThemes,
  subscribeThemes,
  themeFromProfile,
  themesEqual,
  isPresetProfile,
  validateThemeStoreFile,
  THEMES_KEY,
  DEFAULT_THEME_ID,
  PRESET_THEMES,
  THEME_COLOR_KEYS,
  RARITY_KEYS,
  type ThemeProfile,
} from './themes'
import { ValidationError } from './validation'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

let memory: MemoryStorage

beforeEach(() => {
  memory = new MemoryStorage()
  vi.stubGlobal('localStorage', memory)
  resetThemes()
  initThemes()
})

afterEach(() => {
  resetThemes()
  vi.unstubAllGlobals()
})

describe('initThemes', () => {
  it('seeds built-in presets and defaults to earthstone', () => {
    expect(getActiveProfile().id).toBe(DEFAULT_THEME_ID)
    expect(getThemeProfiles().map((p) => p.id)).toEqual([DEFAULT_THEME_ID])
    expect(isPresetProfile(DEFAULT_THEME_ID)).toBe(true)
  })

  it('builds the active theme from the profile colors', () => {
    const theme = getActiveTheme()
    expect(theme.colors).toEqual(PRESET_THEMES.earthstone.colors)
    expect(theme.fonts).toEqual(PRESET_THEMES.earthstone.fonts)
  })

  it('restores user profiles and the saved active id', () => {
    const p = createProfile('Mine')
    updateProfileColors(p.id, { gold: 0xff0000 })
    resetThemes()
    initThemes()

    expect(getActiveProfile().id).toBe(p.id)
    expect(getProfileById(p.id)?.colors.gold).toBe(0xff0000)
  })

  it('falls back to defaults on corrupt storage', () => {
    memory.setItem(THEMES_KEY, '{not json')
    resetThemes()
    initThemes()
    expect(getActiveProfile().id).toBe(DEFAULT_THEME_ID)
    expect(getThemeProfiles()).toHaveLength(1)
  })

  it('falls back when activeId references an unknown profile', () => {
    memory.setItem(
      THEMES_KEY,
      JSON.stringify({ schemaVersion: 1, activeId: 'ghost', profiles: [profileFixture()] }),
    )
    resetThemes()
    initThemes()
    expect(getActiveProfile().id).toBe(DEFAULT_THEME_ID)
  })
})

describe('create / edit', () => {
  it('createProfile clones the active profile and activates it', () => {
    const base = getActiveProfile()
    const p = createProfile()
    expect(p.id).not.toBe(base.id)
    expect(p.colors).toEqual(base.colors)
    expect(getActiveProfile().id).toBe(p.id)
  })

  it('createProfileFrom clones a specific profile', () => {
    const base = createProfile('Base')
    updateProfileColors(base.id, { gold: 0x123456 })
    const p = createProfileFrom(base.id)
    expect(p.colors.gold).toBe(0x123456)
    expect(p.name).toBe('Custom 2')
    expect(p.id).not.toBe(base.id)
  })

  it('updateProfileColors normalizes hex strings and notifies', () => {
    const p = createProfile()
    let notified = 0
    const unsub = subscribeThemes(() => notified++)
    updateProfileColors(p.id, { accent: '#ff8800' })
    expect(getProfileById(p.id)?.colors.accent).toBe(0xff8800)
    expect(notified).toBe(1)
    unsub()
  })

  it('updateProfileRarity changes rarity tints', () => {
    const p = createProfile()
    updateProfileRarity(p.id, { legendary: 0x111111 })
    expect(getProfileById(p.id)?.rarity.legendary).toBe(0x111111)
  })

  it('renameProfile updates the name', () => {
    const p = createProfile('Tmp')
    renameProfile(p.id, 'Deep Sea')
    expect(getProfileById(p.id)?.name).toBe('Deep Sea')
    expect(() => renameProfile(p.id, '   ')).toThrow()
  })

  it('rejects unknown color keys silently and bad values loudly', () => {
    const p = createProfile()
    const weird = {} as import('./themes').ThemeColorPatch
    ;(weird as Record<string, unknown>).nope = 42
    updateProfileColors(p.id, weird)
    expect(getProfileById(p.id)).not.toBeNull()
    expect(() => updateProfileColors(p.id, { bg: 'not-a-color' })).toThrow()
  })
})

describe('built-in protection', () => {
  it('presets cannot be edited, renamed, or deleted', () => {
    expect(() => updateProfileColors(DEFAULT_THEME_ID, { bg: 0x000000 })).toThrow()
    expect(() => renameProfile(DEFAULT_THEME_ID, 'x')).toThrow()
    expect(() => deleteProfile(DEFAULT_THEME_ID)).toThrow()
  })

  it('presets can be activated', () => {
    const p = createProfile()
    activateProfile(DEFAULT_THEME_ID)
    expect(getActiveProfile().id).toBe(DEFAULT_THEME_ID)
    expect(p.id).not.toBe(DEFAULT_THEME_ID)
  })
})

describe('activate / delete', () => {
  it('activateProfile switches the active theme', () => {
    const p = createProfile()
    updateProfileColors(p.id, { gold: 0xff0000 })
    activateProfile(DEFAULT_THEME_ID)
    expect(getActiveProfile().id).toBe(DEFAULT_THEME_ID)
    activateProfile(p.id)
    expect(getActiveProfile().id).toBe(p.id)
  })

  it('activateProfile throws for unknown ids', () => {
    expect(() => activateProfile('missing')).toThrow()
  })

  it('deleteProfile removes a user profile', () => {
    const p = createProfile()
    deleteProfile(p.id)
    expect(getProfileById(p.id)).toBeNull()
  })

  it('deleting the active profile falls back to the default preset', () => {
    const p = createProfile()
    expect(getActiveProfile().id).toBe(p.id)
    deleteProfile(p.id)
    expect(getActiveProfile().id).toBe(DEFAULT_THEME_ID)
  })
})

describe('persistence round trip', () => {
  it('persists only user profiles, then reloads intact', () => {
    const p = createProfile('Roundtrip')
    updateProfileColors(p.id, { bg: 0x102030, gold: 0xff0000 })
    updateProfileRarity(p.id, { epic: 0x002244 })

    const raw = memory.getItem(THEMES_KEY)!
    const file = validateThemeStoreFile(JSON.parse(raw))
    expect(file.profiles).toHaveLength(1)
    expect(file.profiles[0]!.id).toBe(p.id)
    expect(file.activeId).toBe(p.id)

    resetThemes()
    initThemes()
    const loaded = getProfileById(p.id)
    expect(loaded?.name).toBe('Roundtrip')
    expect(loaded?.colors.bg).toBe(0x102030)
    expect(loaded?.rarity.epic).toBe(0x002244)
  })

  it('persistThemes writes the store file', () => {
    createProfile('Persisted')
    memory.clear()
    persistThemes()
    expect(memory.getItem(THEMES_KEY)).not.toBeNull()
  })
})

describe('themeFromProfile / themesEqual', () => {
  it('merges profile colors with the structural base', () => {
    const p = createProfile()
    updateProfileColors(p.id, { bg: 0x010203 })
    const theme = themeFromProfile(getProfileById(p.id)!)
    expect(theme.colors.bg).toBe(0x010203)
    expect(theme.panel.borderWidth).toBe(PRESET_THEMES.earthstone.panel.borderWidth)
    expect(theme.fonts).toEqual(PRESET_THEMES.earthstone.fonts)
  })

  it('detects color changes (not structural ones)', () => {
    const a = getActiveTheme()
    const p = createProfile()
    expect(themesEqual(a, getActiveTheme())).toBe(true)
    updateProfileColors(p.id, { gold: 0xabcdef })
    expect(themesEqual(a, getActiveTheme())).toBe(false)
  })
})

describe('validation', () => {
  it('rejects malformed profiles', () => {
    const bad = { ...profileFixture(), colors: { ...profileFixture().colors, bg: 'oops' } }
    expect(() => validateThemeStoreFile({ schemaVersion: 1, activeId: 'x', profiles: [bad] })).toThrow(
      ValidationError,
    )
  })

  it('rejects profiles missing color keys', () => {
    const bad = { id: 'x', name: 'x', colors: {}, rarity: {}, createdAt: 0, updatedAt: 0 }
    expect(() => validateThemeStoreFile({ schemaVersion: 1, activeId: 'x', profiles: [bad] })).toThrow(
      ValidationError,
    )
  })
})

function profileFixture(): ThemeProfile {
  const colors = { ...PRESET_THEMES.earthstone.colors } as unknown as Record<string, unknown>
  const rarity = { ...PRESET_THEMES.earthstone.rarity } as unknown as Record<string, unknown>
  for (const meta of THEME_COLOR_KEYS) {
    colors[meta.key] = meta.kind === 'num' ? 0x000000 : '#000000'
  }
  for (const r of RARITY_KEYS) rarity[r.key] = 0x000000
  return {
    id: 'fixture',
    name: 'Fixture',
    colors: colors as unknown as ThemeProfile['colors'],
    rarity: rarity as unknown as ThemeProfile['rarity'],
    createdAt: 1,
    updatedAt: 1,
  }
}

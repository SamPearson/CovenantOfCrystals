import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  createNewSave,
  writeSave,
  loadSave,
  clearSave,
  SAVE_KEY,
  SCHEMA_VERSION,
} from './save.service'
import type { SaveFile } from './types'

/** Minimal in-memory Storage stand-in (node test env has no localStorage). */
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
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createNewSave', () => {
  it('builds a valid versioned save envelope', () => {
    const save = createNewSave('prof-1', 'Ada')
    expect(save.schemaVersion).toBe(SCHEMA_VERSION)
    expect(save.profile.profileId).toBe('prof-1')
    expect(save.profile.displayName).toBe('Ada')
    expect(save.profile.unlockedClasses).toEqual(['knight'])
    expect(save.profile.boxes).toEqual([])
  })

  it('generates a profile id when none is given', () => {
    expect(createNewSave().profile.profileId).toMatch(/^[\w-]+$/)
  })
})

describe('save round trip', () => {
  it('persists a profile to storage and reloads it', () => {
    const save = createNewSave('prof-1', 'Ada')
    writeSave(save)

    expect(memory.getItem(SAVE_KEY)).not.toBeNull()
    const loaded = loadSave()
    expect(loaded?.profile.profileId).toBe('prof-1')
    expect(loaded?.profile.displayName).toBe('Ada')
  })

  it('loads null when storage is empty', () => {
    expect(loadSave()).toBeNull()
  })

  it('returns null (not throw) on corrupt data', () => {
    memory.setItem(SAVE_KEY, '{not json')
    expect(loadSave()).toBeNull()
  })

  it('rejects structurally invalid saves', () => {
    memory.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 1 }))
    expect(loadSave()).toBeNull()
  })

  it('clearSave empties storage', () => {
    writeSave(createNewSave('prof-1', 'Ada'))
    clearSave()
    expect(loadSave()).toBeNull()
  })
})

describe('schema stability', () => {
  it('keeps the save shape readable for forward compatibility', () => {
    const save: SaveFile = createNewSave('prof-1', 'Ada')
    save.profile.gold = 42
    writeSave(save)
    expect(loadSave()?.profile.gold).toBe(42)
  })
})

describe('schema v1 → v2 migration (Phase 4 M1)', () => {
  it('fills autobattle defaults and bumps the version for a v1 save', () => {
    const v1 = createNewSave('prof-1', 'Ada')
    v1.schemaVersion = 1
    const legacyProfile = { ...v1.profile }
    delete (legacyProfile as { autobattle?: unknown }).autobattle
    writeSave({ ...v1, profile: legacyProfile } as SaveFile)

    const loaded = loadSave()
    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION)
    expect(loaded?.profile.autobattle).toEqual({
      speed: 1,
      skipAnimations: false,
      stops: { boss: true, elite: true, permadeath: true, rest: true },
    })
  })

  it('keeps explicit autobattle preferences on load', () => {
    const save = createNewSave('prof-1', 'Ada')
    save.profile.autobattle = { speed: 4, skipAnimations: true, stops: { boss: false, elite: true, permadeath: true, rest: false } }
    writeSave(save)

    const loaded = loadSave()
    expect(loaded?.profile.autobattle).toEqual(save.profile.autobattle)
  })
})

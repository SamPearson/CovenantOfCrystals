import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  createNewSave,
  loadActiveProfile,
  saveProfile,
  deleteProfile,
  SCHEMA_VERSION,
  ALL_CLASSES,
} from './save.service'
import { setBackend, MemoryBackend, createDefaultBackend } from './storage'
import { uuid } from './id'
import type { SaveFile } from './types'

let memory: MemoryBackend

beforeEach(() => {
  memory = new MemoryBackend()
  setBackend(memory)
})

afterEach(() => {
  memory.clear()
  setBackend(createDefaultBackend())
})

describe('createNewSave', () => {
  it('builds a valid versioned save envelope', () => {
    const save = createNewSave('prof-1', 'Ada')
    expect(save.schemaVersion).toBe(SCHEMA_VERSION)
    expect(save.profile.profileId).toBe('prof-1')
    expect(save.profile.displayName).toBe('Ada')
    expect(save.profile.unlockedClasses).toEqual(ALL_CLASSES)
    expect(save.profile.boxes).toEqual([])
  })

  it('generates a profile id when none is given', () => {
    expect(createNewSave().profile.profileId).toMatch(/^[\w-]+$/)
  })
})

describe('save round trip', () => {
  it('persists a profile to storage and reloads it', () => {
    const save = createNewSave('prof-1', 'Ada')
    saveProfile(save)

    const profileId = save.profile.profileId
    const key = `coc.profile.${profileId}`
    expect(memory.getItem(key)).not.toBeNull()
    const loaded = loadActiveProfile()
    expect(loaded?.profile.profileId).toBe('prof-1')
    expect(loaded?.profile.displayName).toBe('Ada')
  })

  it('loads null when storage is empty', () => {
    expect(loadActiveProfile()).toBeNull()
  })

  it('returns null (not throw) on corrupt data', () => {
    const key = `coc.profile.${uuid()}`
    memory.setItem(key, '{not json')
    expect(loadActiveProfile()).toBeNull()
  })

  it('rejects structurally invalid saves', () => {
    const key = `coc.profile.${uuid()}`
    memory.setItem(key, JSON.stringify({ schemaVersion: 1 }))
    expect(loadActiveProfile()).toBeNull()
  })

  it('clearSave empties storage', () => {
    const save = createNewSave('prof-1', 'Ada')
    saveProfile(save)
    const profileId = save.profile.profileId
    deleteProfile(profileId)
    expect(loadActiveProfile()).toBeNull()
  })
})

describe('schema stability', () => {
  it('keeps the save shape readable for forward compatibility', () => {
    const save: SaveFile = createNewSave('prof-1', 'Ada')
    save.profile.gold = 42
    saveProfile(save)
    expect(loadActiveProfile()?.profile.gold).toBe(42)
  })
})

describe('schema v3 → v4 migration', () => {
  it('unlocks the full class roster for a v3 save', () => {
    const v3 = createNewSave('prof-1', 'Ada')
    v3.schemaVersion = 3
    v3.profile.unlockedClasses = ['knight']
    saveProfile({ ...v3 } as SaveFile)

    const loaded = loadActiveProfile()
    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION)
    expect(loaded?.profile.unlockedClasses).toEqual(ALL_CLASSES)
  })

  it('is idempotent and preserves any already-unlocked extra classes', () => {
    const v3 = createNewSave('prof-1', 'Ada')
    v3.schemaVersion = 3
    v3.profile.unlockedClasses = ['knight', 'mage']
    saveProfile({ ...v3 } as SaveFile)

    const loaded = loadActiveProfile()
    expect(loaded?.profile.unlockedClasses.slice().sort()).toEqual([...ALL_CLASSES].sort())
  })
})

describe('schema v1 → v2 migration (Phase 4 M1)', () => {
  it('fills autobattle defaults and bumps the version for a v1 save', () => {
    const v1 = createNewSave('prof-1', 'Ada')
    v1.schemaVersion = 1
    const legacyProfile = { ...v1.profile }
    delete (legacyProfile as { autobattle?: unknown }).autobattle
    saveProfile({ ...v1, profile: legacyProfile } as SaveFile)

    const loaded = loadActiveProfile()
    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION)
    expect(loaded?.profile.autobattle).toEqual({
      speed: 1,
      skipAnimations: false,
      resultDelayMs: 3000,
      stops: { boss: true, elite: true, permadeath: true, rest: true },
    })
  })

  it('keeps explicit autobattle preferences on load', () => {
    const save = createNewSave('prof-1', 'Ada')
    save.profile.autobattle = { speed: 4, skipAnimations: true, resultDelayMs: 3000, stops: { boss: false, elite: true, permadeath: true, rest: false } }
    saveProfile(save)

    const loaded = loadActiveProfile()
    expect(loaded?.profile.autobattle).toEqual(save.profile.autobattle)
  })
})

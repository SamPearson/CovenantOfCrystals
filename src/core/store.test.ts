import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  initStore,
  getSave,
  getProfile,
  subscribe,
  mutate,
  resetStore,
} from './store'
import { createCharacter } from './character'
import { createGearInstance } from './inventory'
import { equipGear } from './equip'
import { addToParty } from './party'
import { addCharacterToBox } from './boxes'
import { BOX_COUNT, PARTY_SIZE } from './types'
import { SAVE_KEY } from './save.service'
import { createRng } from './rng/rng'

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
  resetStore()
  initStore()
})

afterEach(() => {
  resetStore()
  vi.unstubAllGlobals()
})

const rng = createRng(3)

describe('initStore', () => {
  it('creates a fresh profile with boxes when storage is empty', () => {
    const save = getSave()
    expect(save.profile.boxes).toHaveLength(BOX_COUNT)
    expect(getProfile().party).toEqual([])
  })

  it('reloads an existing save from storage', () => {
    mutate((p) => {
      p.displayName = 'Ada'
    })
    resetStore()
    initStore()
    expect(getProfile().displayName).toBe('Ada')
  })
})

describe('mutate / subscribe', () => {
  it('persists changes and notifies subscribers', () => {
    let notified = 0
    const unsub = subscribe(() => notified++)

    mutate((p) => {
      p.gold = 50
    })

    expect(notified).toBe(1)
    expect(memory.getItem(SAVE_KEY)).not.toBeNull()

    resetStore()
    initStore()
    expect(getProfile().gold).toBe(50)
    unsub()
  })

  it('unsubscribe stops notifications', () => {
    let notified = 0
    const unsub = subscribe(() => notified++)
    unsub()
    mutate(() => {})
    expect(notified).toBe(0)
  })
})

describe('exit criteria: move to party + equip survives reload', () => {
  it('moves a character into the party, equips gear, and reloads intact', () => {
    let charId = ''
    mutate((p) => {
      const c = createCharacter({ classId: 'knight', rng })
      p.characters[c.id] = c
      charId = c.id
      addCharacterToBox(p, 0, c.id)
      addToParty(p, c.id)

      const sword = createGearInstance('iron_sword', { kind: 'permanent' })
      p.inventory.gear.push(sword)
      equipGear(p, c.id, sword.id)
    })

    resetStore()
    initStore()

    const profile = getProfile()
    expect(profile.party).toContain(charId)
    expect(profile.characters[charId]?.gear.weapon).toBeDefined()
    expect(profile.characters[charId]?.gear.weapon?.itemId).toBe('iron_sword')
    expect(profile.party.length).toBeLessThanOrEqual(PARTY_SIZE)
  })
})

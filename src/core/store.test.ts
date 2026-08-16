import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  initStore,
  getSave,
  getProfile,
  subscribe,
  mutate,
  resetStore,
  getActiveRun,
  startRun,
  resolveNode,
  resolveRest,
  abandonRun,
  useItemOutOfBattle,
} from './store'
import { createCharacter } from './character'
import { createGearInstance, addItem } from './inventory'
import { equipGear } from './equip'
import { addToParty } from './party'
import { addCharacterToBox } from './boxes'
import { BOX_COUNT, PARTY_SIZE } from './types'
import { SAVE_KEY } from './save.service'
import { createRng } from './rng/rng'
import type { BattleResult, BattleResultStatus } from './combat/types'

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

/** Adds `count` characters to the profile, box 0..count-1, and the party. */
function seedParty(count: number): string[] {
  const ids: string[] = []
  mutate((p) => {
    for (let i = 0; i < count; i++) {
      const c = createCharacter({ classId: 'knight', rng })
      p.characters[c.id] = c
      addCharacterToBox(p, i, c.id)
      addToParty(p, c.id)
      ids.push(c.id)
    }
  })
  return ids
}

function battleResult(status: BattleResultStatus, survivors: string[]): BattleResult {
  return { status, survivors, koIds: [], xpAwarded: {}, drops: [], log: [] }
}

describe('run actions (Phase 3 M6)', () => {
  describe('startRun', () => {
    it('starts an active run with the party snapshot and length', () => {
      const party = seedParty(3)
      const run = startRun(party, 3, 42)
      expect(run.status).toBe('active')
      expect(run.length).toBe(3)
      expect(run.party).toEqual(party)
      expect(run.currentNodeIndex).toBe(0)
      expect(getActiveRun()?.seed).toBe(42)
    })

    it('persists the active run so it survives a reload', () => {
      const party = seedParty(3)
      startRun(party, 5, 7)
      resetStore()
      initStore()
      const run = getActiveRun()
      expect(run).not.toBeNull()
      expect(run?.seed).toBe(7)
      expect(run?.length).toBe(5)
    })
  })

  describe('resolveNode', () => {
    it('advances the node after a won battle and persists the checkpoint', () => {
      const party = seedParty(3)
      const run = startRun(party, 3, 42)
      const next = resolveNode(battleResult('won', party))
      expect(next).toBeNull()
      expect(run.currentNodeIndex).toBe(1)
      expect(getActiveRun()?.currentNodeIndex).toBe(1)

      resetStore()
      initStore()
      expect(getActiveRun()?.currentNodeIndex).toBe(1)
    })

    it('ends the run with a RunResult on the boss node', () => {
      const party = seedParty(3)
      const run = startRun(party, 3, 42)
      run.currentNodeIndex = run.nodes.length - 1
      const result = resolveNode(battleResult('won', party))
      expect(result).not.toBeNull()
      expect(result?.status).toBe('won')
      expect(getActiveRun()?.status).toBe('won')
    })

    it('applies a full wipe as a loss with zero survivors', () => {
      const party = seedParty(3)
      const run = startRun(party, 3, 42)
      run.currentNodeIndex = run.nodes.length - 1
      const result = resolveNode(battleResult('lost', []))
      expect(result?.status).toBe('lost')
      expect(result?.survivors).toEqual([])
      const stats = getProfile().stats
      expect(stats.totalRuns).toBe(1)
      expect(stats.losses).toBe(1)
    })

    it('throws when no run is active', () => {
      expect(() => resolveNode(battleResult('won', []))).toThrow('No active run')
    })
  })

  describe('resolveRest', () => {
    it('advances past the rest node and persists', () => {
      const party = seedParty(3)
      const run = startRun(party, 5, 42)
      expect(run.nodes[run.currentNodeIndex]?.type).toBe('battle')
      resolveNode(battleResult('won', party))
      resolveNode(battleResult('won', party))
      resolveNode(battleResult('won', party))
      resolveNode(battleResult('won', party))
      expect(run.nodes[run.currentNodeIndex]?.type).toBe('rest')
      resolveRest()
      expect(getActiveRun()?.currentNodeIndex).toBe(run.currentNodeIndex)
      resetStore()
      initStore()
      expect(getActiveRun()?.currentNodeIndex).toBe(run.currentNodeIndex)
    })
  })

  describe('abandonRun', () => {
    it('ends the run as abandoned and counts it as a loss', () => {
      const party = seedParty(3)
      startRun(party, 5, 42)
      const result = abandonRun()
      expect(result.status).toBe('abandoned')
      expect(getProfile().stats.losses).toBe(1)
      expect(getActiveRun()?.status).toBe('abandoned')
    })
  })

  describe('useItemOutOfBattle', () => {
    it('teaches a tome skill permanently and consumes the item', () => {
      const party = seedParty(1)
      const charId = party[0]
      mutate((p) => addItem(p, 'tome_fireball', 1))
      expect(getProfile().inventory.items.find((e) => e.itemId === 'tome_fireball')?.count).toBe(1)
      const result = useItemOutOfBattle(charId, 'tome_fireball')
      expect(result.ok).toBe(true)
      expect(getProfile().characters[charId]?.learnedSkills).toContain('fireball')
      expect(getProfile().characters[charId]?.loadout).toContain('fireball')
      expect(getProfile().inventory.items.find((e) => e.itemId === 'tome_fireball')).toBeUndefined()
    })

    it('rejects teaching a skill the character already knows', () => {
      const party = seedParty(1)
      const charId = party[0]
      mutate((p) => addItem(p, 'tome_slashing_strike', 1))
      const result = useItemOutOfBattle(charId, 'tome_slashing_strike')
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/already knows/)
      expect(getProfile().inventory.items.find((e) => e.itemId === 'tome_slashing_strike')?.count).toBe(1)
    })

    it('rejects battle-only items on the map', () => {
      const party = seedParty(1)
      mutate((p) => addItem(p, 'health_potion', 1))
      const result = useItemOutOfBattle(party[0], 'health_potion')
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/in battle/)
      expect(getProfile().inventory.items.find((e) => e.itemId === 'health_potion')?.count).toBeGreaterThan(0)
    })
  })
})

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
  setAutobattle,
  applyStatShot,
  applyTome,
  equipItem,
  unequipItem,
  getScripts,
  getScript,
  createScript,
  updateScript,
  deleteScript,
  duplicateScript,
  assignScript,
} from './store'
import { createCharacter } from './character'
import { SCRIPT_LIBRARY_CAP } from './scripting/types'
import type { CharacterScript, ScriptBlock, ScriptLine } from './scripting/types'
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

describe('meta hooks (Phase 3 M7)', () => {
  it('seeds shop rotating stock and recruit offers on first init', () => {
    const shop = getProfile().shop
    expect(shop.always).toContain('health_potion')
    expect(shop.rotating.gear.length).toBeGreaterThan(0)
    expect(shop.rotating.skills.length).toBeGreaterThan(0)
    expect(getProfile().recruitment.length).toBeGreaterThanOrEqual(2)
    expect(getProfile().recruitment.length).toBeLessThanOrEqual(3)
  })

  it('does not re-seed stock that is already populated', () => {
    mutate((p) => {
      p.shop.rotating.gear = ['iron_sword']
    })
    const gearBefore = [...getProfile().shop.rotating.gear]
    resetStore()
    initStore()
    expect(getProfile().shop.rotating.gear).toEqual(gearBefore)
  })

  it('regenerates shop stock and recruit offers after a run completes', () => {
    const party = seedParty(3)
    const run = startRun(party, 3, 42)
    const stockBefore = [...getProfile().shop.rotating.gear]
    const offersBefore = [...getProfile().recruitment]

    run.currentNodeIndex = run.nodes.length - 1
    const result = resolveNode(battleResult('won', party))

    expect(result?.status).toBe('won')
    expect(getProfile().stats.totalRuns).toBe(1)
    expect(getProfile().stats.wins).toBe(1)
    expect(getProfile().shop.rotating.gear.length).toBeGreaterThan(0)
    expect(getProfile().shop.rotating.gear).not.toEqual(stockBefore)
    expect(getProfile().recruitment.length).toBeGreaterThanOrEqual(2)
    expect(getProfile().recruitment).not.toEqual(offersBefore)
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

describe('items: stat-shots & tomes (Phase 4.5.1)', () => {
  it('applies a stat-shot permanently to base stats and survives reload', () => {
    const party = seedParty(1)
    const charId = party[0]
    mutate((p) => addItem(p, 'shot_atk_1', 1))
    const before = getProfile().characters[charId]?.statBonus?.atk ?? 0

    const result = applyStatShot(charId, 'shot_atk_1')
    expect(result.ok).toBe(true)
    expect(getProfile().characters[charId]?.statBonus?.atk).toBe(before + 1)
    expect(getProfile().inventory.items.find((e) => e.itemId === 'shot_atk_1')).toBeUndefined()

    resetStore()
    initStore()
    expect(getProfile().characters[charId]?.statBonus?.atk).toBe(before + 1)
  })

  it('teaches a tome skill, consuming it, and survives reload', () => {
    const party = seedParty(1)
    const charId = party[0]
    mutate((p) => addItem(p, 'tome_fireball', 1))

    const result = applyTome(charId, 'tome_fireball')
    expect(result.ok).toBe(true)
    expect(getProfile().characters[charId]?.learnedSkills).toContain('fireball')
    expect(getProfile().characters[charId]?.loadout).toContain('fireball')
    expect(getProfile().inventory.items.find((e) => e.itemId === 'tome_fireball')).toBeUndefined()

    resetStore()
    initStore()
    expect(getProfile().characters[charId]?.learnedSkills).toContain('fireball')
  })

  it('refuses a tome for an already-known skill without consuming it', () => {
    const party = seedParty(1)
    const charId = party[0]
    mutate((p) => {
      addItem(p, 'tome_slashing_strike', 1)
      getProfile().characters[charId]!.learnedSkills.push('slashing_strike')
      getProfile().characters[charId]!.loadout.push('slashing_strike')
    })
    const result = applyTome(charId, 'tome_slashing_strike')
    expect(result.ok).toBe(false)
    expect(result.alreadyKnown).toBe(true)
    expect(getProfile().inventory.items.find((e) => e.itemId === 'tome_slashing_strike')?.count).toBe(1)
  })

  it('adds a gear-granted skill to the loadout and silently drops it on unequip', () => {
    const party = seedParty(1)
    const charId = party[0]
    mutate((p) => {
      const staff = createGearInstance('flame_staff', { kind: 'permanent' })
      p.inventory.gear.push(staff)
    })
    const staffId = getProfile().inventory.gear.find((g) => g.itemId === 'flame_staff')!.id

    equipItem(charId, staffId)
    expect(getProfile().characters[charId]?.loadout).toContain('fireball')

    unequipItem(charId, 'weapon')
    expect(getProfile().characters[charId]?.loadout).not.toContain('fireball')
    expect(getProfile().characters[charId]?.gear.weapon).toBeUndefined()
  })
})

describe('setAutobattle (Phase 4 M1)', () => {
  it('assigns a preset to a character and survives reload', () => {
    const party = seedParty(1)
    setAutobattle(party[0], 'dps')
    expect(getProfile().characters[party[0]]?.autobattle).toBe('dps')

    resetStore()
    initStore()
    expect(getProfile().characters[party[0]]?.autobattle).toBe('dps')
  })

  it('clears a preset when undefined is passed', () => {
    const party = seedParty(1)
    setAutobattle(party[0], 'healer')
    setAutobattle(party[0], undefined)
    expect(getProfile().characters[party[0]]?.autobattle).toBeUndefined()
  })

  it('throws for an unknown character', () => {
    expect(() => setAutobattle('ghost', 'dps')).toThrow(/Character not found/)
  })
})

function defenseLine(): ScriptLine {
  return {
    id: 'l1',
    target: { kind: 'self' },
    action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'defend' }] },
  }
}

function makeScript(id: string, overrides: Partial<CharacterScript> = {}): CharacterScript {
  return {
    id,
    name: `Script ${id}`,
    rootBlock: { id: 'root', depth: 0, lines: [defenseLine()], nested: [] },
    reactions: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('scripting library (Phase 4.5.2, M3)', () => {
  it('creates, reads, and persists a script across reload', () => {
    createScript(makeScript('lib.alpha'))
    expect(getScript('lib.alpha')?.id).toBe('lib.alpha')
    expect(getScripts().some((s) => s.id === 'lib.alpha')).toBe(true)

    resetStore()
    initStore()
    expect(getScript('lib.alpha')?.name).toBe('Script lib.alpha')
  })

  it('refuses a duplicate script id', () => {
    createScript(makeScript('lib.alpha'))
    expect(() => createScript(makeScript('lib.alpha'))).toThrow(/already exists/)
  })

  it('refuses a built-in script', () => {
    expect(() => createScript(makeScript('builtin.x', { builtIn: true }))).toThrow(/built-in/)
  })

  it('refuses an over-deep script through validateScriptDepth', () => {
    const rootBlock = {
      id: 'root',
      depth: 0,
      lines: [],
      nested: [
        { id: 'n1', depth: 1, lines: [], nested: [{ id: 'n2', depth: 2, lines: [], nested: [{ id: 'n3', depth: 3, lines: [], nested: [] }] }] },
      ],
    }
    const bad = makeScript('lib.deep', { rootBlock: rootBlock as unknown as ScriptBlock })
    expect(() => createScript(bad)).toThrow(/nesting/)
  })

  it('updates an existing player script and persists', () => {
    createScript(makeScript('lib.alpha'))
    updateScript({ ...makeScript('lib.alpha'), name: 'Renamed' })
    expect(getScript('lib.alpha')?.name).toBe('Renamed')

    resetStore()
    initStore()
    expect(getScript('lib.alpha')?.name).toBe('Renamed')
  })

  it('refuses to update a built-in script', () => {
    const builtin = getProfile().scriptLibrary.find((s) => s.builtIn)!
    expect(() => updateScript({ ...builtin, name: 'Hacked' })).toThrow()
  })

  it('deletes a script, clears its assignments, and persists', () => {
    const party = seedParty(1)
    createScript(makeScript('lib.alpha'))
    assignScript(party[0], 'lib.alpha')
    expect(getProfile().characters[party[0]]?.scriptId).toBe('lib.alpha')

    deleteScript('lib.alpha')
    expect(getScript('lib.alpha')).toBeUndefined()
    expect(getProfile().characters[party[0]]?.scriptId).toBeUndefined()

    resetStore()
    initStore()
    expect(getScript('lib.alpha')).toBeUndefined()
  })

  it('refuses to delete a built-in script', () => {
    const builtin = getProfile().scriptLibrary.find((s) => s.builtIn)!
    expect(() => deleteScript(builtin.id)).toThrow(/built-in/)
  })

  it('duplicates a built-in into an editable copy', () => {
    const builtin = getProfile().scriptLibrary.find((s) => s.builtIn)!
    const copy = duplicateScript(builtin.id)
    expect(copy.id).not.toBe(builtin.id)
    expect(copy.builtIn).toBe(false)
    expect(copy.name).toContain('(copy)')
    expect(getScript(copy.id)?.name).toBe(copy.name)

    expect(() => updateScript({ ...copy, name: 'My Custom' })).not.toThrow()
    expect(getScript(copy.id)?.name).toBe('My Custom')
  })

  it('assigns a script to a character that survives reload', () => {
    const party = seedParty(1)
    createScript(makeScript('lib.alpha'))
    assignScript(party[0], 'lib.alpha')

    resetStore()
    initStore()
    expect(getProfile().characters[party[0]]?.scriptId).toBe('lib.alpha')
  })

  it('throws for an unknown script on assign', () => {
    const party = seedParty(1)
    expect(() => assignScript(party[0], 'ghost')).toThrow(/not found/)
  })

  it('enforces the script library cap on create', () => {
    const seeded = getScripts().length
    for (let i = 0; i < SCRIPT_LIBRARY_CAP - seeded; i++) {
      createScript(makeScript(`lib.c${i}`))
    }
    expect(getScripts().length).toBe(SCRIPT_LIBRARY_CAP)
    expect(() => createScript(makeScript('lib.overflow'))).toThrow(/full/)
  })

  it('enforces the script library cap on duplicate', () => {
    const seeded = getScripts().length
    const builtin = getProfile().scriptLibrary.find((s) => s.builtIn)!
    for (let i = 0; i < SCRIPT_LIBRARY_CAP - seeded; i++) {
      duplicateScript(builtin.id)
    }
    expect(() => duplicateScript(builtin.id)).toThrow(/full/)
  })
})

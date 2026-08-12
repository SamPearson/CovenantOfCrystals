import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { createGearInstance, findGearById } from './inventory'
import { equipGear, unequipSlot, slotForItemType, gearStatDeltas } from './equip'
import { createRng } from './rng/rng'
import type { PlayerProfile } from './types'

function makeProfile(): PlayerProfile {
  return {
    profileId: 'p1',
    displayName: 'Player',
    gold: 0,
    unlockedClasses: ['knight'],
    characters: {},
    boxes: [],
    inventory: { items: [], gear: [] },
    party: [],
    stats: { totalRuns: 0, wins: 0, losses: 0 },
    createdAt: 0,
  }
}

const rng = createRng(13)

describe('slotForItemType', () => {
  it('maps weapon/armor to slots and rejects other types', () => {
    expect(slotForItemType('weapon')).toBe('weapon')
    expect(slotForItemType('armor')).toBe('armor')
    expect(slotForItemType('consumable')).toBeNull()
    expect(slotForItemType('tome')).toBeNull()
  })
})

describe('equipGear', () => {
  it('moves a gear instance from inventory to the matching slot', () => {
    const p = makeProfile()
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    const sword = createGearInstance('iron_sword', { kind: 'permanent' })
    p.inventory.gear.push(sword)

    equipGear(p, c.id, sword.id)
    expect(c.gear.weapon).toBe(sword)
    expect(findGearById(p, sword.id)).toBeUndefined()
  })

  it('refuses gear that does not fit a slot', () => {
    const p = makeProfile()
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    const potion = createGearInstance('health_potion', { kind: 'permanent' })
    p.inventory.gear.push(potion)
    expect(() => equipGear(p, c.id, potion.id)).toThrow(/not equippable/)
  })

  it('swaps existing gear back into the inventory', () => {
    const p = makeProfile()
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    const old = createGearInstance('iron_sword', { kind: 'permanent' })
    const upgraded = createGearInstance('steel_sword', { kind: 'permanent' })
    p.inventory.gear.push(old, upgraded)

    equipGear(p, c.id, old.id)
    equipGear(p, c.id, upgraded.id)

    expect(c.gear.weapon).toBe(upgraded)
    expect(findGearById(p, old.id)).toBe(old)
  })

  it('rejects unknown characters or gear', () => {
    const p = makeProfile()
    expect(() => equipGear(p, 'nope', 'also-nope')).toThrow(/Unknown character/)
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    expect(() => equipGear(p, c.id, 'ghost-gear')).toThrow(/not in inventory/)
  })
})

describe('gearStatDeltas', () => {
  it('reports absolute bonuses against an empty slot', () => {
    const c = createCharacter({ classId: 'knight', rng })
    expect(gearStatDeltas(c, 'iron_sword')).toEqual([{ key: 'atk', delta: 10 }])
    expect(gearStatDeltas(c, 'chain_mail')).toEqual([
      { key: 'hp', delta: 15 },
      { key: 'def', delta: 12 },
    ])
  })

  it('shows the change vs. currently equipped gear', () => {
    const p = makeProfile()
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    const sword = createGearInstance('iron_sword', { kind: 'permanent' })
    p.inventory.gear.push(sword)
    equipGear(p, c.id, sword.id)

    expect(gearStatDeltas(c, 'steel_sword')).toEqual([{ key: 'atk', delta: 8 }])
  })

  it('returns nothing for items that share the equipped bonuses', () => {
    const p = makeProfile()
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    const sword = createGearInstance('iron_sword', { kind: 'permanent' })
    p.inventory.gear.push(sword)
    equipGear(p, c.id, sword.id)

    expect(gearStatDeltas(c, 'iron_sword')).toEqual([])
  })

  it('ignores non-equippable items', () => {
    const c = createCharacter({ classId: 'knight', rng })
    expect(gearStatDeltas(c, 'health_potion')).toEqual([])
  })
})

describe('unequipSlot', () => {
  it('returns gear to the inventory and clears the slot', () => {
    const p = makeProfile()
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    const armor = createGearInstance('leather_armor', { kind: 'expires', runsRemaining: 2 })
    p.inventory.gear.push(armor)
    equipGear(p, c.id, armor.id)

    expect(unequipSlot(p, c.id, 'armor')).toBe(armor)
    expect(c.gear.armor).toBeUndefined()
    expect(findGearById(p, armor.id)).toBe(armor)
  })

  it('returns undefined for an empty slot', () => {
    const p = makeProfile()
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    expect(unequipSlot(p, c.id, 'weapon')).toBeUndefined()
  })
})

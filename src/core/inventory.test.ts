import { describe, expect, it } from 'vitest'
import {
  addItem,
  removeItem,
  hasItem,
  addGear,
  createGearInstance,
  findGearById,
  removeGearById,
} from './inventory'
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
    autobattle: { speed: 1, skipAnimations: false, stops: { boss: true, elite: true, permadeath: true, rest: true } },
    stats: { totalRuns: 0, wins: 0, losses: 0 },
    shop: { always: [], rotating: { gear: [], skills: [] } },
    recruitment: [],
    createdAt: 0,
  }
}

describe('stackable items', () => {
  it('adds and stacks counts', () => {
    const p = makeProfile()
    addItem(p, 'health_potion', 3)
    addItem(p, 'health_potion', 2)
    expect(hasItem(p, 'health_potion', 5)).toBe(true)
  })

  it('removes counts and clamps at zero', () => {
    const p = makeProfile()
    addItem(p, 'health_potion', 2)
    expect(removeItem(p, 'health_potion', 5)).toBe(2)
    expect(hasItem(p, 'health_potion')).toBe(false)
  })

  it('reports how many were actually removed', () => {
    const p = makeProfile()
    addItem(p, 'health_potion', 1)
    expect(removeItem(p, 'health_potion', 3)).toBe(1)
  })
})

describe('gear instances', () => {
  it('adds and finds unique gear instances', () => {
    const p = makeProfile()
    const g = createGearInstance('iron_sword', { kind: 'permanent' })
    addGear(p, g)
    expect(findGearById(p, g.id)).toBe(g)
  })

  it('removes by instance id', () => {
    const p = makeProfile()
    const g = createGearInstance('iron_sword', { kind: 'expires', runsRemaining: 1 })
    addGear(p, g)
    expect(removeGearById(p, g.id)).toBe(g)
    expect(findGearById(p, g.id)).toBeUndefined()
  })

  it('returns undefined for unknown ids', () => {
    const p = makeProfile()
    expect(removeGearById(p, 'missing')).toBeUndefined()
  })
})

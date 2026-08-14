/**
 * Rewards rolling + banking (Phase 3 M3, `phase-3-run-loop-plan.md` §7/§8):
 * seeded gold/drop rolls are reproducible; XP goes to survivors only; banking
 * pays out fully on victory and partially on failure/abandon.
 */

import { describe, expect, it } from 'vitest'
import { BALANCE, getEnemy, getItem, ITEMS } from '../data'
import { createNewSave } from '../save.service'
import type { EnemyDef } from '../types'
import { createRng } from '../rng/rng'
import { generateRun } from './run-gen'
import { bankRunRewards, rollBattleRewards } from './rewards'

const SQUAD: EnemyDef[] = [getEnemy('slime')]

function battle(nodeIndex: number) {
  return rollBattleRewards(createRng(42), 'battle', nodeIndex, ['c1', 'c2'], SQUAD)
}

describe('rollBattleRewards', () => {
  it('is seeded and reproducible', () => {
    const a = battle(0)
    const b = battle(0)
    expect(b).toEqual(a)
  })

  it('changes with the seed', () => {
    const a = rollBattleRewards(createRng(42), 'battle', 0, ['c1', 'c2'], SQUAD)
    const b = rollBattleRewards(createRng(43), 'battle', 0, ['c1', 'c2'], SQUAD)
    expect(b).not.toEqual(a)
  })

  it('awards XP to survivors only, equal to the squad xp', () => {
    const r = rollBattleRewards(createRng(7), 'battle', 0, ['c1', 'c2'], SQUAD)
    expect(r.xp).toEqual({ c1: SQUAD[0]!.xp, c2: SQUAD[0]!.xp })
  })

  it('does not award XP to non-survivors', () => {
    const r = rollBattleRewards(createRng(7), 'battle', 0, ['c1'], SQUAD)
    expect(r.xp).toEqual({ c1: SQUAD[0]!.xp })
    expect(r.xp.c3).toBeUndefined()
  })

  it('rolls gold within the configured variance of the squad gold base', () => {
    const base = SQUAD[0]!.gold
    const [lo, hi] = BALANCE.run.goldVariance
    for (let seed = 0; seed < 100; seed++) {
      const r = rollBattleRewards(createRng(seed), 'battle', 0, ['c1'], SQUAD)
      expect(r.gold).toBeGreaterThanOrEqual(Math.round(base * lo))
      expect(r.gold).toBeLessThanOrEqual(Math.round(base * hi))
    }
  })

  it('emits only catalog item ids of droppable types', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = rollBattleRewards(createRng(seed), 'elite', 3, ['c1'], SQUAD)
      for (const itemId of r.drops) {
        const def = getItem(itemId)
        expect(def, `drop ${itemId}`).toBeDefined()
        expect(['weapon', 'armor', 'consumable', 'scroll', 'tome']).toContain(def.type)
      }
    }
  })

  it('allows later nodes to drop rare+ gear', () => {
    let foundRare = false
    for (let seed = 0; seed < 200; seed++) {
      const r = rollBattleRewards(createRng(seed), 'elite', 8, ['c1'], SQUAD)
      for (const itemId of r.drops) {
        const def = getItem(itemId)
        if (def.type === 'weapon' || def.type === 'armor') {
          expect(['common', 'rare', 'epic', 'legendary']).toContain(def.rarity)
          if (def.rarity !== 'common') foundRare = true
        }
      }
    }
    expect(foundRare).toBe(true)
  })
})

describe('bankRunRewards', () => {
  function profile() {
    return createNewSave('bank-test').profile
  }

  function run(drops: string[], goldEarned: number) {
    const r = generateRun('bank-test', ['c1', 'c2'], 3, 42)
    r.drops = drops
    r.goldEarned = goldEarned
    return r
  }

  it('banks everything on victory (full payout)', () => {
    const p = profile()
    const r = run(['iron_sword', 'health_potion', 'greater_health_potion'], 100)
    r.status = 'won'

    const result = bankRunRewards(r, p)

    expect(result.goldBanked).toBe(100)
    expect(p.gold).toBe(100)
    expect(result.gearBanked.length).toBe(1)
    expect(result.itemsBanked).toEqual(['health_potion', 'greater_health_potion'])
    expect(p.inventory.gear.length).toBe(1)
    expect(p.inventory.gear[0]!.itemId).toBe('iron_sword')
    expect(p.inventory.gear[0]!.durability).toEqual({ kind: 'permanent' })
    expect(p.inventory.items).toEqual([
      { itemId: 'health_potion', count: 1 },
      { itemId: 'greater_health_potion', count: 1 },
    ])
  })

  it('banks a partial payout on abandon', () => {
    const p = profile()
    const r = run(['iron_sword', 'health_potion', 'greater_health_potion'], 100)
    r.status = 'abandoned'

    const result = bankRunRewards(r, p)

    expect(result.goldBanked).toBe(Math.round(100 * BALANCE.run.runPayout.abandoned))
    expect(p.gold).toBe(result.goldBanked)
    expect(result.gearBanked.length).toBe(1)
    expect(result.itemsBanked).toEqual([])
    expect(p.inventory.items).toEqual([])
  })

  it('banks little on a full-wipe loss', () => {
    const p = profile()
    const r = run(['iron_sword', 'health_potion', 'greater_health_potion'], 100)
    r.status = 'lost'

    const result = bankRunRewards(r, p)

    expect(result.goldBanked).toBe(Math.round(100 * BALANCE.run.runPayout.lost))
    expect(result.gearBanked.length).toBe(0)
    expect(result.itemsBanked).toEqual([])
    expect(p.inventory.gear.length).toBe(0)
  })

  it('banks nothing while a run is still active', () => {
    const p = profile()
    const r = run(['iron_sword'], 100)

    const result = bankRunRewards(r, p)

    expect(result.goldBanked).toBe(0)
    expect(result.gearBanked.length).toBe(0)
    expect(result.itemsBanked).toEqual([])
    expect(p.gold).toBe(0)
  })

  it('stacks duplicate consumable drops instead of doubling gear', () => {
    const p = profile()
    const r = run(['health_potion', 'health_potion'], 10)
    r.status = 'won'

    const result = bankRunRewards(r, p)

    expect(result.itemsBanked).toEqual(['health_potion', 'health_potion'])
    expect(p.inventory.items).toEqual([{ itemId: 'health_potion', count: 2 }])
    expect(result.gearBanked.length).toBe(0)
  })

  it('never banks an item id outside the catalog', () => {
    const p = profile()
    const r = generateRun('bank-test', ['c1'], 3, 42)
    r.drops = ['iron_sword']
    r.goldEarned = 10
    r.status = 'won'

    expect(() => bankRunRewards(r, p)).not.toThrow()
    expect(p.inventory.gear.length).toBe(1)
  })

  it('leaves the catalog untouched', () => {
    const before = Object.keys(ITEMS).sort()
    const p = profile()
    const r = run(['iron_sword', 'health_potion'], 50)
    r.status = 'won'
    bankRunRewards(r, p)
    expect(Object.keys(ITEMS).sort()).toEqual(before)
  })
})

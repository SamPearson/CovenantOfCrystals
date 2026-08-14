/**
 * Between-runs shop (Phase 3 M4, `phase-3-run-loop-plan.md` §7/§8):
 * always potions plus rotating gear/skill items; buy/sell guards update gold;
 * selling a permanent gear piece returns it to gold and consumables are never
 * sellable.
 */

import { describe, expect, it } from 'vitest'
import { BALANCE, getItem, ITEMS } from '../data'
import { createNewSave } from '../save.service'
import { addGear, createGearInstance, hasItem } from '../inventory'
import type { PlayerProfile } from '../types'
import { createRng } from '../rng/rng'
import {
  ALWAYS_POTIONS,
  buyItem,
  canBuyItem,
  canSellItem,
  generateShopStock,
  isInStock,
  refreshShopStock,
  sellItem,
  sellPrice,
} from './shop'

function profile(): PlayerProfile {
  return createNewSave('shop-test').profile
}

describe('generateShopStock', () => {
  it('always offers the potions', () => {
    const stock = generateShopStock(createRng(1))
    expect(stock.always).toEqual([...ALWAYS_POTIONS])
    for (const id of ALWAYS_POTIONS) {
      expect(getItem(id).type).toBe('consumable')
    }
  })

  it('rotates exactly 4 gear and 3 skill items', () => {
    for (let seed = 0; seed < 20; seed++) {
      const stock = generateShopStock(createRng(seed))
      expect(stock.rotating.gear.length).toBe(BALANCE.economy.rotatingGear)
      expect(stock.rotating.skills.length).toBe(BALANCE.economy.rotatingSkillItems)
    }
  })

  it('only puts catalog gear and skill items in rotation', () => {
    for (let seed = 0; seed < 20; seed++) {
      const stock = generateShopStock(createRng(seed))
      for (const id of stock.rotating.gear) {
        expect(['weapon', 'armor']).toContain(getItem(id).type)
      }
      for (const id of stock.rotating.skills) {
        expect(['scroll', 'tome']).toContain(getItem(id).type)
      }
    }
  })

  it('draws distinct gear/skill items within one refresh', () => {
    for (let seed = 0; seed < 50; seed++) {
      const stock = generateShopStock(createRng(seed))
      expect(new Set(stock.rotating.gear).size).toBe(stock.rotating.gear.length)
      expect(new Set(stock.rotating.skills).size).toBe(stock.rotating.skills.length)
    }
  })

  it('is seeded and reproducible', () => {
    const a = generateShopStock(createRng(42))
    const b = generateShopStock(createRng(42))
    expect(b).toEqual(a)
  })

  it('changes with the seed', () => {
    const a = generateShopStock(createRng(42))
    const b = generateShopStock(createRng(43))
    expect(b).not.toEqual(a)
  })

  it('refreshShopStock replaces the current stock', () => {
    const p = profile()
    const before = p.shop
    refreshShopStock(p, createRng(7))
    expect(p.shop).toEqual(generateShopStock(createRng(7)))
    expect(p.shop.always).toEqual([...ALWAYS_POTIONS])
    expect(p.shop).not.toEqual(before)
  })
})

describe('sellPrice', () => {
  it('returns the value scaled by the sell ratio', () => {
    const def = getItem('iron_sword')
    const gear = createGearInstance('iron_sword', { kind: 'permanent' })
    expect(sellPrice(gear, def)).toBe(Math.round(def.value * BALANCE.economy.sellRatio))
  })
})

describe('canBuyItem / buyItem', () => {
  it('refuses unknown items', () => {
    const p = profile()
    expect(canBuyItem(p, 'nope').ok).toBe(false)
    expect(buyItem(p, 'nope').error).toBe('Unknown item: nope')
  })

  it('refuses items that are not in stock', () => {
    const p = profile()
    const stock = generateShopStock(createRng(1))
    const offItem = Object.keys(ITEMS).find((id) => !isInStock(stock, id))!
    p.shop = stock
    expect(canBuyItem(p, offItem).ok).toBe(false)
    expect(buyItem(p, offItem).error).toBe(`${offItem} is not in stock`)
  })

  it('buys a consumable: gold drops and the item is added', () => {
    const p = profile()
    const price = getItem('health_potion').value
    const before = p.gold

    const result = buyItem(p, 'health_potion', 2)

    expect(result.ok).toBe(true)
    expect(result.price).toBe(price * 2)
    expect(p.gold).toBe(before - price * 2)
    expect(hasItem(p, 'health_potion', 2)).toBe(true)
  })

  it('buys gear as permanent instances', () => {
    const p = profile()
    p.shop = { always: [...ALWAYS_POTIONS], rotating: { gear: ['iron_sword'], skills: [] } }
    const price = getItem('iron_sword').value
    const before = p.gold

    const result = buyItem(p, 'iron_sword')

    expect(result.ok).toBe(true)
    expect(result.price).toBe(price)
    expect(p.gold).toBe(before - price)
    expect(p.inventory.gear.length).toBe(1)
    expect(p.inventory.gear[0]!.itemId).toBe('iron_sword')
    expect(p.inventory.gear[0]!.durability).toEqual({ kind: 'permanent' })
  })

  it('refuses when the player cannot afford the item', () => {
    const p = profile()
    p.gold = 5
    expect(canBuyItem(p, 'health_potion').ok).toBe(false)
    expect(buyItem(p, 'health_potion').error).toBe('Not enough gold')
    expect(p.gold).toBe(5)
  })
})

describe('canSellItem / sellItem', () => {
  it('sells a permanent gear piece and credits gold', () => {
    const p = profile()
    const gear = createGearInstance('iron_sword', { kind: 'permanent' })
    addGear(p, gear)
    const before = p.gold
    const expected = sellPrice(gear, getItem('iron_sword'))

    const result = sellItem(p, gear.id)

    expect(result.ok).toBe(true)
    expect(result.price).toBe(expected)
    expect(p.gold).toBe(before + expected)
    expect(p.inventory.gear).toHaveLength(0)
  })

  it('refuses to sell consumables (not sellable)', () => {
    const p = profile()
    p.inventory.items = [{ itemId: 'health_potion', count: 1 }]
    const gear = createGearInstance('health_potion', { kind: 'permanent' })
    addGear(p, gear)

    expect(canSellItem(p, gear.id).ok).toBe(false)
    expect(sellItem(p, gear.id).error).toBe('health_potion is not sellable')
    expect(p.gold).toBe(BALANCE.economy.startingGold)
  })

  it('refuses unknown gear ids', () => {
    const p = profile()
    expect(canSellItem(p, 'missing').ok).toBe(false)
    expect(sellItem(p, 'missing').error).toBe('Gear not found: missing')
  })
})

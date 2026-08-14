/**
 * Between-runs shop (Phase 3 M4, `phase-3-run-loop-plan.md` §5/§7):
 * a meta tab with always-on potions plus rotating gear and skill items
 * (decision S10). Stock regenerates on each run completion.
 *
 * Guards (`canBuyItem`/`canSellItem`) are pure; the mutating versions apply
 * the gold change directly to the profile, the way every other core module
 * does (the store wraps them in `mutate()` later — decision M8).
 */

import { BALANCE, getItem, ITEMS } from '../data'
import type { GearInstance, ItemDef, PlayerProfile, ShopStock } from '../types'
import { shuffle, type Rng } from '../rng/rng'
import { addGear, addItem, createGearInstance, findGearById, removeGearById } from '../inventory'

/** Always-on-sale consumables (decision S10). */
export const ALWAYS_POTIONS: readonly string[] = [
  'health_potion',
  'greater_health_potion',
  'mana_potion',
  'greater_mana_potion',
]

export interface ShopActionResult {
  ok: boolean
  price?: number
  error?: string
}

function rotatingGearPool(): ItemDef[] {
  return Object.values(ITEMS).filter((i) => i.type === 'weapon' || i.type === 'armor')
}

function rotatingSkillPool(): ItemDef[] {
  return Object.values(ITEMS).filter((i) => i.type === 'scroll' || i.type === 'tome')
}

/** Regenerates the shop stock: always potions + rotating gear/skill items. */
export function generateShopStock(rng: Rng): ShopStock {
  const gear = shuffle(rng, rotatingGearPool()).slice(0, BALANCE.economy.rotatingGear)
  const skills = shuffle(rng, rotatingSkillPool()).slice(0, BALANCE.economy.rotatingSkillItems)
  return {
    always: [...ALWAYS_POTIONS],
    rotating: {
      gear: gear.map((i) => i.id),
      skills: skills.map((i) => i.id),
    },
  }
}

/** Regenerates `profile.shop` (call at run completion). */
export function refreshShopStock(profile: PlayerProfile, rng: Rng): ShopStock {
  profile.shop = generateShopStock(rng)
  return profile.shop
}

/** Sale price of a gear instance: value × sell ratio (decision S12). */
export function sellPrice(_gear: GearInstance, itemDef: ItemDef): number {
  return Math.round(itemDef.value * BALANCE.economy.sellRatio)
}

export function isInStock(stock: ShopStock, itemId: string): boolean {
  return (
    stock.always.includes(itemId) ||
    stock.rotating.gear.includes(itemId) ||
    stock.rotating.skills.includes(itemId)
  )
}

/** Pure guard: may the player buy `count` of `itemId`? */
export function canBuyItem(profile: PlayerProfile, itemId: string, count = 1): ShopActionResult {
  if (!ITEMS[itemId]) return { ok: false, error: `Unknown item: ${itemId}` }
  if (!isInStock(profile.shop, itemId)) return { ok: false, error: `${itemId} is not in stock` }
  const price = ITEMS[itemId]!.value * count
  if (profile.gold < price) return { ok: false, error: 'Not enough gold' }
  return { ok: true, price }
}

/** Buys `count` of `itemId`, deducting gold. Gear becomes permanent instances. */
export function buyItem(profile: PlayerProfile, itemId: string, count = 1): ShopActionResult {
  const check = canBuyItem(profile, itemId, count)
  if (!check.ok || check.price === undefined) return check
  const def = getItem(itemId)
  profile.gold -= check.price
  if (def.type === 'weapon' || def.type === 'armor') {
    for (let i = 0; i < count; i++) {
      addGear(profile, createGearInstance(itemId, { kind: 'permanent' }))
    }
  } else {
    addItem(profile, itemId, count)
  }
  return check
}

/** Pure guard: may the player sell this gear instance? Consumables are never sellable. */
export function canSellItem(profile: PlayerProfile, gearId: string): ShopActionResult {
  const gear = findGearById(profile, gearId)
  if (!gear) return { ok: false, error: `Gear not found: ${gearId}` }
  const def = getItem(gear.itemId)
  if (def.type !== 'weapon' && def.type !== 'armor') {
    return { ok: false, error: `${gear.itemId} is not sellable` }
  }
  return { ok: true, price: sellPrice(gear, def) }
}

/** Sells a gear instance, crediting gold and removing it from inventory. */
export function sellItem(profile: PlayerProfile, gearId: string): ShopActionResult {
  const check = canSellItem(profile, gearId)
  if (!check.ok || check.price === undefined) return check
  profile.gold += check.price
  removeGearById(profile, gearId)
  return check
}

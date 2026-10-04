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
import { addGear, addItem, createGearInstance, findGearById, removeGearById, removeItem } from '../inventory'

/** Always-on-sale consumables (decision S10). */
export const ALWAYS_POTIONS: readonly string[] = [
  'health_potion',
  'greater_health_potion',
  'mana_potion',
  'greater_mana_potion',
]

/**
 * Stat-shots are always on sale (alongside potions) so the player can manually
 * apply base-stat progression in the Apply tab. They stand in for a level-up
 * path during balance testing and are priced dirt-cheap for that purpose.
 */
export const ALWAYS_STAT_SHOTS: readonly string[] = [
  'shot_hp_5',
  'shot_atk_1',
  'shot_def_1',
  'shot_mag_1',
  'shot_res_1',
  'shot_spd_1',
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
    always: [...ALWAYS_POTIONS, ...ALWAYS_STAT_SHOTS],
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
  if (profile.gold < price) return { ok: false, price, error: 'Not enough gold' }
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

/** Pure guard: may the player sell this item/gear instance? Equipped gear cannot be sold. */
export function canSellItem(profile: PlayerProfile, id: string): ShopActionResult {
  // First check if it's a gear instance
  const gear = findGearById(profile, id)
  if (gear) {
    const def = getItem(gear.itemId)
    if (def.type !== 'weapon' && def.type !== 'armor') {
      return { ok: false, error: `${gear.itemId} is not sellable` }
    }
    // Check if equipped
    for (const char of Object.values(profile.characters)) {
      if (char.gear.weapon?.id === id || char.gear.armor?.id === id) {
        return { ok: false, error: 'Cannot sell equipped gear' }
      }
    }
    return { ok: true, price: sellPrice(gear, def) }
  }

  // Check if it's a consumable item in inventory
  const invEntry = profile.inventory.items.find((e) => e.itemId === id)
  if (invEntry) {
    const def = getItem(id)
    // Don't sell stat-shots (they're permanent) or tomes (single-use learned skills)
    if (def.type === 'stat-shot' || def.type === 'tome') {
      return { ok: false, error: `${def.name} cannot be sold` }
    }
    return { ok: true, price: def.value }
  }

  return { ok: false, error: `Item not found: ${id}` }
}

/** Sells an item/gear instance, crediting gold and removing it from inventory. */
export function sellItem(profile: PlayerProfile, id: string): ShopActionResult {
  const check = canSellItem(profile, id)
  if (!check.ok || check.price === undefined) return check
  profile.gold += check.price

  // Try to remove as gear first
  const gear = findGearById(profile, id)
  if (gear) {
    removeGearById(profile, id)
  } else {
    // Remove from consumable inventory
    removeItem(profile, id, 1)
  }
  return check
}

/**
 * Equipment operations. Gear lives in the shared inventory as unique
 * instances; equipping binds an instance to a character for the run.
 * See `docs/party-and-equipment.md` §4 and `docs/durability.md` §4.
 */

import type { PlayerProfile, GearInstance, ItemType, Character, StatKey } from './types'
import { removeGearById } from './inventory'
import { getItem } from './data'

export type GearSlot = 'weapon' | 'armor'

export interface StatDelta {
  key: StatKey
  delta: number
}

const STAT_ORDER: StatKey[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd']

/** Per-stat change from equipping `itemId` onto `c`, vs. what's currently in its slot. */
export function gearStatDeltas(c: Character, itemId: string): StatDelta[] {
  const slot = slotForItemType(getItem(itemId).type)
  if (!slot) return []
  const item = getItem(itemId)
  const current = c.gear[slot]
  const currentBonus = current ? (getItem(current.itemId).statBonus ?? {}) : {}
  const newBonus = item.statBonus ?? {}
  const deltas: StatDelta[] = []
  for (const key of STAT_ORDER) {
    const delta = (newBonus[key] ?? 0) - (currentBonus[key] ?? 0)
    if (delta !== 0) deltas.push({ key, delta })
  }
  return deltas
}

export function slotForItemType(type: ItemType): GearSlot | null {
  if (type === 'weapon') return 'weapon'
  if (type === 'armor') return 'armor'
  return null
}

/**
 * Equips gear from the inventory onto a character. Swaps out any gear already
 * in the slot (returned to the inventory).
 */
export function equipGear(
  profile: PlayerProfile,
  characterId: string,
  gearId: string,
): PlayerProfile {
  const character = profile.characters[characterId]
  if (!character) throw new Error(`Unknown character: ${characterId}`)

  const gear = profile.inventory.gear.find((g) => g.id === gearId)
  if (!gear) throw new Error(`Gear not in inventory: ${gearId}`)

  const slot = slotForItemType(getItem(gear.itemId).type)
  if (!slot) throw new Error(`Gear is not equippable: ${gearId}`)

  removeGearById(profile, gearId)

  const previous = character.gear[slot]
  character.gear[slot] = gear
  if (previous) profile.inventory.gear.push(previous)

  return profile
}

/** Unequips a slot, returning the gear instance to the inventory. */
export function unequipSlot(
  profile: PlayerProfile,
  characterId: string,
  slot: GearSlot,
): GearInstance | undefined {
  const character = profile.characters[characterId]
  if (!character) throw new Error(`Unknown character: ${characterId}`)

  const gear = character.gear[slot]
  if (!gear) return undefined
  character.gear[slot] = undefined
  profile.inventory.gear.push(gear)
  return gear
}

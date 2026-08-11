/**
 * Inventory operations. All functions mutate and return the profile (data
 * flows through here, never touching storage directly).
 */

import type { PlayerProfile, GearInstance } from './types'
import { uuid } from './id'

export function addItem(profile: PlayerProfile, itemId: string, count = 1): PlayerProfile {
  const entry = profile.inventory.items.find((i) => i.itemId === itemId)
  if (entry) entry.count += count
  else profile.inventory.items.push({ itemId, count })
  return profile
}

/** Removes up to `count` of an item. Returns the amount actually removed. */
export function removeItem(profile: PlayerProfile, itemId: string, count = 1): number {
  const idx = profile.inventory.items.findIndex((i) => i.itemId === itemId)
  if (idx === -1) return 0
  const entry = profile.inventory.items[idx]
  const removed = Math.min(entry.count, count)
  entry.count -= removed
  if (entry.count <= 0) profile.inventory.items.splice(idx, 1)
  return removed
}

export function hasItem(profile: PlayerProfile, itemId: string, count = 1): boolean {
  return (profile.inventory.items.find((i) => i.itemId === itemId)?.count ?? 0) >= count
}

export function addGear(profile: PlayerProfile, gear: GearInstance): PlayerProfile {
  profile.inventory.gear.push(gear)
  return profile
}

export function createGearInstance(
  itemId: string,
  durability: GearInstance['durability'],
): GearInstance {
  return { id: uuid(), itemId, durability }
}

export function removeGearById(profile: PlayerProfile, gearId: string): GearInstance | undefined {
  const idx = profile.inventory.gear.findIndex((g) => g.id === gearId)
  if (idx === -1) return undefined
  return profile.inventory.gear.splice(idx, 1)[0]
}

export function findGearById(profile: PlayerProfile, gearId: string): GearInstance | undefined {
  return profile.inventory.gear.find((g) => g.id === gearId)
}

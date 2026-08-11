/**
 * Pure UI text-formatting helpers. Kept free of Phaser so they are unit
 * testable (see architecture.md §7).
 */

import type { Durability, StatBlock, StatKey, ItemType, Role, Element } from '../../core/types'

export function durabilityLabel(durability: Durability): string {
  if (durability.kind === 'permanent') return 'Permanent'
  const n = durability.runsRemaining
  return n === 1 ? '1 run left' : `${n} runs left`
}

export function statLabel(key: StatKey): string {
  return key.toUpperCase()
}

export function statList(stats: StatBlock): { key: StatKey; value: number }[] {
  const order: StatKey[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd']
  return order.map((key) => ({ key, value: stats[key] }))
}

export function itemTypeLabel(type: ItemType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function roleLabel(role: Role): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function elementLabel(element: Element): string {
  return element === 'none' ? '—' : element.charAt(0).toUpperCase() + element.slice(1)
}

/** Truncates a string to `max` chars, adding an ellipsis when cut. */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return `${str.slice(0, max - 1)}…`
}

import type { Element } from '../types'

/**
 * Elemental weakness/resistance chart (docs/party-and-equipment.md §5).
 * Strong = 2× damage, resisted = 0.5×. Tune in the Phase 5 balance pass.
 */
export const ELEMENT_CHART: Record<Element, Partial<Record<Element, number>>> = {
  fire: { frost: 2, water: 0.5 },
  water: { fire: 2, frost: 0.5 },
  frost: { water: 2, fire: 0.5 },
  earth: { holy: 2, shadow: 0.5 },
  holy: { shadow: 2, earth: 0.5 },
  shadow: { earth: 2, holy: 0.5 },
  none: {},
}

/** Damage multiplier for an attack element vs. a defender element. */
export function elementMultiplier(attack: Element, defend: Element): number {
  return ELEMENT_CHART[attack]?.[defend] ?? 1
}

export const ELEMENTS: Element[] = [
  'fire',
  'water',
  'frost',
  'earth',
  'holy',
  'shadow',
  'none',
]

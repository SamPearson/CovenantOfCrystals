/**
 * Character leveling system.
 *
 * XP accumulates on characters after battles. When a character has enough
 * XP, they can level up at the base menu, gaining 7 flasks to assign across
 * the 7 stats. Flask potency scales with level.
 */

import type { Character, StatKey } from './types'

/** All 7 stats that can be increased with flasks. */
export const LEVEL_STATS: StatKey[] = ['hp', 'mp', 'atk', 'def', 'mag', 'res', 'spd']

/** XP required to advance from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.5))
}

/** How much a single flask increases a stat at the given level. */
export function flaskValue(level: number): number {
  return 1 + Math.floor((level - 1) / 5)
}

/** Total flasks granted per level-up. */
export const FLASKS_PER_LEVEL = 7

/**
 * Check if a character can level up (has enough XP for the next level).
 */
export function canLevelUp(c: Character): boolean {
  return c.xp >= xpToNext(c.level)
}

/**
 * Apply a level-up to a character: deduct XP, increment level, and add
 * the flask bonuses to the character's statBonus.
 */
export function applyLevelUp(
  c: Character,
  assignments: Partial<Record<StatKey, number>>,
): Character {
  const cost = xpToNext(c.level)
  if (c.xp < cost) {
    throw new Error(`${c.name} does not have enough XP to level up (needs ${cost}, has ${c.xp})`)
  }

  const newBonus = { ...c.statBonus }
  for (const key of LEVEL_STATS) {
    const points = assignments[key] ?? 0
    if (points > 0) {
      newBonus[key] = (newBonus[key] ?? 0) + points * flaskValue(c.level)
    }
  }

  return {
    ...c,
    xp: c.xp - cost,
    level: c.level + 1,
    statBonus: newBonus,
  }
}

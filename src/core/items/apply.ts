/**
 * Item application (Phase 4.5.1, I1/I3/I5/I7).
 *
 * These mutate the character in place (the caller owns persistence / inventory
 * removal). Stat-shots write permanently to `Character.statBonus`; tomes add to
 * `learnedSkills` + `loadout`. Both flow into `derivedStats`, the battle engine,
 * and the character detail card without further wiring.
 */

import type { Character, ItemDef } from '../types'

export interface ApplyResult {
  character: Character
  /** Whether the item should be consumed from the inventory (false if refused). */
  itemConsumed: boolean
}

export interface TomeResult extends ApplyResult {
  /** True when the character already knew the skill — nothing changes, refuse. */
  alreadyKnown: boolean
}

/**
 * Applies a stat-shot's permanent bonus to the character's base stats.
 * Throws if the item is not a valid stat-shot (defensive — callers pick the item).
 */
export function applyStatShot(character: Character, item: ItemDef): ApplyResult {
  if (item.type !== 'stat-shot' || !item.boostStat) {
    throw new Error(`${item.name} is not a stat-shot`)
  }
  const { stat, amount } = item.boostStat
  const safeAmount = Math.max(0, Math.round(amount)) // I3: integers, I4: no negatives
  character.statBonus = { ...character.statBonus, [stat]: (character.statBonus?.[stat] ?? 0) + safeAmount }
  return { character, itemConsumed: true }
}

/**
 * Teaches a tome's skill to the character permanently. Refuses (no consume) when
 * the character already knows the skill (I5: tomes teach any character, but are
 * single-use). On success the skill is appended to both `learnedSkills` and the
 * `loadout` so it is immediately usable.
 */
export function applyTome(character: Character, item: ItemDef): TomeResult {
  const skillId = item.grantsSkill
  if (item.type !== 'tome' || !skillId) {
    throw new Error(`${item.name} is not a tome`)
  }
  if (character.learnedSkills.includes(skillId)) {
    return { character, itemConsumed: false, alreadyKnown: true }
  }
  character.learnedSkills.push(skillId)
  character.loadout.push(skillId)
  return { character, itemConsumed: true, alreadyKnown: false }
}

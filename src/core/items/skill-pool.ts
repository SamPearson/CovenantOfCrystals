/**
 * Skill-pool derivation (Phase 4.5.1, I1/I6/I7/I11).
 *
 * A character's usable skill set is the union of three sources:
 *  - `native`  — skills from the class learn set available at the current level
 *  - `learned` — skills permanently taught by tomes (persisted on the character)
 *  - `gear`    — skills granted by currently-equipped weapon/armor
 *
 * The pool is recomputed from live state; equipping/unequipping gear or teaching a
 * tome changes it with no extra bookkeeping. Source tagging lets the UI show where
 * each skill comes from (I11). Conflicts collapse by priority: native > learned > gear.
 */

import type { Character } from '../types'
import { getClass, getItem } from '../data'

export interface SkillPoolEntry {
  skillId: string
  source: 'native' | 'learned' | 'gear'
}

const SLOTS = ['weapon', 'armor'] as const

/** Builds the full, de-duplicated skill pool for a character with source tags. */
export function getSkillPool(character: Character): SkillPoolEntry[] {
  const classDef = getClass(character.classId)

  const native = new Set(
    classDef.learnSet.filter((l) => l.level <= character.level).map((l) => l.skillId),
  )
  const learned = new Set(
    character.learnedSkills.filter((id) => !native.has(id)),
  )
  const gear = new Set<string>()
  for (const slot of SLOTS) {
    const g = character.gear[slot]
    if (!g) continue
    const item = getItem(g.itemId)
    if (item.grantsSkillWhenEquipped) gear.add(item.grantsSkillWhenEquipped)
  }

  const entries: SkillPoolEntry[] = []
  const seen = new Set<string>()

  // Priority native > learned > gear; first occurrence wins the tag.
  for (const id of native) {
    entries.push({ skillId: id, source: 'native' })
    seen.add(id)
  }
  for (const id of learned) {
    if (seen.has(id)) continue
    entries.push({ skillId: id, source: 'learned' })
    seen.add(id)
  }
  for (const id of gear) {
    if (seen.has(id)) continue
    entries.push({ skillId: id, source: 'gear' })
    seen.add(id)
  }

  return entries
}

/**
 * Removes any loadout entries that are no longer in the character's skill pool
 * (e.g. a gear-granted skill dropped by unequipping the gear, I7). Mutates the
 * character's `loadout` array. Returns `true` if anything was pruned.
 */
export function validateLoadout(character: Character): boolean {
  const pool = new Set(getSkillPool(character).map((e) => e.skillId))
  const before = character.loadout.length
  character.loadout = character.loadout.filter((id) => pool.has(id))
  return character.loadout.length !== before
}

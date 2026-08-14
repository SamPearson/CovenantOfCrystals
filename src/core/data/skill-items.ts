/**
 * Auto-generated skill items (`docs/phase-3-run-loop-plan.md` S2, §5).
 * Every player-facing skill gets a Scroll (cast in battle, no MP/cost) and a
 * Tome (permanently teaches the skill in the meta layer, decision S3). All
 * defs derive deterministically from `SKILLS` — enemy-only skills are excluded
 * so no scroll/tome references a skill players can't learn.
 */

import { SKILLS } from './skills'
import { CLASSES } from './classes'
import { ENEMIES } from './enemies'
import { BALANCE } from './balance'
import type { ItemDef, Rarity } from '../types'

/**
 * Skills no class can learn (used only by enemies). Computed data-driven:
 * enemy-used skills that appear in no class learn set.
 */
export const ENEMY_ONLY_SKILL_IDS: string[] = Object.values(ENEMIES)
  .flatMap((e) => e.skills)
  .filter((id) => !CLASSES.some((c) => c.learnSet.some((l) => l.skillId === id)))

const enemyOnly = new Set(ENEMY_ONLY_SKILL_IDS)

/** Every player-facing skill id (all `SKILLS` minus the enemy-only set). */
export const PLAYER_SKILL_IDS: string[] = Object.keys(SKILLS).filter((id) => !enemyOnly.has(id))

/** Stub power curve — rarity tier from skill power (Phase 5 tunes). */
function tierForPower(power: number): Rarity {
  if (power >= 80) return 'epic'
  if (power >= 45) return 'rare'
  return 'common'
}

function priceFor(tier: Rarity, isTome: boolean): number {
  const base = BALANCE.economy.skillItemPrice[tier]
  return isTome ? Math.round(base * BALANCE.economy.tomePriceMult) : base
}

function assertPlayerSkill(skillId: string): void {
  if (!SKILLS[skillId]) throw new Error(`Unknown skill: ${skillId}`)
  if (enemyOnly.has(skillId)) throw new Error(`Skill is enemy-only and has no item: ${skillId}`)
}

/** The Scroll of `skillId` — a stackable consumable that casts the skill. */
export function scrollFor(skillId: string): ItemDef {
  assertPlayerSkill(skillId)
  const skill = SKILLS[skillId]!
  const tier = tierForPower(skill.power)
  return {
    id: `scroll_${skillId}`,
    name: `Scroll: ${skill.name}`,
    type: 'scroll',
    rarity: tier,
    castSkill: skillId,
    value: priceFor(tier, false),
  }
}

/** The Tome of `skillId` — consumed in the meta layer to permanently learn the skill. */
export function tomeFor(skillId: string): ItemDef {
  assertPlayerSkill(skillId)
  const skill = SKILLS[skillId]!
  const tier = tierForPower(skill.power)
  return {
    id: `tome_${skillId}`,
    name: `Tome: ${skill.name}`,
    type: 'tome',
    rarity: tier,
    skill: skillId,
    value: priceFor(tier, true),
  }
}

/** Full generated catalogs, merged into `ITEMS` by `./items`. */
export const SKILL_SCROLLS: Record<string, ItemDef> = Object.fromEntries(
  PLAYER_SKILL_IDS.map((id) => [scrollFor(id).id, scrollFor(id)]),
)

export const SKILL_TOMES: Record<string, ItemDef> = Object.fromEntries(
  PLAYER_SKILL_IDS.map((id) => [tomeFor(id).id, tomeFor(id)]),
)

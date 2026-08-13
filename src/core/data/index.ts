import { CLASSES } from './classes'
import { SKILLS } from './skills'
import { ITEMS } from './items'
import { ENEMIES } from './enemies'
import type { ClassDef, SkillDef, ItemDef, EnemyDef } from '../types'

/**
 * Data loaders. Code never reaches into raw data maps directly — always go
 * through these, so lookups are validated and swapable (Stage 2: mock API).
 */
export { CLASSES, SKILLS, ITEMS, ENEMIES }
export { AI_SCRIPTS, getAiScript } from './ai'
export { elementMultiplier, ELEMENT_CHART, ELEMENTS } from './elements'
export { BALANCE } from './balance'
export type { BalanceConfig } from './balance'

const classesById = new Map<string, ClassDef>(CLASSES.map((c) => [c.id, c]))

export function getClass(id: string): ClassDef {
  const def = classesById.get(id)
  if (!def) throw new Error(`Unknown class: ${id}`)
  return def
}

export function getSkill(id: string): SkillDef {
  const def = SKILLS[id]
  if (!def) throw new Error(`Unknown skill: ${id}`)
  return def
}

export function getItem(id: string): ItemDef {
  const def = ITEMS[id]
  if (!def) throw new Error(`Unknown item: ${id}`)
  return def
}

export function getEnemy(id: string): EnemyDef {
  const def = ENEMIES[id]
  if (!def) throw new Error(`Unknown enemy: ${id}`)
  return def
}

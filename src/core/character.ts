/**
 * Character creation and derived stats.
 * Names auto-generate from seeded word lists (player-editable in the UI).
 */

import { getClass, getItem } from './data'
import type { Character, StatBlock, ClassDef } from './types'
import { uuid } from './id'
import { pick, type Rng } from './rng/rng'

const NAME_PREFIX = ['Ald', 'Bryn', 'Cael', 'Doran', 'Eira', 'Fenn', 'Gwen', 'Hale', 'Isol', 'Jora', 'Kael', 'Liri', 'Mira', 'Nim', 'Orin', 'Pyra', 'Rook', 'Syl', 'Thorne', 'Vessa', 'Wyn', 'Zeph']
const NAME_SUFFIX = ['ric', 'wick', 'ara', 'win', 'dor', 'eth', 'ith', 'os', 'ane', 'us', 'ine', 'ir', 'oth', 'ea', 'en', 'ra', 'ia', 'mund', 'rick', 'well']

export function generateName(rng: Rng): string {
  return pick(rng, NAME_PREFIX) + pick(rng, NAME_SUFFIX)
}

export interface CreateCharacterOptions {
  classId: string
  name?: string
  level?: number
  rng?: Rng
}

export function createCharacter(opts: CreateCharacterOptions): Character {
  const rng = opts.rng ?? Math.random
  const classDef = getClass(opts.classId)
  const level = opts.level ?? 1
  return {
    id: uuid(),
    classId: classDef.id,
    name: opts.name ?? generateName(rng),
    level,
    xp: 0,
    gear: {},
    learnedSkills: classDef.learnSet
      .filter((entry) => entry.level <= level)
      .map((entry) => entry.skillId),
    loadout: classDef.learnSet
      .filter((entry) => entry.level <= level)
      .map((entry) => entry.skillId),
    durability: { kind: 'permanent' },
    earned: { runs: 0, wins: 0 },
  }
}

/** Class base + growth*(level-1). */
export function baseStatsAtLevel(classDef: ClassDef, level: number): StatBlock {
  const mult = level - 1
  return {
    hp: classDef.baseStats.hp + classDef.growth.hp * mult,
    atk: classDef.baseStats.atk + classDef.growth.atk * mult,
    def: classDef.baseStats.def + classDef.growth.def * mult,
    mag: classDef.baseStats.mag + classDef.growth.mag * mult,
    res: classDef.baseStats.res + classDef.growth.res * mult,
    spd: classDef.baseStats.spd + classDef.growth.spd * mult,
  }
}

/** Full derived stats: class base + level growth + equipped gear bonuses. */
export function derivedStats(c: Character): StatBlock {
  const classDef = getClass(c.classId)
  const stats = baseStatsAtLevel(classDef, c.level)
  for (const slot of ['weapon', 'armor'] as const) {
    const gear = c.gear[slot]
    if (!gear) continue
    const item = getItem(gear.itemId)
    const bonus = item.statBonus
    if (!bonus) continue
    for (const key of ['hp', 'atk', 'def', 'mag', 'res', 'spd'] as const) {
      stats[key] += bonus[key] ?? 0
    }
  }
  return stats
}

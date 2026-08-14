/**
 * Difficulty-by-numbers enemy scaling (`docs/runs-and-gauntlet.md` §4, locked
 * #18). A fight at `nodeIndex` scales the base `EnemyDef` by
 * `difficultyStep ^ nodeIndex * mult`, where `mult` is the node-type
 * multiplier (1 for standard battles, `eliteMult` for elites, `bossMult` for
 * the final boss). Pure + deterministic: equal inputs always yield equal
 * `EnemyDef`s, so runs replay from the seed.
 *
 * All curve numbers come from `BALANCE.run`; nothing is hardcoded here.
 * `length` bounds the valid `nodeIndex` range (boss lives at `length - 1`).
 */

import { BALANCE } from '../data'
import type { EnemyDef, StatBlock } from '../types'

export function scaleEnemy(def: EnemyDef, nodeIndex: number, length: number, mult: number): EnemyDef {
  if (!Number.isInteger(nodeIndex) || nodeIndex < 0) {
    throw new RangeError(`nodeIndex must be a non-negative integer, got ${nodeIndex}`)
  }
  if (nodeIndex >= length) {
    throw new RangeError(`nodeIndex ${nodeIndex} is out of range for a ${length}-battle run`)
  }
  const scale = BALANCE.run.difficultyStep ** nodeIndex * mult
  return {
    ...def,
    level: Math.max(1, Math.round(def.level * scale)),
    stats: scaleStats(def.stats, scale),
    xp: Math.max(1, Math.round(def.xp * scale)),
    gold: Math.max(1, Math.round(def.gold * scale)),
  }
}

function scaleStats(stats: StatBlock, scale: number): StatBlock {
  const s = (v: number) => Math.max(1, Math.round(v * scale))
  return {
    hp: s(stats.hp),
    atk: s(stats.atk),
    def: s(stats.def),
    mag: s(stats.mag),
    res: s(stats.res),
    spd: s(stats.spd),
  }
}
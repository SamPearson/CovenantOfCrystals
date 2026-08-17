/**
 * Seeded run generation (`docs/workspace/phase-3-run-loop-plan.md` §5, M2).
 * Pure module: no Phaser, no store. A run is a fixed-length gauntlet of
 * battles (decision S11: starter lengths 3/5/10) with a boss as the final
 * node, rest nodes on a fixed cadence (locked #17: every 5 battles, with the
 * rest before the boss when the cadence lands on it), branching choices at
 * each step (decision S9: 2–3 visible battle / elite / rest options), and
 * enemy squads drawn from the `ENEMIES` catalog with difficulty-by-numbers
 * scaling per node index (locked #18).
 *
 * Determinism: every squad type, count, and enemy derives from the seed's
 * RNG in a fixed consumption order, so the same seed always produces the
 * identical run.
 */

import { BALANCE, getEnemy } from '../data'
import { createRng, intBetween, shuffle, type Rng } from '../rng/rng'
import type { ActiveRun, EnemyDef, RunNode, RunNodeType } from '../types'
import { scaleEnemy } from './enemy-scale'

export const RUN_LENGTHS = [3, 5, 10] as const

/** Every 4th battle slot is an elite fight (relative cadence, local const). */
const ELITE_EVERY = 4

/** Standard battles draw from these catalog enemies (level 1–3). */
const STANDARD_POOL = ['slime', 'goblin', 'fire_elemental', 'frost_wraith'] as const

/** Elite battles draw from this tougher set (level 4–5). */
const ELITE_POOL = ['shadow_assassin', 'earth_golem', 'holy_guardian'] as const

const BOSS_ID = 'goblin_king'

/** Boss multiplier for a run length, or the flat `bossMult` when unset. */
export function bossMultFor(length: number): number {
  return BALANCE.run.bossMultByLength?.[length] ?? BALANCE.run.bossMult
}

const CHOICE_LABEL: Record<RunNodeType, string> = {
  battle: 'Battle',
  elite: 'Elite Fight',
  rest: 'Rest',
  boss: 'Boss',
}

export function generateRun(profileId: string, partyIds: string[], length: number, seed: number): ActiveRun {
  if (!(RUN_LENGTHS as readonly number[]).includes(length)) {
    throw new RangeError(`Unsupported run length: ${length} (expected one of ${RUN_LENGTHS.join(', ')})`)
  }
  const rng = createRng(seed)
  const nodes = buildNodes(rng, length)
  return {
    seed,
    profileId,
    party: partyIds.slice(),
    length,
    nodes,
    currentNodeIndex: 0,
    goldEarned: 0,
    drops: [],
    status: 'active',
  }
}

/**
 * Builds the linear node list for a `length`-battle run. Battle slot 1 is the
 * opening fight through slot `length` which is always the boss. Rest nodes
 * are inserted after every `restCadence`th battle; when the cadence lands on
 * the boss slot the rest is placed immediately before it (pre-boss).
 */
function buildNodes(rng: Rng, length: number): RunNode[] {
  const nodes: RunNode[] = []
  for (let slot = 1; slot <= length; slot++) {
    const isBoss = slot === length
    const cadence = BALANCE.run.restCadence

    if (isBoss && slot % cadence === 0) nodes.push(restNode())

    const type: RunNodeType = isBoss ? 'boss' : slot % ELITE_EVERY === 0 ? 'elite' : 'battle'
    nodes.push(battleNode(rng, type, slot - 1, length))

    if (!isBoss && slot % cadence === 0) nodes.push(restNode())
  }
  return nodes.map((node, index) => ({ ...node, index }))
}

function battleNode(rng: Rng, type: RunNodeType, nodeIndex: number, length: number): RunNode {
  return {
    type,
    index: 0,
    choices: type === 'boss' ? undefined : nextChoices(),
    enemySquad: buildSquad(rng, type, nodeIndex, length),
  }
}

/** The 2–3 visible next-node options for a step (decision S9). */
function nextChoices(): { type: RunNodeType; label: string }[] {
  return [
    { type: 'battle', label: CHOICE_LABEL.battle },
    { type: 'elite', label: CHOICE_LABEL.elite },
    { type: 'rest', label: CHOICE_LABEL.rest },
  ]
}

function restNode(): RunNode {
  return { type: 'rest', index: 0, choices: nextChoices() }
}

function buildSquad(rng: Rng, type: RunNodeType, nodeIndex: number, length: number): EnemyDef[] {
  if (type === 'boss') {
    return [scaleEnemy(getEnemy(BOSS_ID), nodeIndex, length, bossMultFor(length))]
  }
  const pool = type === 'elite' ? ELITE_POOL : STANDARD_POOL
  const minCount = type === 'elite' ? 3 : 2
  const count = intBetween(rng, minCount, 3)
  const mult = type === 'elite' ? BALANCE.run.eliteMult : 1
  const squad = shuffle(rng, pool).slice(0, count)
  return squad.map((id) => scaleEnemy(getEnemy(id), nodeIndex, length, mult))
}
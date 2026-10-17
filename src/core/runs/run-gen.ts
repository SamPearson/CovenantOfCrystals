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
 *
 * Phase 5: Town-aware generation — each town provides its own enemy pools,
 * boss, and difficulty/gold/drop multipliers.
 */

import { BALANCE, getEnemy, getTown, TOWNS } from '../data'
import { createRng, intBetween, weightedShuffle, type Rng } from '../rng/rng'
import type { ActiveRun, EnemyDef, RunNode, RunNodeType } from '../types'
import { scaleEnemy } from './enemy-scale'

export const RUN_LENGTHS = [3, 5, 10] as const

/** Every 4th battle slot is an elite fight (relative cadence, local const). */
const ELITE_EVERY = 4

const CHOICE_LABEL: Record<RunNodeType, string> = {
  battle: 'Battle',
  elite: 'Elite Fight',
  rest: 'Rest',
  boss: 'Boss',
}

export interface GenerateRunOptions {
  profileId: string
  partyIds: string[]
  length: number
  seed: number
  townId?: string
}

export function generateRun(opts: GenerateRunOptions): ActiveRun {
  const { profileId, partyIds, length, seed, townId = 'aldwyn' } = opts
  if (!(RUN_LENGTHS as readonly number[]).includes(length)) {
    throw new RangeError(`Unsupported run length: ${length} (expected one of ${RUN_LENGTHS.join(', ')})`)
  }
  const town = TOWNS[townId] ?? TOWNS.aldwyn
  const rng = createRng(seed)
  const nodes = buildNodes(rng, length, town)
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
function buildNodes(rng: Rng, length: number, town: ReturnType<typeof getTown>): RunNode[] {
  const nodes: RunNode[] = []
  const cadence = town.restCadenceOverride ?? BALANCE.run.restCadence
  for (let slot = 1; slot <= length; slot++) {
    const isBoss = slot === length

    if (isBoss && slot % cadence === 0) nodes.push(restNode())

    const type: RunNodeType = isBoss ? 'boss' : slot % ELITE_EVERY === 0 ? 'elite' : 'battle'
    nodes.push(battleNode(rng, type, slot - 1, length, town))

    if (!isBoss && slot % cadence === 0) nodes.push(restNode())
  }
  return nodes.map((node, index) => ({ ...node, index }))
}

function battleNode(rng: Rng, type: RunNodeType, nodeIndex: number, length: number, town: ReturnType<typeof getTown>): RunNode {
  return {
    type,
    index: 0,
    choices: type === 'boss' ? undefined : nextChoices(),
    enemySquad: buildSquad(rng, type, nodeIndex, length, town),
    /** Gold reward pre-rolled for this node (scaled by town goldMultiplier). */
    gold: rollNodeGold(rng, type, nodeIndex, length, town),
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

function rollNodeGold(rng: Rng, type: RunNodeType, nodeIndex: number, length: number, town: ReturnType<typeof getTown>): number {
  const baseGold = BALANCE.run.baseGold
  const variance = BALANCE.run.goldVariance
  const stepMult = Math.pow(BALANCE.run.difficultyStep * town.difficultyStepMultiplier, nodeIndex)
  const typeMult = type === 'elite' ? BALANCE.run.eliteMult : type === 'boss' ? bossMultFor(length) * town.difficultyStepMultiplier : 1
  const gold = Math.round(baseGold * stepMult * typeMult * town.goldMultiplier)
  const varianceRoll = variance[0] + rng() * (variance[1] - variance[0])
  return Math.max(1, Math.round(gold * varianceRoll))
}

function buildSquad(rng: Rng, type: RunNodeType, nodeIndex: number, length: number, town: ReturnType<typeof getTown>): EnemyDef[] {
  if (type === 'boss') {
    const mult = bossMultFor(length) * town.difficultyStepMultiplier
    return [scaleEnemy(getEnemy(town.bossId), nodeIndex, length, mult)]
  }
  const pool = type === 'elite' ? town.elitePool : town.standardPool
  const minCount = type === 'elite' ? 3 : 2
  const count = intBetween(rng, minCount, 3)
  const mult = type === 'elite' ? BALANCE.run.eliteMult * town.difficultyStepMultiplier : town.difficultyStepMultiplier
  const squad = weightedShuffle(rng, pool, (id) => town.poolWeights?.[id] ?? 1).slice(0, count)
  return squad.map((id) => scaleEnemy(getEnemy(id), nodeIndex, length, mult))
}

/** Boss multiplier for a run length, or the flat `bossMult` when unset. */
export function bossMultFor(length: number): number {
  return BALANCE.run.bossMultByLength?.[length] ?? BALANCE.run.bossMult
}
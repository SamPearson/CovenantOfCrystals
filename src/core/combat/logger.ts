/**
 * Structured battle logger — captures detailed combat math for post-battle
 * review. Each entry has a simple text summary and optional advanced data
 * (damage formula breakdown, speed/turn math).
 */

// Type-only import — used for typed damage/healing calculations
import { BALANCE } from '../data/balance'
import { elementMultiplier } from '../data/elements'
import { timeToNextTurn } from './timeline'
import type { BattleLogEntry, DamageMath, HealMath, SpeedMath } from '../types'

export interface BattleLogger {
  entries: BattleLogEntry[]
  log(entry: BattleLogEntry): void
  getEntries(): BattleLogEntry[]
  clear(): void
}

export function createBattleLogger(): BattleLogger {
  const entries: BattleLogEntry[] = []
  return {
    entries,
    log(entry: BattleLogEntry): void {
      // Shared reference (not a copy): `push` writes the same entry object to
      // the turn log, `battle.log` and here, and fields attached later (speed
      // math, once the action's delay is known) must show up in every sink.
      entries.push(entry)
    },
    getEntries(): BattleLogEntry[] {
      return [...entries]
    },
    clear(): void {
      entries.length = 0
    },
  }
}

/** Calculate damage math for logging. */
export function calculateDamageMath(
  base: number,
  atkStat: number,
  defStat: number,
  attackElement: string,
  defendElement: string,
  defending: boolean,
  varianceRoll: number,
  crit: boolean,
): DamageMath {
  const ratio = base * (atkStat / defStat)
  const elementMult = elementMultiplier(
    attackElement as never,
    defendElement as never,
  )
  const defendMult = defending ? 0.5 : 1
  const varianceMult = BALANCE.variance[0] + varianceRoll * (BALANCE.variance[1] - BALANCE.variance[0])
  const critMult = crit ? BALANCE.critDamage : 1
  const final = Math.round(ratio * elementMult * defendMult * varianceMult * critMult)
  return {
    base,
    atkStat,
    defStat,
    ratio,
    elementMult,
    defendMult,
    varianceMult,
    critMult,
    final,
  }
}

/** Calculate heal math for logging. */
export function calculateHealMath(
  basePower: number,
  mag: number,
): HealMath {
  const magRef = BALANCE.magRef
  const final = Math.round(basePower * (mag / magRef))
  return { basePower, mag, magRef, final }
}

/** Calculate speed/turn math for logging. */
export function calculateSpeedMath(
  spd: number,
  actionDelay: number,
  turnTime: number,
): SpeedMath {
  const spdRef = BALANCE.spdRef
  const timeToNext = timeToNextTurn(spd, actionDelay, spdRef)
  const nextAt = turnTime + timeToNext
  return { spd, actionDelay, spdRef, timeToNext, nextAt }
}

/** Format damage math as a readable string. */
export function formatDamageMath(math: DamageMath): string {
  const parts = [
    `base ${math.base}`,
    `ATK ${math.atkStat} / DEF ${math.defStat} = ${math.ratio.toFixed(2)}`,
  ]
  if (math.elementMult !== 1) parts.push(`elem x${math.elementMult}`)
  if (math.defendMult !== 1) parts.push(`defend x${math.defendMult}`)
  parts.push(`variance x${math.varianceMult.toFixed(2)}`)
  if (math.critMult !== 1) parts.push(`CRIT x${math.critMult}`)
  parts.push(`= ${math.final}`)
  return parts.join(' | ')
}

/** Format heal math as a readable string. */
export function formatHealMath(math: HealMath): string {
  return `base ${math.basePower} | MAG ${math.mag} / ref ${math.magRef} = ${math.final}`
}

/** Format speed math as a readable string. */
export function formatSpeedMath(math: SpeedMath): string {
  return `SPD ${math.spd} | delay ${math.actionDelay} | ref ${math.spdRef} | next in ${math.timeToNext.toFixed(1)} | at ${math.nextAt.toFixed(1)}`
}

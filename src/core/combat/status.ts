/**
 * Status effects — the v1 engine set (`docs/combat.md` §5): `statBuff`,
 * `statDebuff`, `burn`, `poison`, `regen`, `sleep`, `blind`, `freeze`.
 * `shield` / `taunt` / `stun` are types-stub only and out of the engine.
 *
 * Pure module (Phaser-free, no store access). It mutates only the live
 * `BattleActor` state it is handed; any log/queue decisions belong to
 * `battle.ts`.
 *
 * Semantics:
 * - **Stacking** is per-status: each application adds its own stack with its
 *   own duration. The effective modifier for statBuffs/statDebuffs is the
 *   product of stack powers, capped at `BALANCE.statCap` (2× → debuffs floor
 *   at 1/statCap). At cap, further stat applications are ignored.
 *   Burn/poison/regen stacks combine by **summing** `power` (uncapped).
 * - **Duration** is counted as the affected actor's own turns — decremented by
 *   `tickDurations` once per own turn.
 * - **Cadence** — `tickOwnTurnEffects` fires burn (damage) and regen (heal)
 *   at the start of the victim's own turn; `tickPoison` fires poison on a
 *   global interval (every `BALANCE.poisonInterval` resolved turns).
 * - **CC** — sleep can't act and wakes on taking damage, otherwise ends after
 *   N own turns; freeze skips the next N turns unconditionally (never woken by
 *   damage); blind halves the affected actor's accuracy.
 */

import { BALANCE, type BalanceConfig } from '../data/balance'
import type { StatKey } from '../types'
import type { ActiveStatus, ActiveStatusKind, BattleActor } from './types'

/** The in-engine status set. `shield`/`taunt`/`stun` are out of Phase 2. */
export const ENGINE_STATUSES: readonly ActiveStatusKind[] = [
  'statBuff',
  'statDebuff',
  'burn',
  'poison',
  'regen',
  'sleep',
  'blind',
  'freeze',
]

/** Statuses cleanse removes (harmful only — buffs and regen survive). */
const HARMFUL: readonly ActiveStatusKind[] = [
  'statDebuff',
  'burn',
  'poison',
  'sleep',
  'blind',
  'freeze',
]

function assertDuration(duration: number | undefined): asserts duration is number {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 1) {
    throw new RangeError(`status duration must be an integer >= 1, got ${duration}`)
  }
}

/** Live stacks matching a kind (and stat, for stat statuses). */
export function getStacks(
  actor: BattleActor,
  kind: ActiveStatusKind,
  stat?: StatKey,
): ActiveStatus[] {
  return actor.statuses.filter((s) => s.kind === kind && (stat === undefined || s.stat === stat))
}

/** Number of live stacks of a kind (and stat, for stat statuses). */
export function countStacks(actor: BattleActor, kind: ActiveStatusKind, stat?: StatKey): number {
  return getStacks(actor, kind, stat).length
}

/** Whether the actor has at least one stack of the given kind. */
export function hasStatus(actor: BattleActor, kind: ActiveStatusKind, stat?: StatKey): boolean {
  return countStacks(actor, kind, stat) > 0
}

/**
 * Apply a status stack. For statBuff/statDebuff, stacks of the same (kind,
 * stat) are capped at `BALANCE.statCap` — at cap the application is ignored
 * and `false` is returned. DOT/CC statuses stack freely. Returns whether the
 * stack was added.
 */
export function applyStatus(
  actor: BattleActor,
  status: ActiveStatus,
  balance: BalanceConfig = BALANCE,
): boolean {
  assertDuration(status.duration)
  if (status.kind === 'statBuff' || status.kind === 'statDebuff') {
    if (status.stat === undefined) {
      throw new RangeError(`${status.kind} requires a stat, got undefined`)
    }
    if (countStacks(actor, status.kind, status.stat) >= balance.statCap) {
      return false
    }
  }
  actor.statuses.push({ ...status })
  return true
}

function stackPower(actor: BattleActor, kind: ActiveStatusKind): number {
  return getStacks(actor, kind).reduce((sum, s) => sum + (s.power ?? 0), 0)
}

/**
 * Effective multiplier for a statBuff/statDebuff: product of stack powers,
 * clamped to buffs at `statCap` and debuffs at `1/statCap`. Returns 1 when the
 * stat is unaffected.
 */
export function effectiveModifier(
  actor: BattleActor,
  kind: 'statBuff' | 'statDebuff',
  stat: StatKey,
  balance: BalanceConfig = BALANCE,
): number {
  const stacks = getStacks(actor, kind, stat)
  if (stacks.length === 0) return 1
  const product = stacks.reduce((acc, s) => acc * (s.power ?? 1), 1)
  if (kind === 'statBuff') return Math.min(product, balance.statCap)
  return Math.max(product, 1 / balance.statCap)
}

/** Damage dealt by burn + HP healed by regen at the start of the actor's own turn. */
export interface OwnTurnTick {
  burnDamage: number
  /** 0 when no regen is active; already clamped to the actor's max HP. */
  regenHeal: number
  /** True when burn damage dropped the actor to 0 HP (turn ends, no action). */
  ko: boolean
}

/**
 * Tick own-turn statuses (`docs/combat.md` §3 step 2): burn first, then regen.
 * Mutates `hp`; burn damage equal to the sum of burn stack powers, regen heal
 * equal to the sum of regen powers (wake/skip decisions belong to `battle.ts`).
 */
export function tickOwnTurnEffects(actor: BattleActor): OwnTurnTick {
  const burnDamage = stackPower(actor, 'burn')
  actor.hp = Math.max(0, actor.hp - burnDamage)
  let regenHeal = 0
  if (hasStatus(actor, 'regen')) {
    regenHeal = Math.min(actor.stats.hp - actor.hp, stackPower(actor, 'regen'))
    actor.hp += regenHeal
  }
  return { burnDamage, regenHeal, ko: actor.hp <= 0 }
}

/** Per-actor result of a global poison tick. */
export interface PoisonTick {
  actorId: string
  damage: number
  ko: boolean
}

/**
 * Tick poison on the global interval (`docs/combat.md` §5): every
 * `BALANCE.poisonInterval` resolved turns, all poisoned actors take damage
 * equal to the sum of their poison stack powers — independent of their own
 * turns. Mutates `hp` on poisoned actors; returns a summary for logging.
 */
export function tickPoison(actors: BattleActor[]): PoisonTick[] {
  return actors
    .filter((a) => hasStatus(a, 'poison') && !a.ko)
    .map((a) => {
      const damage = stackPower(a, 'poison')
      a.hp = Math.max(0, a.hp - damage)
      if (a.hp <= 0) a.ko = true
      return { actorId: a.id, damage, ko: a.hp <= 0 }
    })
}

/**
 * Decrement every status duration by the affected actor's own turn; drop
 * expired stacks (duration reaches 0). Applied at the end of the actor's turn
 * (`docs/combat.md` §3 step 5). Returns the removed stacks.
 */
export function tickDurations(actor: BattleActor): ActiveStatus[] {
  const kept: ActiveStatus[] = []
  const removed: ActiveStatus[] = []
  for (const s of actor.statuses) {
    s.duration -= 1
    if (s.duration <= 0) removed.push(s)
    else kept.push(s)
  }
  actor.statuses = kept
  return removed
}

/**
 * Accuracy after blind: `accuracy × BALANCE.blindAccuracy` when the actor is
 * blinded, otherwise unchanged. Feed the result into `hitCheck`.
 */
export function effectiveAccuracy(
  actor: BattleActor,
  accuracy: number,
  balance: BalanceConfig = BALANCE,
): number {
  return hasStatus(actor, 'blind') ? accuracy * balance.blindAccuracy : accuracy
}

/**
 * CC check: the actor is asleep or frozen and must skip its action this turn
 * (`docs/combat.md` §3 step 3).
 */
export function isCrowdControlled(actor: BattleActor): boolean {
  return hasStatus(actor, 'sleep') || hasStatus(actor, 'freeze')
}

/**
 * Sleep wakes on taking damage (`docs/combat.md` §5): remove every sleep stack.
 * Called by `battle.ts` whenever damage lands on a sleeping actor — including
 * DOT ticks — wherever it decides the "queue cycle" rule applies. Returns the
 * removed sleep stacks.
 */
export function wakeOnDamage(actor: BattleActor): ActiveStatus[] {
  const kept: ActiveStatus[] = []
  const removed: ActiveStatus[] = []
  for (const s of actor.statuses) {
    if (s.kind === 'sleep') removed.push(s)
    else kept.push(s)
  }
  actor.statuses = kept
  return removed
}

/**
 * Remove harmful statuses (statDebuff, burn, poison, sleep, blind, freeze).
 * Buffs and regen survive (`docs/combat.md` §5). Returns the removed stacks.
 */
export function cleanse(actor: BattleActor): ActiveStatus[] {
  const kept: ActiveStatus[] = []
  const removed: ActiveStatus[] = []
  for (const s of actor.statuses) {
    if (HARMFUL.includes(s.kind)) removed.push(s)
    else kept.push(s)
  }
  actor.statuses = kept
  return removed
}
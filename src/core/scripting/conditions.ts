/**
 * Phase 4.5.2 — condition evaluation for the scripting DSL (`interpreter.ts`
 * consumes this). Pure: takes a `Condition` and an `InterpreterContext` and
 * returns a boolean. No Phaser, no store. The only data lookup is the elemental
 * weakness chart baked into the snapshot.
 *
 * `any-*` scopes are existential, `all-*` scopes are universal; singular scopes
 * (`self`, `lowest-*`, `highest-*`) look at the one relevant actor. The
 * event-relative scopes (`attacker`, `trigger-target`, `previous-trigger-target`)
 * resolve through the context's event ids and evaluate false when none is set
 * (they only exist while a reaction is being evaluated, M2+).
 */

import type { CompareOp, Condition, ConditionScope, InterpreterContext, ScriptActorSnapshot } from './types'
import type { StatKey } from '../types'
import { elementMultiplier } from '../data/elements'

const COMPARE: Record<CompareOp, (a: number, b: number) => boolean> = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
}

const STAT_KEYS: readonly StatKey[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd']

function assertFraction(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a fraction in [0, 1], got ${value}`)
  }
}

function assertNonNegativeInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`)
  }
}

function hpFraction(a: ScriptActorSnapshot): number {
  return a.maxHp > 0 ? a.hp / a.maxHp : 0
}

function mpFraction(a: ScriptActorSnapshot): number {
  return a.maxMp > 0 ? a.mp / a.maxMp : 0
}

/** Resolves an event-relative actor id to its snapshot (undefined when unset). */
function eventActor(kind: 'attacker' | 'trigger-target' | 'previous-trigger-target', ctx: InterpreterContext): ScriptActorSnapshot | undefined {
  const id =
    kind === 'attacker' ? ctx.attackerId
      : kind === 'trigger-target' ? ctx.triggerTargetId
        : ctx.previousTriggerTargetId
  if (id === undefined) return undefined
  return allActors(ctx).find((a) => a.id === id)
}

function allActors(ctx: InterpreterContext): ScriptActorSnapshot[] {
  return [ctx.self, ...ctx.allies, ...ctx.enemies]
}

/** The actor pool a scope reads from (0/1 elements for singular & event scopes). */
function actorsForScope(scope: ConditionScope, ctx: InterpreterContext): ScriptActorSnapshot[] {
  switch (scope) {
    case 'self':
      return [ctx.self]
    case 'any-ally':
    case 'all-allies':
    case 'lowest-hp-ally':
    case 'highest-hp-ally':
      return ctx.allies
    case 'any-enemy':
    case 'all-enemies':
    case 'lowest-hp-enemy':
    case 'highest-hp-enemy':
      return ctx.enemies
    case 'attacker':
    case 'trigger-target':
    case 'previous-trigger-target': {
      const a = eventActor(scope, ctx)
      return a ? [a] : []
    }
  }
}

function byFractionAsc(a: ScriptActorSnapshot, b: ScriptActorSnapshot): number {
  const d = hpFraction(a) - hpFraction(b)
  if (d !== 0) return d
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function byFractionDesc(a: ScriptActorSnapshot, b: ScriptActorSnapshot): number {
  return -byFractionAsc(a, b)
}

function extremeBy(
  pool: readonly ScriptActorSnapshot[],
  compare: (a: ScriptActorSnapshot, b: ScriptActorSnapshot) => number,
): ScriptActorSnapshot | undefined {
  if (pool.length === 0) return undefined
  return [...pool].sort(compare)[0]
}

/** Effective stat value of an actor (`ofCurrent: true` compares vs base × value). */
function statValue(a: ScriptActorSnapshot, stat: StatKey): number {
  return a.stats[stat]
}

/** Base stat × fraction (the `stat-compare ofCurrent` threshold). */
function baseThreshold(a: ScriptActorSnapshot, stat: StatKey, fraction: number): number {
  return a.baseStats[stat] * fraction
}

/** Evaluates a single condition (composition handled recursively). */
function evalSimple(cond: Condition, ctx: InterpreterContext): boolean {
  switch (cond.kind) {
    case 'always':
      return true
    case 'never':
      return false
    case 'hp-pct': {
      assertFraction(cond.value, 'hp-pct.value')
      return zipScope(cond.scope, ctx, (a) => COMPARE[cond.op](hpFraction(a), cond.value))
    }
    case 'mp-pct': {
      assertFraction(cond.value, 'mp-pct.value')
      return zipScope(cond.scope, ctx, (a) => COMPARE[cond.op](mpFraction(a), cond.value))
    }
    case 'stat-compare': {
      if (!STAT_KEYS.includes(cond.stat)) throw new RangeError(`stat-compare: unknown stat ${cond.stat}`)
      if (cond.ofCurrent) assertFraction(cond.value, 'stat-compare.value (ofCurrent)')
      return zipScope(cond.scope, ctx, (a) =>
        cond.ofCurrent
          ? COMPARE[cond.op](statValue(a, cond.stat), baseThreshold(a, cond.stat, cond.value))
          : COMPARE[cond.op](statValue(a, cond.stat), cond.value))
    }
    case 'has-status':
      return zipScope(cond.scope, ctx, (a) => a.statuses.includes(cond.status) === cond.present)
    case 'weak-to':
      return zipScope(cond.scope, ctx, (a) => elementMultiplier(cond.element, a.element) === 2)
    case 'enemy-rank':
      // Player actors carry no rank and never satisfy/violate an enemy-rank test.
      return zipScope(cond.scope, ctx, (a) => a.rank !== undefined && cond.ranks.includes(a.rank) === cond.present)
    case 'ally-count':
      return COMPARE[cond.op](ctx.allies.length, cond.value)
    case 'enemy-count':
      return COMPARE[cond.op](ctx.enemies.length, cond.value)
    case 'turn-count':
      return COMPARE[cond.op](ctx.turnCount, cond.value)
    case 'turn-mod': {
      assertNonNegativeInt(cond.mod, 'turn-mod.mod')
      assertNonNegativeInt(cond.equals, 'turn-mod.equals')
      if (cond.mod === 0) throw new RangeError('turn-mod.mod must be >= 1')
      return ctx.turnCount % cond.mod === cond.equals
    }
    case 'cooldown-ready': {
      const remaining = ctx.self.cooldowns[cond.skillId]
      return ctx.self.skills.includes(cond.skillId) && (remaining === undefined || remaining <= 0)
    }
    case 'can-cast': {
      const castable = (skillId: string): boolean =>
        ctx.self.skills.includes(skillId) && (ctx.self.skillCosts[skillId] ?? 0) <= ctx.self.mp
      return cond.skillId !== undefined ? castable(cond.skillId) : ctx.self.skills.some(castable)
    }
    case 'has-item':
      return ctx.self.items.includes(cond.itemId)
    case 'and':
      return cond.conditions.every((c) => evalSimple(c, ctx))
    case 'or':
      return cond.conditions.some((c) => evalSimple(c, ctx))
    case 'not':
      return !evalSimple(cond.condition, ctx)
  }
}

/**
 * Applies a predicate to a scope and combines the results by the scope's
 * quantifier: `any-*` = existential, `all-*` = universal; singular scopes apply
 * to the one relevant actor. Empty pools make `any-*` false and `all-*` false.
 */
function zipScope(
  scope: ConditionScope,
  ctx: InterpreterContext,
  pred: (a: ScriptActorSnapshot) => boolean,
): boolean {
  const pool = actorsForScope(scope, ctx)
  switch (scope) {
    case 'any-ally':
    case 'any-enemy':
      return pool.some(pred)
    case 'all-allies':
    case 'all-enemies':
      return pool.length > 0 && pool.every(pred)
    case 'self':
      return pool.length > 0 && pred(pool[0]!)
    case 'lowest-hp-ally':
      return !!extremeBy(pool, byFractionAsc) && pred(extremeBy(pool, byFractionAsc)!)
    case 'highest-hp-ally':
      return !!extremeBy(pool, byFractionDesc) && pred(extremeBy(pool, byFractionDesc)!)
    case 'lowest-hp-enemy':
      return !!extremeBy(pool, byFractionAsc) && pred(extremeBy(pool, byFractionAsc)!)
    case 'highest-hp-enemy':
      return !!extremeBy(pool, byFractionDesc) && pred(extremeBy(pool, byFractionDesc)!)
    case 'attacker':
    case 'trigger-target':
    case 'previous-trigger-target':
      return pool.length > 0 && pred(pool[0]!)
  }
}

/** Public entry: evaluate any `Condition` against the interpreter context. */
export function evalCondition(cond: Condition, ctx: InterpreterContext): boolean {
  return evalSimple(cond, ctx)
}
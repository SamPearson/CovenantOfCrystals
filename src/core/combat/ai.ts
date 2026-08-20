/**
 * Enemy AI — data-driven priority scripts (`docs/combat.md` §8, Phase 2 plan
 * §4.d). Pure module: no Phaser, no store, no data lookups. The battle layer
 * (and Phase 4 autobattle) hands in a read-only `AiBattlefield` snapshot plus
 * a script and gets back a `BattleAction`.
 *
 * A script is an **ordered list of `(condition → action)` pairs; the first
 * condition that is true wins**. Scripts are pure data and only ever select an
 * action and a target — they never bend battle rules. The same interpreter
 * drives player autobattle presets in Phase 4, so it stays deliberately
 * decoupled from `EnemyDef` and the skill catalog.
 *
 * Determinism: conditions are pure predicates; target rules resolve
 * deterministically (lowest/highest by HP, ties by id ascending). Only the
 * `random-enemy` / `random-ally` rules consume the optional seeded `rng`, so a
 * script without RNG always replays identically (`docs/combat.md` §1).
 */

import type { Rng } from '../rng/rng'
import type { ActiveStatusKind, BattleAction } from './types'

export type AiCompareOp = '<' | '<=' | '>' | '>=' | '==' | '!='

/** Which actors an `hp-pct` condition reads (`any-*` is existential). */
export type AiHpScope =
  | 'self'
  | 'any-ally'
  | 'any-enemy'
  | 'lowest-ally'
  | 'lowest-enemy'

export type AiCondition =
  | { kind: 'always' }
  /** HP fraction in [0, 1]. `any-ally`/`any-enemy` are existential checks. */
  | { kind: 'hp-pct'; scope: AiHpScope; op: AiCompareOp; value: number }
  /** Number of living allies (incl. self) or living enemies. */
  | { kind: 'count'; scope: 'allies' | 'enemies'; op: AiCompareOp; value: number }
  /** The actor has the given status. */
  | { kind: 'has-status'; status: ActiveStatusKind }
  /** The actor lacks the given status. */
  | { kind: 'no-status'; status: ActiveStatusKind }
  /** Skill is off cooldown (absent / 0 remaining). */
  | { kind: 'cooldown-ready'; skillId: string }
  /** Own battle-turn calendar (1-based) — boss patterns like "every 3rd turn". */
  | { kind: 'turns-mod'; divisor: number; remainder: number }
  /** Own battle-turn counter (1-based). */
  | { kind: 'turns'; op: AiCompareOp; value: number }
  /** Global resolved-turn counter. */
  | { kind: 'turn-count'; op: AiCompareOp; value: number }
  /** Own MP fraction in [0, 1]. */
  | { kind: 'mp-pct'; op: AiCompareOp; value: number }
  /**
   * The actor can afford a skill's MP cost and knows the skill. `skillId`
   * omitted → any known skill is castable.
   */
  | { kind: 'can-cast'; skillId?: string }
  /** All nested conditions hold (short-circuits on the first false). */
  | { kind: 'and'; conditions: AiCondition[] }
  /** At least one nested condition holds (short-circuits on the first true). */
  | { kind: 'any'; conditions: AiCondition[] }

/** Where a chosen action points. */
export type AiTarget =
  | { kind: 'self' }
  | { kind: 'random-enemy' }
  /** The living enemy with the lowest remaining HP (ties → id ascending). */
  | { kind: 'lowest-hp-enemy' }
  /** The living enemy with the highest remaining HP. */
  | { kind: 'highest-hp-enemy' }
  | { kind: 'random-ally' }
  /** The living ally (incl. self, excluded from ties only by id) with lowest HP. */
  | { kind: 'lowest-hp-ally' }
  /** No `targetId` — resolves across the whole enemy side. */
  | { kind: 'all-enemies' }
  /** No `targetId` — resolves across the whole ally side. */
  | { kind: 'all-allies' }

export type AiAction =
  | { kind: 'attack'; target: AiTarget }
  /** `skillId` omitted → the actor's primary skill (`skills[0]`). */
  | { kind: 'skill'; target: AiTarget; skillId?: string }
  | { kind: 'defend' }

export interface AiScriptEntry {
  condition: AiCondition
  action: AiAction
}

export type AiScript = readonly AiScriptEntry[]

/** The read-only view of the acting actor the interpreter consults. */
export interface AiActorState {
  id: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  statuses: readonly ActiveStatusKind[]
  /** Skill ids the actor knows; `skills[0]` is the primary skill. */
  skills: readonly string[]
  /** skillId → remaining on-cooldown own turns (absent/0 = ready). */
  cooldowns?: Readonly<Record<string, number>>
  /** skillId → MP cost (battle layer fills from the skill catalog; absent = free). */
  skillCosts?: Readonly<Record<string, number>>
}

/** Read-only battle snapshot the script judges from. */
export interface AiBattlefield {
  self: AiActorState
  /** Living allies (includes `self`). */
  allies: readonly AiActorState[]
  /** Living enemies — from this actor's perspective. */
  enemies: readonly AiActorState[]
  /** The acting actor's own battle turn (1-based). */
  turn: number
  /** Global resolved-turn counter. */
  turnCount: number
}

const COMPARE: Record<AiCompareOp, (a: number, b: number) => boolean> = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
}

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

function assertPositiveInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`)
  }
}

function assertNonEmptyConditions(value: readonly AiCondition[], name: string): void {
  if (value.length === 0) {
    throw new RangeError(`${name} must contain at least one condition`)
  }
}

function hpFraction(a: AiActorState): number {
  return a.maxHp > 0 ? a.hp / a.maxHp : 0
}

function byIdAsc(a: AiActorState, b: AiActorState): number {
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

/** Ascending by HP fraction (`hp-pct` conditions); ties resolved by id. */
function byFractionAsc(a: AiActorState, b: AiActorState): number {
  const d = hpFraction(a) - hpFraction(b)
  if (d !== 0) return d
  return byIdAsc(a, b)
}

/** Ascending by absolute remaining HP (target rules); ties by id. */
function byHpAsc(a: AiActorState, b: AiActorState): number {
  const d = a.hp - b.hp
  if (d !== 0) return d
  return byIdAsc(a, b)
}

function lowestBy(pool: readonly AiActorState[], by: (a: AiActorState, b: AiActorState) => number): AiActorState | undefined {
  if (pool.length === 0) return undefined
  return [...pool].sort(by)[0]
}

function highestBy(pool: readonly AiActorState[], by: (a: AiActorState, b: AiActorState) => number): AiActorState | undefined {
  if (pool.length === 0) return undefined
  return [...pool].sort(by).at(-1)
}

function randomPick(pool: readonly AiActorState[], rng: Rng | undefined): AiActorState | undefined {
  if (pool.length === 0) return undefined
  if (rng) return pool[Math.floor(rng() * pool.length)]!
  return [...pool].sort(byIdAsc)[0]
}

function evalHpCondition(
  scope: AiHpScope,
  op: AiCompareOp,
  value: number,
  field: AiBattlefield,
): boolean {
  switch (scope) {
    case 'self':
      return COMPARE[op](hpFraction(field.self), value)
    case 'any-ally':
      return field.allies.some((a) => COMPARE[op](hpFraction(a), value))
    case 'any-enemy':
      return field.enemies.some((e) => COMPARE[op](hpFraction(e), value))
    case 'lowest-ally': {
      const lowest = lowestBy(field.allies, byFractionAsc)
      return lowest !== undefined && COMPARE[op](hpFraction(lowest), value)
    }
    case 'lowest-enemy': {
      const lowest = lowestBy(field.enemies, byFractionAsc)
      return lowest !== undefined && COMPARE[op](hpFraction(lowest), value)
    }
  }
}

function evalCondition(condition: AiCondition, field: AiBattlefield): boolean {
  switch (condition.kind) {
    case 'always':
      return true
    case 'hp-pct':
      assertFraction(condition.value, 'hp-pct.value')
      return evalHpCondition(condition.scope, condition.op, condition.value, field)
    case 'count':
      assertNonNegativeInt(condition.value, 'count.value')
      {
        const n = condition.scope === 'allies' ? field.allies.length : field.enemies.length
        return COMPARE[condition.op](n, condition.value)
      }
    case 'has-status':
      return field.self.statuses.includes(condition.status)
    case 'no-status':
      return !field.self.statuses.includes(condition.status)
    case 'cooldown-ready': {
      const remaining = field.self.cooldowns?.[condition.skillId]
      return remaining === undefined || remaining <= 0
    }
    case 'turns':
      return COMPARE[condition.op](field.turn, condition.value)
    case 'turns-mod':
      assertPositiveInt(condition.divisor, 'turns-mod.divisor')
      assertNonNegativeInt(condition.remainder, 'turns-mod.remainder')
      return field.turn % condition.divisor === condition.remainder
    case 'turn-count':
      return COMPARE[condition.op](field.turnCount, condition.value)
    case 'mp-pct':
      assertFraction(condition.value, 'mp-pct.value')
      {
        const frac = field.self.maxMp > 0 ? field.self.mp / field.self.maxMp : 0
        return COMPARE[condition.op](frac, condition.value)
      }
    case 'can-cast': {
      const castable = (skillId: string): boolean =>
        field.self.skills.includes(skillId) &&
        (field.self.skillCosts?.[skillId] ?? 0) <= field.self.mp
      return condition.skillId !== undefined
        ? castable(condition.skillId)
        : field.self.skills.some(castable)
    }
    case 'and':
      assertNonEmptyConditions(condition.conditions, 'and.conditions')
      return condition.conditions.every((c) => evalCondition(c, field))
    case 'any':
      assertNonEmptyConditions(condition.conditions, 'any.conditions')
      return condition.conditions.some((c) => evalCondition(c, field))
  }
}

function resolveTarget(target: AiTarget, field: AiBattlefield, rng: Rng | undefined): string | undefined {
  switch (target.kind) {
    case 'self':
      return field.self.id
    case 'all-enemies':
    case 'all-allies':
      return undefined
    case 'random-enemy':
      return randomPick(field.enemies, rng)?.id
    case 'lowest-hp-enemy':
      return lowestBy(field.enemies, byHpAsc)?.id
    case 'highest-hp-enemy':
      return highestBy(field.enemies, byHpAsc)?.id
    case 'random-ally':
      return randomPick(field.allies, rng)?.id
    case 'lowest-hp-ally':
      return lowestBy(field.allies, byHpAsc)?.id
  }
}

function toAction(action: AiAction, field: AiBattlefield, rng: Rng | undefined): BattleAction {
  switch (action.kind) {
    case 'attack':
      return { kind: 'attack', targetId: resolveTarget(action.target, field, rng) }
    case 'defend':
      return { kind: 'defend' }
    case 'skill': {
      const skillId = action.skillId ?? field.self.skills[0]
      if (!skillId) {
        throw new Error(`AI: "${field.self.id}" scripted a skill but knows none`)
      }
      if (!field.self.skills.includes(skillId)) {
        throw new Error(`AI: "${field.self.id}" does not know skill "${skillId}"`)
      }
      return { kind: 'skill', skillId, targetId: resolveTarget(action.target, field, rng) }
    }
  }
}

/**
 * Resolve an action for the acting actor by scanning `script` top to bottom
 * and taking the **first condition that is true**.
 *
 * `rng` is only consulted by `random-enemy` / `random-ally` targets; when
 * omitted those rules fall back to a deterministic id-ordered pick. Scripts
 * are expected to end in an `always` catch-all; if none matches, the engine
 * falls back to a basic attack at the lowest-HP enemy (deterministic).
 */
export function chooseAction(script: AiScript, field: AiBattlefield, rng?: Rng): BattleAction {
  for (const entry of script) {
    if (evalCondition(entry.condition, field)) {
      return toAction(entry.action, field, rng)
    }
  }
  return { kind: 'attack', targetId: resolveTarget({ kind: 'lowest-hp-enemy' }, field, undefined) }
}
/**
 * Phase 4.5.2 — target resolution for the scripting DSL. `resolveTargetIds`
 * turns a `TargetRule` into the concrete actor ids the action points at, after
 * applying the optional narrowing condition (S3). The interpreter maps the
 * result to a `BattleAction.targetId` (single id) or leaves it undefined (for
 * `all-*` rules that act on a whole side).
 *
 * Pure: only reads the `InterpreterContext`. `random-*` rules are the only
 * consumers of the seeded `rng`, so a script without them replays identically.
 * The event-relative kinds (`attacker`, `trigger-target`, `previous-trigger-target`)
 * resolve through the context's event ids and resolve empty when unset (reactions
 * only, M2+).
 */

import type { Rng } from '../rng/rng'
import type { InterpreterContext, ScriptActorSnapshot, TargetRule, TargetRuleKind } from './types'
import { evalCondition } from './conditions'

function byHpAsc(a: ScriptActorSnapshot, b: ScriptActorSnapshot): number {
  const d = a.hp - b.hp
  if (d !== 0) return d
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function byHpDesc(a: ScriptActorSnapshot, b: ScriptActorSnapshot): number {
  return -byHpAsc(a, b)
}

function byThreatDesc(a: ScriptActorSnapshot, b: ScriptActorSnapshot): number {
  const d = a.stats.atk - b.stats.atk
  if (d !== 0) return d
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function randomId(pool: ScriptActorSnapshot[], rng: Rng | undefined): string | undefined {
  if (pool.length === 0) return undefined
  if (rng) return pool[Math.floor(rng() * pool.length)]!.id
  return [...pool].sort((a, b) => (a.id < b.id ? -1 : 1))[0]!.id
}

function actorById(arr: ScriptActorSnapshot[], id: string): ScriptActorSnapshot | undefined {
  return arr.find((a) => a.id === id)
}

/** The actor ids selected by the rule's base kind, before narrowing. */
function baseActors(rule: TargetRule, ctx: InterpreterContext, rng: Rng | undefined): ScriptActorSnapshot[] {
  switch (rule.kind) {
    case 'self':
      return [ctx.self]
    case 'lowest-hp-ally':
      return ctx.allies.length ? [ctx.allies.reduce((lo, a) => (byHpAsc(a, lo) < 0 ? a : lo))] : []
    case 'highest-hp-ally':
      return ctx.allies.length ? [ctx.allies.reduce((hi, a) => (byHpDesc(a, hi) < 0 ? a : hi))] : []
    case 'random-ally': {
      const id = randomId(ctx.allies, rng)
      return id ? [actorById(ctx.allies, id)!] : []
    }
    case 'all-allies':
      return ctx.allies.slice()
    case 'lowest-hp-enemy':
      return ctx.enemies.length ? [ctx.enemies.reduce((lo, a) => (byHpAsc(a, lo) < 0 ? a : lo))] : []
    case 'highest-hp-enemy':
      return ctx.enemies.length ? [ctx.enemies.reduce((hi, a) => (byHpDesc(a, hi) < 0 ? a : hi))] : []
    case 'random-enemy': {
      const id = randomId(ctx.enemies, rng)
      return id ? [actorById(ctx.enemies, id)!] : []
    }
    case 'all-enemies':
      return ctx.enemies.slice()
    case 'highest-threat-enemy':
      return ctx.enemies.length ? [ctx.enemies.reduce((hi, a) => (byThreatDesc(a, hi) > 0 ? a : hi))] : []
    case 'attacker':
    case 'trigger-target':
    case 'previous-trigger-target': {
      const all = [ctx.self, ...ctx.allies, ...ctx.enemies]
      const id =
        rule.kind === 'attacker' ? ctx.attackerId
          : rule.kind === 'trigger-target' ? ctx.triggerTargetId
            : ctx.previousTriggerTargetId
      return id !== undefined ? all.filter((a) => a.id === id) : []
    }
  }
}

/**
 * Resolves a target rule to actor ids. The narrowing condition is evaluated
 * with each candidate treated as `self` (so `self`-scoped sub-conditions test
 * the candidate itself, global scopes still see the whole battlefield).
 */
export function resolveTargetIds(rule: TargetRule, ctx: InterpreterContext, rng: Rng | undefined): string[] {
  const candidates = baseActors(rule, ctx, rng)
  if (!rule.condition) return candidates.map((a) => a.id)
  const byId = new Map([ctx.self, ...ctx.allies, ...ctx.enemies].map((a) => [a.id, a]))
  return candidates
    .filter((a) => {
      const sub: InterpreterContext = { ...ctx, self: a, allies: ctx.allies, enemies: ctx.enemies }
      return evalCondition(rule.condition!, sub)
    })
    .map((a) => a.id)
    .filter((id) => byId.has(id))
}

/** True when the rule kind addresses a whole side (engine fans out via the skill's own targets). */
export function isWholeSide(kind: TargetRuleKind): boolean {
  return kind === 'all-allies' || kind === 'all-enemies'
}
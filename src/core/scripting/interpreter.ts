/**
 * Phase 4.5.2 — the scripting interpreter. `chooseScriptedAction` walks a
 * `CharacterScript` top-down and returns the first `BattleAction` whose rule
 * triggers, resolves a target, and selects a skill/item — or, when nothing in
 * the root block matches, the script's locked `fallback` rule (default: basic
 * attack at the lowest-HP enemy). A rule that triggers but resolves empty (no
 * valid target / no matching action) falls through to the next rule (S19).
 *
 * Pure and deterministic: it only reads the `InterpreterContext` the battle
 * layer builds (`buildScriptContext`) and returns an action; it never mutates
 * battle state. Only `random-*` target rules and random action selection among
 * multiple matches consume the seeded `rng`, so a script replays identically
 * for a fixed seed.
 *
 * Blocks nest to depth 2 below the root; a nested block is entered only when
 * its own trigger holds, and control returns to the enclosing block afterwards.
 *
 * The walk is exposed two ways off the same code path: `chooseScriptedAction`
 * (a plain action) and `chooseScriptedPick` (a `ScriptPick` that also names the
 * matched rule line, its enclosing block, and whether the locked fallback was
 * used). The M5 dry-run preview renders the pick; battle consumes the action.
 */

import type { Rng } from '../rng/rng'
import type { BattleAction, BattleState, BattleActor } from '../combat/types'
import type {
  CharacterScript,
  InterpreterContext,
  ScriptBlock,
  ScriptLine,
  Trigger,
  ScriptActorSnapshot,
} from './types'
import { evalCondition } from './conditions'
import { resolveTargetIds, isWholeSide } from './targets'
import { selectAction, type SelectedAction } from './skill-selector'
import { getSkill, getEnemy, BALANCE } from '../data'
import { effectiveModifier } from '../combat/status'

/** The locked fallback default: basic attack at the lowest-HP enemy. */
export const DEFAULT_FALLBACK_LINE: ScriptLine = {
  id: 'fallback',
  target: { kind: 'lowest-hp-enemy' },
  action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] },
}

/** The fallback a script effectively ends in (its own, or the default). */
export function effectiveFallback(script: CharacterScript): ScriptLine {
  return script.fallback ?? DEFAULT_FALLBACK_LINE
}

/** Evaluates a trigger: no trigger = always; 1 condition = that one; else combine by operator. */
function evalTrigger(trigger: Trigger | undefined, ctx: InterpreterContext): boolean {
  if (!trigger) return true
  const conditions = trigger.conditions
  if (conditions.length <= 1) return conditions.length === 1 ? evalCondition(conditions[0]!, ctx) : true
  return trigger.operator === 'AND'
    ? conditions.every((c) => evalCondition(c, ctx))
    : conditions.some((c) => evalCondition(c, ctx))
}

function toBattleAction(sel: SelectedAction, targetId: string | undefined): BattleAction | null {
  if (!sel) return null
  switch (sel.kind) {
    case 'skill':
      return { kind: 'skill', skillId: sel.id, targetId }
    case 'item':
      return { kind: 'item', itemId: sel.id, targetId }
    case 'attack':
      return { kind: 'attack', targetId }
    case 'defend':
      return { kind: 'defend' }
  }
}

/**
 * A resolved script decision: the matched rule line, its enclosing block, and
 * whether it came from the locked fallback (never a normal rule) — used by the
 * M5 dry-run preview to render "rule + target + action".
 */
export interface ScriptPick {
  action: BattleAction
  line: ScriptLine
  block: ScriptBlock
  fromFallback: boolean
}

function evalLine(
  line: ScriptLine,
  ctx: InterpreterContext,
  rng: Rng | undefined,
  block: ScriptBlock,
  fromFallback: boolean,
): ScriptPick | null {
  if (!evalTrigger(line.trigger, ctx)) return null
  const ids = resolveTargetIds(line.target, ctx, rng)
  if (ids.length === 0) return null
  const targetId = isWholeSide(line.target.kind) ? undefined : ids[0]
  const selected = selectAction(line.action, ctx, rng)
  const action = toBattleAction(selected, targetId)
  return action ? { action, line, block, fromFallback } : null
}

/**
 * Walks a block: gate on the block trigger (missing = always), then evaluate
 * its lines top-down, then its nested blocks top-down (S19). A nested block
 * whose own trigger fails is skipped. Returns the first resolved pick.
 */
function evalBlock(
  block: ScriptBlock,
  ctx: InterpreterContext,
  rng: Rng | undefined,
  fromFallback: boolean,
): ScriptPick | null {
  if (!evalTrigger(block.trigger, ctx)) return null
  for (const line of block.lines) {
    const pick = evalLine(line, ctx, rng, block, fromFallback)
    if (pick) return pick
  }
  for (const child of block.nested) {
    const pick = evalBlock(child, ctx, rng, fromFallback)
    if (pick) return pick
  }
  return null
}

/**
 * Resolves the acting actor's pick: the root block first (lines top-down,
 * then nested blocks), then the locked fallback. Returns `null` only when even
 * the fallback cannot resolve.
 */
export function chooseScriptedPick(
  script: CharacterScript,
  ctx: InterpreterContext,
  rng?: Rng,
): ScriptPick | null {
  const fromBlock = evalBlock(script.rootBlock, ctx, rng, false)
  if (fromBlock) return fromBlock
  const fallback = effectiveFallback(script)
  return evalLine(fallback, ctx, rng, script.rootBlock, true)
}

/**
 * Resolves the acting actor's action from their `CharacterScript` — the same
 * walk as `chooseScriptedPick`, returning just the `BattleAction`.
 */
export function chooseScriptedAction(
  script: CharacterScript,
  ctx: InterpreterContext,
  rng?: Rng,
): BattleAction | null {
  return chooseScriptedPick(script, ctx, rng)?.action ?? null
}

/**
 * Validates script structure: nesting depth (root = 0, each nested block one
 * deeper, max 2), and trigger condition arity (1–3 — an omitted trigger is a
 * separate concept and always allowed). Throws on violation so the store can
 * refuse over-deep scripts and editors can surface errors (M3/M4).
 */
export function validateScriptDepth(script: CharacterScript): void {
  const checkTrigger = (trigger: Trigger | undefined, where: string): void => {
    if (trigger && (trigger.conditions.length < 1 || trigger.conditions.length > 3)) {
      throw new Error(`Trigger at ${where} must have 1-3 conditions, got ${trigger.conditions.length}`)
    }
  }
  const checkLine = (line: ScriptLine, where: string): void => checkTrigger(line.trigger, where)
  const checkBlock = (block: ScriptBlock, depth: 0 | 1 | 2): void => {
    if (block.depth !== depth) {
      throw new Error(`Script block "${block.id}" depth ${block.depth} != expected ${depth}`)
    }
    for (const line of block.lines) checkLine(line, `block "${block.id}"`)
    if (depth === 2 && block.nested.length > 0) {
      throw new Error(`Script nesting exceeds depth 2 at block "${block.id}"`)
    }
    for (const child of block.nested) {
      checkTrigger(child.trigger, `block "${child.id}"`)
      checkBlock(child, (depth + 1) as 0 | 1 | 2)
    }
  }
  checkTrigger(script.rootBlock.trigger, 'root block')
  checkBlock(script.rootBlock, 0)
  checkTrigger(script.fallback?.trigger, 'fallback')
}

const SNAPSHOT_STATS: readonly (keyof ScriptActorSnapshot['stats'])[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd']

function effectiveStat(actor: BattleActor, stat: keyof BattleActor['stats']): number {
  const base = actor.stats[stat] ?? 0
  const buff = effectiveModifier(actor, 'statBuff', stat, BALANCE)
  const debuff = effectiveModifier(actor, 'statDebuff', stat, BALANCE)
  return base * buff * debuff
}

/**
 * Builds the pure `InterpreterContext` the battle layer feeds into
 * `chooseScriptedAction`. Exposes skill costs, cooldowns, effective/permanent
 * stats, combat element, and enemy rank (enemies resolve `boss`/`normal` from
 * their enemy def; player actors carry none). `items` mirrors the actor's
 * battle-tracked inventory (`BattleActor.items`, set by the run layer in M6
 * or by the M5 dry-run mock) — empty when nothing is supplied.
 */
export function buildScriptContext(battle: BattleState, actorId: string): InterpreterContext {
  const actor = battle.actors[actorId]
  if (!actor) throw new Error(`buildScriptContext: unknown actor ${actorId}`)
  const allySide = actor.side
  const enemySide: BattleActor['side'] = actor.side === 'player' ? 'enemy' : 'player'
  const toSnapshot = (a: BattleActor): ScriptActorSnapshot => {
    const skills = a.skills ?? []
    const skillCosts: Record<string, number> = {}
    for (const id of skills) skillCosts[id] = getSkill(id).cost
    const stats = {} as ScriptActorSnapshot['stats']
    const baseStats = {} as ScriptActorSnapshot['baseStats']
    for (const stat of SNAPSHOT_STATS) {
      stats[stat] = effectiveStat(a, stat)
      baseStats[stat] = a.stats[stat] ?? 0
    }
    let rank: ScriptActorSnapshot['rank']
    if (a.side === 'enemy') {
      try {
        rank = getEnemy(a.sourceId).isBoss ? 'boss' : 'normal'
      } catch {
        rank = 'normal'
      }
    }
    return {
      id: a.id,
      hp: a.hp,
      maxHp: a.stats.hp,
      mp: a.mp,
      maxMp: a.maxMp ?? BALANCE.maxMp,
      statuses: a.statuses.map((s) => s.kind),
      stats,
      baseStats,
      element: a.element ?? 'none',
      rank,
      skills,
      cooldowns: { ...(a.cooldowns ?? {}) },
      skillCosts,
      items: [...(a.items ?? [])],
    }
  }
  return {
    self: toSnapshot(actor),
    allies: Object.values(battle.actors)
      .filter((a) => a.side === allySide && !a.ko)
      .map(toSnapshot),
    enemies: Object.values(battle.actors)
      .filter((a) => a.side === enemySide && !a.ko)
      .map(toSnapshot),
    turnCount: battle.turnCount,
  }
}
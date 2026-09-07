/**
 * Phase 4.5.2 — action selection for the scripting DSL (`interpreter.ts`
 * consumes this). Given a `SkillSelector` it returns ONE entry of the source
 * pool — the actor's known skills, or usable items — that survives every ANDed
 * filter. When several entries match, one is chosen at random through the
 * seeded battle `rng` (S27/S4); with no `rng` provided (unit tests, dry-run with
 * a fixed seed) the first match in stable order is returned, so a script with a
 * single match replays identically to the Phase 4 presets it replaces.
 *
 * Reserved pseudo entries `'attack'` / `'defend'` live in the skill pool so a
 * script line can express a basic attack or defend action through the same
 * `SkillSelector` shape. They only match a `byId` filter; other filters exclude
 * them (and the `can-cast` condition never sees them).
 */

import type { Rng } from '../rng/rng'
import type { CompareOp, InterpreterContext, SkillSelector, SkillSelectorFilter } from './types'
import type { SkillDef, ItemDef } from '../types'
import { getSkill, getItem, BALANCE } from '../data'
import type { BattleActor, BattleEvent, BattleState } from '../combat/types'
import { hasPermission } from '../combat/battle-events'

const COMPARE: Record<CompareOp, (a: number, b: number) => boolean> = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
}

/** The action a selector resolved to. `null` = nothing matched. */
export type SelectedAction =
  | { kind: 'skill'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'attack' }
  | { kind: 'defend' }
  | null

interface SkillPoolEntry {
  id: string
  def: SkillDef | null
  pseudo?: 'attack' | 'defend'
}

/** Skill pool = known skills + the two pseudo actions, in stable order. */
function buildSkillPool(ctx: InterpreterContext): SkillPoolEntry[] {
  const entries: SkillPoolEntry[] = ctx.self.skills.map((id) => ({ id, def: safeGetSkill(id) }))
  entries.push({ id: 'attack', def: null, pseudo: 'attack' })
  entries.push({ id: 'defend', def: null, pseudo: 'defend' })
  return entries
}

function safeGetSkill(id: string): SkillDef | null {
  try {
    return getSkill(id)
  } catch {
    return null
  }
}

function skillDelay(entry: SkillPoolEntry): number {
  if (entry.pseudo === 'attack') return BALANCE.actionDelays.attack
  if (entry.pseudo === 'defend') return BALANCE.actionDelays.defend
  return entry.def?.delay ?? BALANCE.actionDelays.skill
}

function matchesSkillFilter(entry: SkillPoolEntry, filter: SkillSelectorFilter, ctx: InterpreterContext): boolean {
  switch (filter.kind) {
    case 'byId':
      return entry.id === filter.skillId
    case 'byElement':
      return entry.def?.element === filter.element
    case 'byKind':
      return entry.def?.kind === filter.skillKind
    case 'byTag':
      return entry.def?.tags?.includes(filter.tag) ?? false
    case 'byMpCost': {
      if (!entry.def) return false
      const cost = entry.def.cost ?? 0
      const value = filter.ofCurrent ? (ctx.self.maxMp > 0 ? cost / ctx.self.maxMp : 0) : cost
      return COMPARE[filter.op](value, filter.value)
    }
    case 'byCooldownReady': {
      const ready = (ctx.self.cooldowns[entry.id] ?? 0) <= 0
      return filter.ready ? ready : !ready
    }
    case 'byCastDelay':
      return COMPARE[filter.op](skillDelay(entry), filter.value)
    case 'byPower':
      return COMPARE[filter.op](entry.def?.power ?? 0, filter.value)
  }
}

function matchesItemFilter(item: ItemDef, filter: SkillSelectorFilter): boolean {
  // Items only meaningfully support `byId`; other filters are ignored for the
  // item pool (an item has no element/kind/tags/power/cost in the skill sense).
  if (filter.kind === 'byId') return item.id === filter.skillId
  return true
}

/** Applies every ANDed filter to a candidate. */
function passesFilters<T>(
  candidate: T,
  filters: SkillSelectorFilter[],
  test: (c: T, f: SkillSelectorFilter) => boolean,
): boolean {
  return filters.every((f) => test(candidate, f))
}

function pickRandom<T>(matches: T[], rng: Rng | undefined): T | undefined {
  if (matches.length === 0) return undefined
  if (rng) return matches[Math.floor(rng() * matches.length)]
  return matches[0]
}

/**
 * Reaction context that constrains selection (S21 backstop). While evaluating
 * a reaction rule, the pool is limited to skills/items whose `reactionTo`
 * grants the fired event's gate; absent/empty `reactionTo` = never usable as a
 * reaction. Turn-rule selection passes no gate and ignores the restriction.
 */
export interface ReactionGate {
  event: BattleEvent
  reactor: BattleActor
  battle: BattleState
}

/** Gate legality for a skill candidate (pseudo actions are always legal). */
function skillAllowed(entry: SkillPoolEntry, gate: ReactionGate | undefined): boolean {
  if (!gate || entry.pseudo) return true
  if (!entry.def) return false
  return hasPermission(entry.def.reactionTo, gate.event, gate.reactor, gate.battle)
}

/**
 * Resolves a skill selector against the context, returning one matching entry:
 * a seeded-random pick among all matches when `rng` is given, else the first
 * match in stable pool order. When `reactionGate` is set, the pool is filtered
 * to entries legal for the gate (S21 interpreter re-validation).
 */
export function selectAction(
  selector: SkillSelector,
  ctx: InterpreterContext,
  rng?: Rng,
  reactionGate?: ReactionGate,
): SelectedAction {
  if (selector.source === 'items') {
    const matches: string[] = []
    for (const itemId of ctx.self.items) {
      let item: ItemDef | null = null
      try {
        item = getItem(itemId)
      } catch {
        item = null
      }
      if (
        item &&
        (!reactionGate || hasPermission(item.reactionTo, reactionGate.event, reactionGate.reactor, reactionGate.battle)) &&
        passesFilters(item, selector.filters, matchesItemFilter)
      ) {
        matches.push(itemId)
      }
    }
    const picked = pickRandom(matches, rng)
    return picked !== undefined ? { kind: 'item', id: picked } : null
  }

  const matches: SkillPoolEntry[] = buildSkillPool(ctx).filter(
    (entry) => skillAllowed(entry, reactionGate) && passesFilters(entry, selector.filters, (e, f) => matchesSkillFilter(e, f, ctx)))
  const picked = pickRandom(matches, rng)
  if (!picked) return null
  if (picked.pseudo === 'attack') return { kind: 'attack' }
  if (picked.pseudo === 'defend') return { kind: 'defend' }
  return { kind: 'skill', id: picked.id }
}
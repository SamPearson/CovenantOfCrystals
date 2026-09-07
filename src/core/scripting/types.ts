/**
 * Phase 4.5.2 — the autobattle scripting DSL (`docs/specs/character-scripting.md`,
 * `docs/workspace/phase_4.5.2-scripting.md` §6). These types are the single
 * source of truth for what a player-authored (or built-in, read-only) autobattle
 * script is.
 *
 * The interpreter in `interpreter.ts` consumes these types plus a read-only
 * `InterpreterContext` built from a battle (`src/core/combat/battle.ts` through
 * `buildScriptContext`). It never mutates battle state — it only returns a
 * `BattleAction` the caller then performs.
 *
 * Conventions:
 * - A `ScriptLine` combines a trigger (1–3 conditions), a target rule, and an
 *   action (skill/item selector). Each line is its priority position; the first
 *   line whose trigger holds AND that resolves a target AND a matching action
 *   wins. A winning line that resolves empty falls through (S19).
 * - Every script ends in a locked `fallback` rule (always-true trigger,
 *   un-removable/un-reorderable in the UI). Its target/action are configurable;
 *   the default is a basic attack at the lowest-HP enemy.
 * - Blocks nest to a maximum depth of 2 below the root (three levels total).
 *   A nested block is entered only when its own trigger holds; after its lines
 *   and children, control returns to the enclosing block (no cross-block
 *   fallthrough).
 * - `EventPattern` gates (reactions sheet) are the only context where the
 *   event-relative scopes/targets (`attacker`, `trigger-target`,
 *   `previous-trigger-target`) resolve; in the turn context they evaluate empty.
 * - Reserved selector ids `'attack'` / `'defend'` select the basic attack /
 *   defend actions (see `skill-selector.ts`); they round-trip through the same
 *   `SkillSelector` shape as skills and match only an explicit `byId` filter.
 *
 * Event-relative scopes/targets (`attacker`, `trigger-target`,
 * `previous-trigger-target`) are only meaningful inside reactions — in the turn
 * context they evaluate empty (`conditions.ts` / `targets.ts`).
 */

import type { Element, SkillKind, StatKey } from '../types'
import type { ActiveStatusKind } from '../combat/types'

/** Per-profile script library capacity (S25). */
export const SCRIPT_LIBRARY_CAP = 50

/**
 * Reserved pseudo skill ids that select the basic action rather than a real
 * skill (see `skill-selector.ts`). They round-trip through the same
 * `SkillSelector` shape and match only an explicit `byId` filter.
 */
export const BASIC_ACTION_IDS = ['attack', 'defend'] as const
export type BasicActionId = (typeof BASIC_ACTION_IDS)[number]

// ---------------------------------------------------------------------------
// Scopes, operators, comparisons
// ---------------------------------------------------------------------------

/** Who a condition/target reads. `any-*` / `all-*` are existential / universal. */
export type ConditionScope =
  | 'self'
  | 'any-ally'
  | 'all-allies'
  | 'lowest-hp-ally'
  | 'highest-hp-ally'
  | 'any-enemy'
  | 'all-enemies'
  | 'lowest-hp-enemy'
  | 'highest-hp-enemy'
  | 'attacker'
  | 'trigger-target'
  | 'previous-trigger-target'

/** Boolean combination of a trigger's conditions (and/or). */
export type ScriptOperator = 'AND' | 'OR'

/** Numeric / HP-fraction comparison operator (the DSL spells equality `==`). */
export type CompareOp = '<' | '<=' | '>' | '>=' | '==' | '!='

// ---------------------------------------------------------------------------
// Conditions — the full vocabulary (shared by triggers, reaction gates,
// target narrowing, and dry-run previews).
// ---------------------------------------------------------------------------

export type Condition =
  | { kind: 'always' }
  | { kind: 'never' }
  /** HP fraction in [0, 1] of the scoped actor(s). */
  | { kind: 'hp-pct'; scope: ConditionScope; op: CompareOp; value: number }
  /** MP fraction in [0, 1] of the scoped actor(s). */
  | { kind: 'mp-pct'; scope: ConditionScope; op: CompareOp; value: number }
  /**
   * Stat comparison on the scoped actor(s). `value` is flat (current stat vs
   * value); with `ofCurrent` it is a fraction of the actor's permanent base
   * stat (current stat vs base × value).
   */
  | { kind: 'stat-compare'; scope: ConditionScope; stat: StatKey; op: CompareOp; value: number; ofCurrent?: boolean }
  /** Whether the scoped actor(s) carry (or lack) a status. */
  | { kind: 'has-status'; scope: ConditionScope; status: ActiveStatusKind; present: boolean }
  /** Whether the scoped actor(s) are weak to the element (2× chart). */
  | { kind: 'weak-to'; scope: ConditionScope; element: Element }
  /** Whether the scoped enemy rank(s) match (player actors never match). */
  | { kind: 'enemy-rank'; scope: ConditionScope; ranks: EnemyRank[]; present: boolean }
  /** Number of living allies (incl. self). */
  | { kind: 'ally-count'; op: CompareOp; value: number }
  /** Number of living enemies. */
  | { kind: 'enemy-count'; op: CompareOp; value: number }
  /** Global resolved-turn counter. */
  | { kind: 'turn-count'; op: CompareOp; value: number }
  /** Boss-style calendar: `turnCount % mod === equals`. */
  | { kind: 'turn-mod'; mod: number; equals: number }
  /** Actor knows the skill and its cooldown is ready (absent/0 remaining). */
  | { kind: 'cooldown-ready'; skillId: string }
  /** Actor can afford the skill's MP (skillId omitted → any known skill). */
  | { kind: 'can-cast'; skillId?: string }
  /** The actor's usable inventory contains the item. */
  | { kind: 'has-item'; itemId: string }
  /** All nested conditions hold. */
  | { kind: 'and'; conditions: Condition[] }
  /** At least one nested condition holds. */
  | { kind: 'or'; conditions: Condition[] }
  /** The nested condition is false. */
  | { kind: 'not'; condition: Condition }

// ---------------------------------------------------------------------------
// Event gates — the reactions-sheet discriminator (`docs/specs/character-scripting.md`
// §Reactions). An EventPattern is a kind plus optional source/target filters;
// omitted filters mean "any".
// ---------------------------------------------------------------------------

export type ActorFilter = 'self' | 'ally' | 'enemy'

export type EventKind =
  | 'attacked'
  | 'evaded'
  | 'ally-kod'
  | 'status-applied'
  | 'status-removed'
  | 'enemy-casts'
  | 'turn-start'
  | 'turn-end'

export interface EventPattern {
  kind: EventKind
  source?: ActorFilter
  target?: ActorFilter
}

// ---------------------------------------------------------------------------
// Triggers: 1–3 conditions, combined by operator (always-true when omitted).
// ---------------------------------------------------------------------------

export interface Trigger {
  conditions: Condition[]
  operator: ScriptOperator
}

// ---------------------------------------------------------------------------
// Target rules: which actors an action points at, with optional narrowing.
// ---------------------------------------------------------------------------

export type TargetRuleKind =
  | 'self'
  | 'lowest-hp-ally'
  | 'highest-hp-ally'
  | 'random-ally'
  | 'all-allies'
  | 'lowest-hp-enemy'
  | 'highest-hp-enemy'
  | 'random-enemy'
  | 'all-enemies'
  | 'highest-threat-enemy'
  | 'attacker'
  | 'trigger-target'
  | 'previous-trigger-target'

export interface TargetRule {
  kind: TargetRuleKind
  /** Optional narrowing; only actors satisfying it are kept (S3). */
  condition?: Condition
}

// ---------------------------------------------------------------------------
// Actions: a source pool (skills OR usable items) narrowed by ANDed filters.
// ---------------------------------------------------------------------------

export type SkillSelectorFilter =
  | { kind: 'byId'; skillId: string }
  | { kind: 'byElement'; element: Element }
  | { kind: 'byKind'; skillKind: SkillKind }
  | { kind: 'byTag'; tag: string }
  /** Absolute MP cost (`ofCurrent` false/omitted) or fraction of max MP. */
  | { kind: 'byMpCost'; op: CompareOp; value: number; ofCurrent?: boolean }
  | { kind: 'byCooldownReady'; ready: boolean }
  /** Skill action-delay (CTB cost) comparison. */
  | { kind: 'byCastDelay'; op: CompareOp; value: number }
  /** Skill power comparison. */
  | { kind: 'byPower'; op: CompareOp; value: number }

export interface SkillSelector {
  source: 'skills' | 'items'
  filters: SkillSelectorFilter[]
}

// ---------------------------------------------------------------------------
// Script structure: line → block → script. Nesting depth 0, 1, 2 (S1).
// ---------------------------------------------------------------------------

export interface ScriptLine {
  id: string
  /** Omitted = always true. */
  trigger?: Trigger
  target: TargetRule
  action: SkillSelector
}

export interface ScriptBlock {
  id: string
  /** 0 = root, 1 = first nested, 2 = second nested (max). */
  depth: 0 | 1 | 2
  /** Block-gate; omitted = always (the root opens when a block-eligible turn). */
  trigger?: Trigger
  lines: ScriptLine[]
  nested: ScriptBlock[]
}

export interface CharacterScript {
  id: string
  name: string
  description?: string
  /** Single-glyph art token rendered by the UI. */
  art?: string
  /** Built-in library scripts are read-only (S14); player scripts are editable. */
  builtIn?: boolean
  rootBlock: ScriptBlock
  /** The locked final rule, evaluated after the root block (default: attack lowest-HP enemy). */
  fallback?: ScriptLine
  /** Reaction sheet — always active in AUTO and MANUAL modes (S60). */
  reactions: ReactionRule[]
  createdAt: number
  updatedAt: number
}

/**
 * A reaction: fires when `gate` matches a battle event AND (optionally) every
 * extra `condition` holds from the reactor's perspective. It uses its own
 * target rule (event-relative targets allowed) and action. `delay` overrides
 * the action's CTB cost (0 = fire immediately/instantly).
 */
export interface ReactionRule {
  id: string
  name?: string
  gate: EventPattern
  conditions?: Condition[]
  target: TargetRule
  action: SkillSelector
  delay?: number
}

/** Ranks used by the `enemy-rank` condition (synthesised from enemy data). */
export type EnemyRank = 'normal' | 'elite' | 'boss'

// ---------------------------------------------------------------------------
// Interpreter context — the read-only battle snapshot the interpreter judges.
// ---------------------------------------------------------------------------

/** A single combatant's snapshot, from the reacting/acting actor's perspective. */
export interface ScriptActorSnapshot {
  id: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  statuses: ActiveStatusKind[]
  /** Current effective stats (after status modifiers) — for stat-compare. */
  stats: { hp: number; atk: number; def: number; mag: number; res: number; spd: number }
  /** Permanent base stats — for `ofCurrent` stat-compare comparisons. */
  baseStats: { hp: number; atk: number; def: number; mag: number; res: number; spd: number }
  /** Combat element (none when absent) — for `weak-to`. */
  element: Element
  /** Enemy rank for `enemy-rank`; undefined for player actors. */
  rank?: EnemyRank
  /** Known skill ids (loadout). */
  skills: string[]
  /** skillId → remaining on-cooldown own turns (absent/0 = ready). */
  cooldowns: Record<string, number>
  /** skillId → MP cost (absent = free). */
  skillCosts: Record<string, number>
  /** Usable inventory item ids (potions, scrolls, active-use). */
  items: string[]
}

export interface InterpreterContext {
  self: ScriptActorSnapshot
  /** Living allies (includes self). */
  allies: ScriptActorSnapshot[]
  /** Living enemies. */
  enemies: ScriptActorSnapshot[]
  /** Global resolved-turn counter. */
  turnCount: number
  /** Event-relative actor ids — only set while evaluating a reaction (M2+). */
  attackerId?: string
  triggerTargetId?: string
  previousTriggerTargetId?: string
}
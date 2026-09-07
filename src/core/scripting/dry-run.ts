/**
 * Phase 4.5.2 — M5 dry-run preview (`docs/workspace/phase_4.5.2-scripting.md`
 * §M5). Builds a mocked `BattleState` and drives the *exact same* interpreter
 * and reaction paths battle uses — it is a shared code path with a distinct
 * entry point, never a parallel implementation. If dry-run ever diverges from
 * battle, the preview becomes a lie (§9 guardrail).
 *
 * The mock never consumes real inventory: items held on actor snapshots are
 * a copy; `wouldConsumeItemId` only *signals* that the picked action would
 * consume an item in a real battle.
 */

import { createBattle } from '../combat/battle'
import type { ActiveStatusKind, BattleAction, BattleEvent, BattleState } from '../combat/types'
import type { Rng } from '../rng/rng'
import type { Character, EnemyDef } from '../types'
import type { CharacterScript, ScriptLine } from './types'
import { buildScriptContext, chooseScriptedPick } from './interpreter'
import { checkReactions } from '../combat/reactions'
import type { ReactionPlan } from '../combat/reactions'

/**
 * Mocked actor state applied on top of a freshly-built battle. Omitting a
 * field leaves the battle-constructed value untouched.
 */
export interface DryRunActorMock {
  hpFraction?: number
  mpFraction?: number
  statuses?: ActiveStatusKind[]
  items?: string[]
  cooldowns?: Record<string, number>
  turnCount?: number
}

/** What `dryRunChooseAction` resolved, plus what it would cost. */
export interface DryRunTurnResult {
  /** The matched rule line (null when nothing matched, incl. fallback). */
  line: ScriptLine | null
  /** The battle action that line produced. */
  action: BattleAction | null
  /** True when the pick came from the locked fallback (∞, always last). */
  fromFallback: boolean
  /** Flat index of the matched rule among all rule cards (for UI highlight). */
  ruleIndex: number
  /** Depth of the enclosing block (0 root, 1/2 nested). */
  blockDepth: 0 | 1 | 2
  /**
   * Item the picked action would consume in a real battle, if any. The mock
   * itself does NOT remove items — this is only a signal (§9 guardrail).
   */
  wouldConsumeItemId?: string
}

function clamp(v: number, max: number): number {
  if (v < 0) return 0
  if (v > max) return max
  return v
}

/** Builds a fresh mock battle from real party/enemy defs (shared `createBattle`). */
export function createDryRunBattle(
  partyDefs: Character[],
  enemyDefs: EnemyDef[],
  seed: number,
): BattleState {
  return createBattle(partyDefs, enemyDefs, seed)
}

/** Applies mocked arena conditions to a built battle (idempotent). */
export function applyDryRunMocks(
  battle: BattleState,
  mocks: Record<string, DryRunActorMock>,
): void {
  for (const [actorId, mock] of Object.entries(mocks)) {
    const actor = battle.actors[actorId]
    if (!actor) continue
    if (mock.hpFraction !== undefined) {
      actor.hp = Math.round(clamp(mock.hpFraction, 1) * actor.stats.hp)
    }
    if (mock.mpFraction !== undefined) {
      const maxMp = actor.maxMp ?? 0
      actor.mp = Math.round(clamp(mock.mpFraction, 1) * maxMp)
    }
    if (mock.statuses !== undefined) {
      actor.statuses = mock.statuses.map((kind) => ({ kind, duration: 999 }))
    }
    if (mock.items !== undefined) actor.items = mock.items.slice()
    if (mock.cooldowns !== undefined) actor.cooldowns = { ...mock.cooldowns }
    if (mock.turnCount !== undefined) battle.turnCount = mock.turnCount
  }
}

/** Flat card index of a rule line (0-based, over all blocks depth-first). */
export function ruleCardIndex(script: CharacterScript, lineId: string): number {
  let i = 0
  const walk = (block: CharacterScript['rootBlock']): boolean => {
    for (const l of block.lines) {
      if (l.id === lineId) return true
      i += 1
    }
    for (const child of block.nested) {
      if (walk(child)) return true
    }
    return false
  }
  return walk(script.rootBlock) ? i : -1
}

/**
 * Runs the script's turn rules against the mocked state — the same walk battle
 * executes via `chooseScriptedPick`/`chooseScriptedAction`. `rng` optional
 * (battle frees it); random selectors fall back deterministically when omitted.
 */
export function dryRunChooseAction(
  battle: BattleState,
  actorId: string,
  script: CharacterScript,
  rng?: Rng,
): DryRunTurnResult {
  const ctx = buildScriptContext(battle, actorId)
  const pick = chooseScriptedPick(script, ctx, rng)
  const line = pick?.line ?? null
  const action = pick?.action ?? null
  let wouldConsumeItemId: string | undefined
  if (action?.kind === 'item' && action.itemId) wouldConsumeItemId = action.itemId
  return {
    line,
    action,
    fromFallback: pick?.fromFallback ?? false,
    ruleIndex: line ? ruleCardIndex(script, line.id) : -1,
    blockDepth: (pick?.block.depth ?? 0) as 0 | 1 | 2,
    wouldConsumeItemId,
  }
}

/**
 * Evaluates the script library's reactions against a mocked event — the exact
 * `checkReactions` path battle fires on its event bus (shared code path, M5).
 * `getScript` resolves a character's script by character id (actor `sourceId`).
 */
export function dryRunCheckReactions(
  battle: BattleState,
  event: BattleEvent,
  previousEvent: BattleEvent | undefined,
  getScript: (characterId: string) => CharacterScript | undefined,
): ReactionPlan[] {
  return checkReactions(battle, event, previousEvent, getScript)
}

export type { BattleEvent, BattleAction, ReactionPlan }
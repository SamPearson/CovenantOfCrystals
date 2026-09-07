/**
 * Reaction evaluation (Phase 4.5.2 S21–S23). Pure: given a battle event it
 * walks every player actor's reaction sheet and returns the reactions that
 * qualify. Selection is deterministic — no battle rng is used here; a flagged
 * reaction either resolves to a single stable action or is skipped. Execution
 * (and any scheduling) happens in `combat/battle.ts`.
 *
 * Contract:
 *  - A reaction qualifies when its gate matches the event AND every extra
 *    condition holds from the reactor's perspective.
 *  - Reaction-relative context exposes `attackerId` (= event source) and
 *    `triggerTargetId` (= event subject); `previousTriggerTargetId` carries
 *    the subject of the previous event while draining the bus.
 *  - `reactionTo` legality is re-validated here via the `ReactionGate` passed
 *    to `selectAction`: a skill/item that does not grant the fired event can
 *    never be selected, so an all-illegal rule resolves to nothing and is
 *    skipped (interpreter-as-truth, S21).
 *  - `delay` defaults to the resolved action's CTB cost; 0 means inline.
 */

import { BALANCE, getSkill } from '../data'
import { evalCondition } from '../scripting/conditions'
import { buildScriptContext } from '../scripting/interpreter'
import { selectAction } from '../scripting/skill-selector'
import { isWholeSide, resolveTargetIds } from '../scripting/targets'
import type { CharacterScript, Condition, InterpreterContext, ReactionRule } from '../scripting/types'
import { matchesPermission } from './battle-events'
import type { BattleEvent, BattleState } from './types'

export type ReactionKind = 'skill' | 'item' | 'attack' | 'defend'

/** A qualifying reaction ready for execution. */
export interface ReactionPlan {
  /** Reaction rule id (stable, for tests). */
  id: string
  /** Acting actor. */
  actorId: string
  kind: ReactionKind
  skillId?: string
  itemId?: string
  /** Single resolved target (undefined for whole-side rules). */
  targetId?: string
  /** CTB delay in ms; 0 fires inline immediately. */
  delay: number
}

/** Resolves the profile's script for the given character (library lookup). */
export type ScriptResolver = (characterId: string) => CharacterScript | undefined

function withEventCtx(base: InterpreterContext, event: BattleEvent, previous?: BattleEvent): InterpreterContext {
  return {
    ...base,
    attackerId: event.sourceId,
    triggerTargetId: event.actorId,
    previousTriggerTargetId: previous?.actorId,
  }
}

function defaultDelay(kind: ReactionKind, skillId?: string): number {
  switch (kind) {
    case 'attack':
      return BALANCE.actionDelays.attack
    case 'defend':
      return BALANCE.actionDelays.defend
    case 'item':
      return BALANCE.actionDelays.item
    case 'skill': {
      try {
        const skill = getSkill(skillId ?? '')
        return skill.delay ?? BALANCE.actionDelays.skill
      } catch {
        return BALANCE.actionDelays.skill
      }
    }
  }
}

function planFor(
  rule: ReactionRule,
  actorId: string,
  kind: ReactionKind,
  skillId: string | undefined,
  itemId: string | undefined,
  targetId: string | undefined,
): ReactionPlan {
  return {
    id: rule.id,
    actorId,
    kind,
    skillId,
    itemId,
    targetId,
    delay: rule.delay ?? defaultDelay(kind, skillId),
  }
}

/**
 * Evaluates one actor's reaction sheet against an event.
 * Returns every qualifying rule IN SHEET ORDER; rules whose target or action
 * resolves empty are skipped.
 */
function evaluateActor(
  actorId: string,
  script: CharacterScript,
  battle: BattleState,
  event: BattleEvent,
  previousEvent: BattleEvent | undefined,
): ReactionPlan[] {
  const plans: ReactionPlan[] = []
  const base = withEventCtx(buildScriptContext(battle, actorId), event, previousEvent)
  const reactor = battle.actors[actorId]

  for (const rule of script.reactions) {
    if (!matchesPermission(rule.gate, event, reactor, battle)) continue
    const qualifies = !rule.conditions || rule.conditions.length === 0
      ? true
      : rule.conditions.every((c: Condition) => evalCondition(c, base))
    if (!qualifies) continue

    const targetIds = resolveTargetIds(rule.target, base, undefined)
    if (targetIds.length === 0) continue
    const targetId = isWholeSide(rule.target.kind) ? undefined : targetIds[0]

    const selected = selectAction(rule.action, base, undefined, { event, reactor, battle })
    if (!selected) continue

    switch (selected.kind) {
      case 'skill':
        plans.push(planFor(rule, actorId, 'skill', selected.id, undefined, targetId))
        break
      case 'item':
        plans.push(planFor(rule, actorId, 'item', undefined, selected.id, targetId))
        break
      case 'attack':
        plans.push(planFor(rule, actorId, 'attack', undefined, undefined, targetId))
        break
      case 'defend':
        plans.push(planFor(rule, actorId, 'defend', undefined, undefined, undefined))
        break
    }
  }
  return plans
}

/**
 * The reaction sheet check: every living player actor (deterministic
 * insertion order) whose script qualifies in gate + conditions. `previousEvent`
 * is the event processed just before `event` while draining the bus (feed the
 * same event repeatedly once the semantic chain ends — it is only read for its
 * subject id).
 */
export function checkReactions(
  battle: BattleState,
  event: BattleEvent,
  previousEvent: BattleEvent | undefined,
  getScript: ScriptResolver,
): ReactionPlan[] {
  const plans: ReactionPlan[] = []
  for (const actor of Object.values(battle.actors)) {
    if (actor.side !== 'player' || actor.ko) continue
    const script = getScript(actor.sourceId)
    if (!script || script.reactions.length === 0) continue
    plans.push(...evaluateActor(actor.id, script, battle, event, previousEvent))
  }
  return plans
}
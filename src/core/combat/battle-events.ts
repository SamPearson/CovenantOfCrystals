/**
 * Reaction event bus (Phase 4.5.2 S21–S23). Pure matching helpers: an
 * `EventPattern` (`{ kind, source?, target? }`) is the shape used both for a
 * reaction rule's gate and for a skill/item's `reactionTo` permission. The
 * emitted `BattleEvent`s and the queued `PendingReaction`s live in
 * `combat/types.ts`; reaction *evaluation* is `combat/reactions.ts` and
 * execution stays in `combat/battle.ts`.
 */

import type { ActorFilter, EventPattern } from '../scripting/types'
import type { BattleActor, BattleEvent, BattleState } from './types'

/**
 * Whether `actorId` satisfies an `ActorFilter` relative to the reactor.
 * `self` = the reactor itself; `ally` / `enemy` are resolved by side from the
 * live battle. Unknown ids fail every filter (they cannot be matched, but an
 * omitted filter is a wildcard and is handled by the caller).
 */
function matchesFilter(
  filter: ActorFilter,
  actorId: string | undefined,
  reactor: BattleActor,
  battle: BattleState,
): boolean {
  if (actorId === undefined) return false
  if (filter === 'self') return actorId === reactor.id
  const side = battle.actors[actorId]?.side
  if (side === undefined) return false
  return filter === 'ally' ? side === reactor.side : side !== reactor.side
}

/**
 * Whether `event` matches `pattern` seen from `reactor`. Kind must agree; any
 * source/target filter present must match the event's source/target relative
 * to the reactor. Omitted filters are wildcards.
 *
 * Used for both reaction-rule gates and `reactionTo` permission checks — a
 * skill/item is only legal for a gate when at least one of its permission
 * patterns matches the event this way.
 */
export function matchesPermission(
  pattern: EventPattern,
  event: BattleEvent,
  reactor: BattleActor,
  battle: BattleState,
): boolean {
  if (pattern.kind !== event.kind) return false
  if (pattern.source !== undefined && !matchesFilter(pattern.source, event.sourceId, reactor, battle)) {
    return false
  }
  if (pattern.target !== undefined && !matchesFilter(pattern.target, event.actorId, reactor, battle)) {
    return false
  }
  return true
}

/** Any of `permissions` matching `event` from `reactor` (reactionTo legality). */
export function hasPermission(
  permissions: EventPattern[] | undefined,
  event: BattleEvent,
  reactor: BattleActor,
  battle: BattleState,
): boolean {
  if (!permissions || permissions.length === 0) return false
  return permissions.some((p) => matchesPermission(p, event, reactor, battle))
}
/**
 * CTB timeline — the shared turn queue (`docs/combat.md` §2). Pure module: no
 * Phaser, no store access. Position math:
 *
 *   nextAt = turnTime + actionDelay × (SPD_REF / SPD)
 *
 * Ties (equal `nextAt`) resolve by a stable rule — player side first, then
 * actor ID — so ordering is reproducible in unit tests (`docs/combat.md` §1).
 * Every helper keeps the queue sorted ascending by `nextAt`; the front entry
 * is next to act.
 */

import { BALANCE } from '../data/balance'
import type { CombatantSide, TimelineEntry } from './types'

/** Delay before an acting actor is re-inserted into the queue. */
export function timeToNextTurn(
  spd: number,
  actionDelay: number,
  spdRef: number = BALANCE.spdRef,
): number {
  if (!Number.isFinite(spd) || spd <= 0) {
    throw new RangeError(`SPD must be > 0, got ${spd}`)
  }
  if (!Number.isFinite(actionDelay) || actionDelay < 0) {
    throw new RangeError(`actionDelay must be >= 0, got ${actionDelay}`)
  }
  if (!Number.isFinite(spdRef) || spdRef <= 0) {
    throw new RangeError(`spdRef must be > 0, got ${spdRef}`)
  }
  return actionDelay * (spdRef / spd)
}

/**
 * Stable tie-break: `nextAt` ascending, then player side first, then actor ID
 * ascending. Fully deterministic — no RNG involved.
 */
export function compareEntries(a: TimelineEntry, b: TimelineEntry): number {
  if (a.nextAt !== b.nextAt) return a.nextAt - b.nextAt
  if (a.side !== b.side) return a.side === 'player' ? -1 : 1
  if (a.actorId < b.actorId) return -1
  if (a.actorId > b.actorId) return 1
  return 0
}

/** Sort the queue by position (mutates and returns it). */
export function sortQueue(queue: TimelineEntry[]): TimelineEntry[] {
  return queue.sort(compareEntries)
}

/**
 * Insert (or re-insert) an actor at `nextAt`. Re-inserting replaces the
 * actor's existing slot so each actor appears at most once in the queue.
 * Returns the queue.
 */
export function insertActor(
  queue: TimelineEntry[],
  actorId: string,
  side: CombatantSide,
  nextAt: number,
): TimelineEntry[] {
  const without = queue.filter((e) => e.actorId !== actorId)
  without.push({ actorId, side, nextAt })
  return sortQueue(without)
}

/** Remove an actor's slot from the queue (e.g. on KO). Returns the queue. */
export function removeActor(queue: TimelineEntry[], actorId: string): TimelineEntry[] {
  return queue.filter((e) => e.actorId !== actorId)
}

function findEntry(queue: TimelineEntry[], actorId: string): TimelineEntry {
  const entry = queue.find((e) => e.actorId === actorId)
  if (!entry) throw new Error(`No queue entry for actor: ${actorId}`)
  return entry
}

/**
 * Pull an actor's next turn forward by `amount` (the `nextAt` mutation hook —
 * haste-style effects, event-node traps). Clamps at 0 so a pulled actor never
 * acts before battle start. Returns the queue.
 */
export function pullForward(queue: TimelineEntry[], actorId: string, amount: number): TimelineEntry[] {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`amount must be >= 0, got ${amount}`)
  }
  const entry = findEntry(queue, actorId)
  entry.nextAt = Math.max(0, entry.nextAt - amount)
  return sortQueue(queue)
}

/** Push an actor's next turn back by `amount` (slow-style effects). Returns the queue. */
export function pushBack(queue: TimelineEntry[], actorId: string, amount: number): TimelineEntry[] {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`amount must be >= 0, got ${amount}`)
  }
  const entry = findEntry(queue, actorId)
  entry.nextAt += amount
  return sortQueue(queue)
}

/** The next actor to act (queue front), or undefined when the queue is empty. */
export function peekNext(queue: TimelineEntry[]): TimelineEntry | undefined {
  return queue[0]
}

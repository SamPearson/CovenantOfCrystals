/**
 * Pure diff helpers for the BattleScene's damage/heal floating numbers.
 * Snapshot vitals before an action, diff after it resolves, and the scene
 * renders the deltas. Phaser-free so they are unit-testable.
 */

import type { BattleState } from '../../core/combat/types'

export interface Vitals {
  hp: number
  mp: number
}

export type VitalsSnapshot = Record<string, Vitals>

export interface VitalsDelta {
  actorId: string
  hpDelta: number
  mpDelta: number
}

/** Record every combatant's hp/mp so a subsequent action's deltas are visible. */
export function snapshotVitals(battle: BattleState): VitalsSnapshot {
  const snapshot: VitalsSnapshot = {}
  for (const actor of Object.values(battle.actors)) {
    snapshot[actor.id] = { hp: actor.hp, mp: actor.mp }
  }
  return snapshot
}

/** Compare a snapshot against a battle's current vitals, keeping only deltas. */
export function diffVitals(snapshot: VitalsSnapshot, battle: BattleState): VitalsDelta[] {
  const deltas: VitalsDelta[] = []
  for (const actor of Object.values(battle.actors)) {
    const before = snapshot[actor.id]
    if (!before) continue
    const hpDelta = actor.hp - before.hp
    const mpDelta = actor.mp - before.mp
    if (hpDelta !== 0 || mpDelta !== 0) {
      deltas.push({ actorId: actor.id, hpDelta, mpDelta })
    }
  }
  return deltas
}
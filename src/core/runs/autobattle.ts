/**
 * Auto-advance stop decision (Phase 4 M4, `docs/workspace/phase-4-autobattle-plan.md` §7).
 *
 * Pure + Phaser-free so it can be unit tested and reused by RunScene. Given the
 * player's `AutobattlePrefs` and the outcome of the just-finished battle plus the
 * next node to enter, it reports whether RunScene should PAUSE at the run map
 * (awaiting a player click) instead of auto-advancing straight into the next node.
 *
 * Hard stops — party wipe and run end — are NOT configurable and are handled by
 * the caller (`resolveNode` returns a `RunResult`); this helper only governs the
 * soft stop points (A9): boss, elite, individual permadeath, and rest.
 */

import type { AutobattlePrefs, RunNodeType } from '../types'

export interface AutoAdvanceContext {
  /** Characters that died (permadeath) in the just-finished battle. */
  koIds: string[]
  /** The node RunScene is about to enter. `null`/`undefined` means the run has ended. */
  nextNode?: { type: RunNodeType } | null
}

/**
 * Returns true when RunScene should stop at the run map (manual play) rather
 * than auto-advance. Party wipe / run-end are hard stops handled elsewhere.
 */
export function shouldStopBeforeAdvance(
  prefs: AutobattlePrefs,
  context: AutoAdvanceContext,
): boolean {
  const { koIds, nextNode } = context
  if (!nextNode) return false // run ended; caller hard-stops to ResultScene

  // Individual permadeath stop: a character died in the just-finished battle.
  if (koIds.length > 0 && prefs.stops.permadeath) return true

  switch (nextNode.type) {
    case 'rest':
      return prefs.stops.rest
    case 'boss':
      return prefs.stops.boss
    case 'elite':
      return prefs.stops.elite
    case 'battle':
    default:
      return false
  }
}

/**
 * AI profile scripts (`docs/combat.md` §8, Phase 2 plan M3). Shared by every
 * enemy whose `EnemyDef.ai` matches the profile id. The interpreter
 * (`src/core/combat/ai.ts`) scans each script top-down and takes the first
 * true condition — scripts end in an `always` catch-all so a move always
 * resolves.
 *
 * Conventions:
 * - A `skill` action without `skillId` uses the actor's primary skill
 *   (`skills[0]`) — keep a boss's signature move first in its skill list.
 * - `hp-pct` values are fractions in [0, 1].
 * - `turns`/`turns-mod` count the actor's own battle turns (1-based), so boss
 *   calendar patterns ("defend turn 1, crush every 3rd turn") read naturally.
 */

import type { AiScript } from '../combat/ai'
import type { AiProfileId } from '../types'

export const AI_SCRIPTS: Record<AiProfileId, AiScript> = {
  /** Cannon fodder: chips away at the weakest foe. */
  minion: [
    {
      condition: { kind: 'always' },
      action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } },
    },
  ],

  /** Brace then brawl: open defensively, re-brace when hurt, keep swinging. */
  tanky: [
    { condition: { kind: 'turns', op: '==', value: 1 }, action: { kind: 'defend' } },
    { condition: { kind: 'hp-pct', scope: 'self', op: '<', value: 0.35 }, action: { kind: 'defend' } },
    { condition: { kind: 'always' }, action: { kind: 'skill', target: { kind: 'lowest-hp-enemy' } } },
  ],

  /** Glass cannon: no defensive option, always the biggest spell. */
  glass: [
    { condition: { kind: 'always' }, action: { kind: 'skill', target: { kind: 'lowest-hp-enemy' } } },
  ],

  /** Boss calendar pattern: survey turn 1, crush every 3rd turn, press when bloodied. */
  boss: [
    { condition: { kind: 'turns', op: '==', value: 1 }, action: { kind: 'defend' } },
    { condition: { kind: 'turns-mod', divisor: 3, remainder: 0 }, action: { kind: 'skill', target: { kind: 'lowest-hp-enemy' } } },
    { condition: { kind: 'hp-pct', scope: 'self', op: '<', value: 0.5 }, action: { kind: 'skill', target: { kind: 'lowest-hp-enemy' } } },
    { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'random-enemy' } } },
  ],
}

const byProfile = new Map<AiProfileId, AiScript>(
  Object.entries(AI_SCRIPTS) as [AiProfileId, AiScript][],
)

/** The priority script for a profile; throws on unknown profile ids. */
export function getAiScript(profile: AiProfileId): AiScript {
  const script = byProfile.get(profile)
  if (!script) throw new Error(`Unknown AI profile: "${profile}"`)
  return script
}
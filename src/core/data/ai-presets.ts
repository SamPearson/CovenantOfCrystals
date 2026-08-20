/**
 * Phase 4 autobattle presets (`docs/autobattle-and-idle.md` §2). Chosen per
 * character in the party/equip screen; the same interpreter
 * (`src/core/combat/ai.ts`) scans each script top-down and takes the first
 * true condition. Unlike enemy profiles, the player side may spend MP, so
 * these presets gate `skill` actions behind `can-cast` — an out-of-MP healer
 * falls through to `defend` rather than an empty cast.
 *
 * Conventions:
 * - A `skill` action without `skillId` uses the actor's primary skill
 *   (`skills[0]`) — keep a character's go-to damage/heal skill first.
 * - `hp-pct` values are fractions in [0, 1]; `can-cast` without `skillId`
 *   means "any known skill is affordable".
 * - Scripts end in an `always` catch-all so a move always resolves.
 *
 * v1 ships curated presets only (decision #24); a player-authored mini-DSL is
 * explicitly out of scope.
 */

import type { AiScript } from '../combat/ai'
import type { Character, PlayerAiPresetId } from '../types'
import { getSkill } from './index'

export const PLAYER_AI_SCRIPTS: Record<PlayerAiPresetId, AiScript> = {
  /**
   * Damage dealer: cast the biggest spell when it's affordable, otherwise
   * basic attack — always aimed at the weakest foe.
   */
  dps: [
    {
      condition: { kind: 'can-cast' },
      action: { kind: 'skill', target: { kind: 'lowest-hp-enemy' } },
    },
    {
      condition: { kind: 'always' },
      action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } },
    },
  ],

  /**
   * Healer: top up the weakest ally below 60% HP when a heal is affordable,
   * otherwise hold the line. An out-of-MP healer defends instead of attacking.
   */
  healer: [
    {
      condition: {
        kind: 'and',
        conditions: [
          { kind: 'hp-pct', scope: 'any-ally', op: '<', value: 0.6 },
          { kind: 'can-cast' },
        ],
      },
      action: { kind: 'skill', target: { kind: 'lowest-hp-ally' } },
    },
    {
      condition: { kind: 'always' },
      action: { kind: 'defend' },
    },
  ],
}

const byPreset = new Map<PlayerAiPresetId, AiScript>(
  Object.entries(PLAYER_AI_SCRIPTS) as [PlayerAiPresetId, AiScript][],
)

/** The priority script for an autobattle preset; throws on unknown ids. */
export function getPlayerAiScript(presetId: PlayerAiPresetId): AiScript {
  const script = byPreset.get(presetId)
  if (!script) throw new Error(`Unknown player AI preset: "${presetId}"`)
  return script
}

/**
 * The default preset for a freshly-autobattling character: `healer` when they
 * know any healing skill, else `dps`. The player can override per character.
 */
export function defaultPresetFor(character: Character): PlayerAiPresetId {
  const knowsHeal = character.learnedSkills.some((skillId) => getSkill(skillId).kind === 'heal')
  return knowsHeal ? 'healer' : 'dps'
}
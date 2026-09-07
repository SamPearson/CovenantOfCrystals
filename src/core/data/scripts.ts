/**
 * Phase 4.5.2 — the two built-in character scripts. These are read-only library
 * seeds (the store refuses edits) and the default fallback when a character has
 * no `scriptId` (they cover the exact behavior of the Phase 4 `dps`/`healer`
 * AI presets, expressed as player-authored scripts).
 */

import type { CharacterScript } from '../scripting/types'

export const BUILT_IN_SCRIPT_IDS = {
  dps: 'builtin.dps',
  healer: 'builtin.healer',
} as const

/** DPS: cast any affordable damage skill at the lowest-HP enemy; else basic attack it. */
export const BUILT_IN_DPS: CharacterScript = {
  id: BUILT_IN_SCRIPT_IDS.dps,
  name: 'DPS',
  description:
    'Casts an affordable damage skill at the lowest-HP enemy; otherwise falls back to a basic attack.',
  builtIn: true,
  createdAt: 0,
  updatedAt: 0,
  rootBlock: {
    id: 'root',
    depth: 0,
    lines: [
      {
        id: 'dps.1',
        trigger: { conditions: [{ kind: 'can-cast' }], operator: 'AND' },
        target: { kind: 'lowest-hp-enemy' },
        action: { source: 'skills', filters: [{ kind: 'byKind', skillKind: 'damage' }] },
      },
    ],
    nested: [],
  },
  fallback: {
    id: 'fallback',
    target: { kind: 'lowest-hp-enemy' },
    action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] },
  },
  reactions: [],
}

/** Healer: cast an affordable heal skill at the lowest-HP ally while one is below 60%; else defend. */
export const BUILT_IN_HEALER: CharacterScript = {
  id: BUILT_IN_SCRIPT_IDS.healer,
  name: 'Healer',
  description:
    'Casts an affordable heal skill at the lowest-HP ally when any ally is below 60% HP; otherwise defends.',
  builtIn: true,
  createdAt: 0,
  updatedAt: 0,
  rootBlock: {
    id: 'root',
    depth: 0,
    lines: [
      {
        id: 'healer.1',
        trigger: {
          conditions: [
            { kind: 'hp-pct', scope: 'any-ally', op: '<', value: 0.6 },
            { kind: 'can-cast' },
          ],
          operator: 'AND',
        },
        target: { kind: 'lowest-hp-ally' },
        action: { source: 'skills', filters: [{ kind: 'byKind', skillKind: 'heal' }] },
      },
    ],
    nested: [],
  },
  fallback: {
    id: 'fallback',
    target: { kind: 'self' },
    action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'defend' }] },
  },
  reactions: [],
}

export const BUILT_IN_SCRIPTS: CharacterScript[] = [BUILT_IN_DPS, BUILT_IN_HEALER]

export function getBuiltInScript(id: string): CharacterScript | undefined {
  return BUILT_IN_SCRIPTS.find((s) => s.id === id)
}
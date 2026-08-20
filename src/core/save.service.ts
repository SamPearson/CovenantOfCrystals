/**
 * Save persistence. Backed by localStorage in the browser; no-op / volatile
 * fallback in server runtimes so the same module can be tested in Node.
 * Stage 2 swaps this for the mock API (docs/roadmap.md).
 */

import { validateSaveFile } from './validation'
import type { AutobattlePrefs, SaveFile } from './types'
import { uuid } from './id'
import { BALANCE } from './data/balance'

export const SAVE_KEY = 'covenant.of.crystals.save'
export const SCHEMA_VERSION = 2

function storage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // access denied (privacy mode, non-browser) — fall through
  }
  return null
}

export function loadSave(): SaveFile | null {
  const s = storage()
  if (!s) return null
  const raw = s.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    const save = validateSaveFile(JSON.parse(raw))
    return migrateSave(save)
  } catch {
    // Corrupt save. We could surface it to the player in Phase 2; for now,
    // treat as no save so the player can restart.
    return null
  }
}

export function writeSave(save: SaveFile): void {
  const s = storage()
  if (!s) return
  save.savedAt = Date.now()
  s.setItem(SAVE_KEY, JSON.stringify(save))
}

export function clearSave(): void {
  const s = storage()
  if (!s) return
  s.removeItem(SAVE_KEY)
}

export function createNewSave(profileId?: string, displayName?: string): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    profile: {
      profileId: profileId ?? uuid(),
      displayName: displayName ?? 'Player',
      gold: BALANCE.economy.startingGold,
      unlockedClasses: ['knight'],
      characters: {},
      boxes: [],
      inventory: { items: [], gear: [] },
      party: [],
      autobattle: {
        speed: 1,
        skipAnimations: false,
        stops: { boss: true, elite: true, permadeath: true, rest: true },
      },
      stats: { totalRuns: 0, wins: 0, losses: 0 },
      shop: {
        always: ['health_potion', 'greater_health_potion', 'mana_potion', 'greater_mana_potion'],
        rotating: { gear: [], skills: [] },
      },
      recruitment: [],
      createdAt: Date.now(),
    },
  }
}

export const AUTOBATTLE_DEFAULTS: AutobattlePrefs = {
  speed: 1,
  skipAnimations: false,
  stops: { boss: true, elite: true, permadeath: true, rest: true },
}

/**
 * Schema v1 → v2 default-filling migration (A12): v1 saves have no
 * `profile.autobattle`; fill the defaults and bump the version so the next
 * write persists the v2 shape.
 */
function migrateSave(save: SaveFile): SaveFile {
  if (!save.profile.autobattle) save.profile.autobattle = { ...AUTOBATTLE_DEFAULTS }
  save.schemaVersion = SCHEMA_VERSION
  return save
}

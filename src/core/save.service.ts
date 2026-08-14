/**
 * Save persistence. Backed by localStorage in the browser; no-op / volatile
 * fallback in server runtimes so the same module can be tested in Node.
 * Stage 2 swaps this for the mock API (docs/roadmap.md).
 */

import { validateSaveFile } from './validation'
import type { SaveFile } from './types'
import { uuid } from './id'

export const SAVE_KEY = 'covenant.of.crystals.save'
export const SCHEMA_VERSION = 1

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
    return validateSaveFile(JSON.parse(raw))
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
      gold: 0,
      unlockedClasses: ['knight'],
      characters: {},
      boxes: [],
      inventory: { items: [], gear: [] },
      party: [],
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

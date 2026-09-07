/**
 * Save persistence. Backed by localStorage in the browser; no-op / volatile
 * fallback in server runtimes so the same module can be tested in Node.
 * Stage 2 swaps this for the mock API (docs/roadmap.md).
 */

import { validateSaveFile } from './validation'
import type { AutobattlePrefs, SaveFile } from './types'
import { uuid } from './id'
import { BALANCE } from './data/balance'
import { BUILT_IN_SCRIPTS, BUILT_IN_SCRIPT_IDS } from './data/scripts'
import type { CharacterScript } from './scripting/types'

export const SAVE_KEY = 'covenant.of.crystals.save'
export const SCHEMA_VERSION = 3

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
        resultDelayMs: 3000,
        stops: { boss: true, elite: true, permadeath: true, rest: true },
      },
      stats: { totalRuns: 0, wins: 0, losses: 0 },
      shop: {
        always: ['health_potion', 'greater_health_potion', 'mana_potion', 'greater_mana_potion'],
        rotating: { gear: [], skills: [] },
      },
      recruitment: [],
      createdAt: Date.now(),
      scriptLibrary: BUILT_IN_SCRIPTS.map(cloneScript),
    },
  }
}

/** Deep-clones a script so library entries are independent of the source constant. */
function cloneScript(s: CharacterScript): CharacterScript {
  return JSON.parse(JSON.stringify(s)) as CharacterScript
}

export const AUTOBATTLE_DEFAULTS: AutobattlePrefs = {
  speed: 1,
  skipAnimations: false,
  resultDelayMs: 3000,
  stops: { boss: true, elite: true, permadeath: true, rest: true },
}

/**
 * Migration chain. Each step fills the missing shape for its target version
 * and bumps `schemaVersion`; we re-run from whatever the save reports up to
 * the current `SCHEMA_VERSION` so older saves self-heal on load.
 */
function migrateSave(save: SaveFile): SaveFile {
  if (save.schemaVersion < 2) migrateV1ToV2(save)
  if (save.schemaVersion < 3) migrateV2ToV3(save)
  save.schemaVersion = SCHEMA_VERSION
  return save
}

/** v1 → v2: fills `profile.autobattle` defaults (A12). */
function migrateV1ToV2(save: SaveFile): void {
  if (!save.profile.autobattle) save.profile.autobattle = { ...AUTOBATTLE_DEFAULTS }
  else if (typeof save.profile.autobattle.resultDelayMs !== 'number') {
    save.profile.autobattle.resultDelayMs = AUTOBATTLE_DEFAULTS.resultDelayMs
  }
  save.schemaVersion = 2
}

/**
 * v2 → v3 (Phase 4.5.2, S13): seeds the built-in scripting library and
 * translates each character's legacy `autobattle` preset into a `scriptId`.
 * The `autobattle` field is left in place for one release as a fallback.
 */
function migrateV2ToV3(save: SaveFile): void {
  const library = save.profile.scriptLibrary ?? []
  const byId = new Map(library.map((s) => [s.id, s]))
  for (const builtin of BUILT_IN_SCRIPTS) {
    if (!byId.has(builtin.id)) library.push(cloneScript(builtin))
  }
  save.profile.scriptLibrary = library

  for (const character of Object.values(save.profile.characters)) {
    if (character.scriptId) continue
    if (character.autobattle === 'dps') character.scriptId = BUILT_IN_SCRIPT_IDS.dps
    else if (character.autobattle === 'healer') character.scriptId = BUILT_IN_SCRIPT_IDS.healer
  }
  save.schemaVersion = 3
}

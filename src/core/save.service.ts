/**
 * Save persistence. Backed by the storage abstraction layer.
 * Supports multiple local profiles, export/import JSON, no passwords.
 */

import { validateSaveFile } from './validation'
import type { AutobattlePrefs, SaveFile } from './types'
import { uuid } from './id'
import { BALANCE } from './data/balance'
import { BUILT_IN_SCRIPTS, BUILT_IN_SCRIPT_IDS } from './data/scripts'
import { CLASSES } from './data/classes'
import type { CharacterScript } from './scripting/types'
import { getBackend, STORAGE_KEYS, type ProfileMeta } from './storage'

export const SCHEMA_VERSION = 4

/** All classes are recruitable from the start (sandbox mode, docs/roadmap.md). */
export const ALL_CLASSES: string[] = CLASSES.map((c) => c.id)

/** Build the storage key for a profile. */
function profileKey(profileId: string): string {
  return `${STORAGE_KEYS.profilePrefix}${profileId}`
}

/** List all saved profiles (metadata only, no full load). */
export function listProfiles(): ProfileMeta[] {
  const backend = getBackend()
  const prefix = STORAGE_KEYS.profilePrefix
  const metas: ProfileMeta[] = []

  for (const key of backend.keys()) {
    if (!key.startsWith(prefix)) continue
    const raw = backend.getItem(key)
    if (!raw) continue
    try {
      const save: SaveFile = JSON.parse(raw)
      const p = save.profile
      metas.push({
        profileId: p.profileId,
        displayName: p.displayName,
        createdAt: p.createdAt,
        lastPlayed: save.savedAt,
        stats: p.stats,
        sizeBytes: raw.length,
      })
    } catch {
      // Skip corrupt entries
    }
  }

  // Sort by last played (most recent first)
  metas.sort((a, b) => b.lastPlayed - a.lastPlayed)
  return metas
}

/** Get the active profile ID. */
export function getActiveProfileId(): string | null {
  return getBackend().getItem(STORAGE_KEYS.activeProfileKey)
}

/** Set the active profile ID. */
export function setActiveProfileId(profileId: string): void {
  getBackend().setItem(STORAGE_KEYS.activeProfileKey, profileId)
}

/** Load a specific profile by ID. */
export function loadProfile(profileId: string): SaveFile | null {
  const backend = getBackend()
  const raw = backend.getItem(profileKey(profileId))
  if (!raw) return null
  try {
    const save = validateSaveFile(JSON.parse(raw))
    return migrateSave(save)
  } catch {
    return null
  }
}

/** Load the active profile (or null if none). */
export function loadActiveProfile(): SaveFile | null {
  const activeId = getActiveProfileId()
  if (!activeId) return null
  return loadProfile(activeId)
}

/** Create a new profile and set it as active. */
export function createProfile(displayName?: string): SaveFile {
  const save = createNewSave(undefined, displayName)
  const backend = getBackend()
  backend.setItem(profileKey(save.profile.profileId), JSON.stringify(save))
  setActiveProfileId(save.profile.profileId)
  return save
}

/** Save a profile (write to storage). */
export function saveProfile(save: SaveFile): void {
  const backend = getBackend()
  save.savedAt = Date.now()
  backend.setItem(profileKey(save.profile.profileId), JSON.stringify(save))
  setActiveProfileId(save.profile.profileId)
}

/** Delete a profile. */
export function deleteProfile(profileId: string): boolean {
  const backend = getBackend()
  const key = profileKey(profileId)
  const existed = backend.getItem(key) !== null
  if (existed) {
    backend.removeItem(key)
    // If this was the active profile, clear active
    if (getActiveProfileId() === profileId) {
      const remaining = listProfiles()
      if (remaining.length > 0) {
        setActiveProfileId(remaining[0].profileId)
      } else {
        backend.removeItem(STORAGE_KEYS.activeProfileKey)
      }
    }
  }
  return existed
}

/** Export a profile as JSON string. */
export function exportProfile(profileId: string): string | null {
  const save = loadProfile(profileId)
  if (!save) return null
  return JSON.stringify(save, null, 2)
}

/** Import a profile from JSON string. Returns the new profile ID. */
export function importProfile(json: string, newDisplayName?: string): string | null {
  try {
    const save = validateSaveFile(JSON.parse(json))
    // Generate new ID to avoid conflicts
    save.profile.profileId = uuid()
    save.profile.displayName = newDisplayName ?? `${save.profile.displayName} (imported)`
    save.profile.createdAt = Date.now()
    save.savedAt = Date.now()
    const backend = getBackend()
    backend.setItem(profileKey(save.profile.profileId), JSON.stringify(save))
    setActiveProfileId(save.profile.profileId)
    return save.profile.profileId
  } catch {
    return null
  }
}

/** Clear ALL profiles and settings (nuclear option). */
export function clearAllProfiles(): void {
  const backend = getBackend()
  for (const key of backend.keys()) {
    if (key.startsWith(STORAGE_KEYS.profilePrefix) || key === STORAGE_KEYS.activeProfileKey) {
      backend.removeItem(key)
    }
  }
}

/** Rename a profile. */
export function renameProfile(profileId: string, newName: string): boolean {
  const save = loadProfile(profileId)
  if (!save) return false
  save.profile.displayName = newName
  saveProfile(save)
  return true
}

/** Duplicate a profile. */
export function duplicateProfile(profileId: string, newName?: string): string | null {
  const save = loadProfile(profileId)
  if (!save) return null
  save.profile.profileId = uuid()
  save.profile.displayName = newName ?? `${save.profile.displayName} (copy)`
  save.profile.createdAt = Date.now()
  save.savedAt = Date.now()
  const backend = getBackend()
  backend.setItem(profileKey(save.profile.profileId), JSON.stringify(save))
  setActiveProfileId(save.profile.profileId)
  return save.profile.profileId
}

/** Create a new save object (internal helper, also exported for testing). */
export function createNewSave(profileId?: string, displayName?: string): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    profile: {
      profileId: profileId ?? uuid(),
      displayName: displayName ?? 'Player',
      gold: BALANCE.economy.startingGold,
      unlockedClasses: ALL_CLASSES.slice(),
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
  if (save.schemaVersion < 4) migrateV3ToV4(save)
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

/**
 * v3 → v4: unlocks the full class roster. Older saves only ever unlocked the
 * starting class, and sandbox mode wants every class recruitable from the
 * get-go. Idempotent — only appends classes that are missing.
 */
function migrateV3ToV4(save: SaveFile): void {
  const unlocked = save.profile.unlockedClasses
  for (const classId of ALL_CLASSES) {
    if (!unlocked.includes(classId)) unlocked.push(classId)
  }
  save.schemaVersion = 4
}

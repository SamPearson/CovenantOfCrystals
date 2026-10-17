/**
 * Lightweight store: holds the loaded SaveFile in memory, exposes actions
 * that mutate the profile and persist automatically, and notifies subscribers.
 * No external state library — decided in `docs/roadmap.md` (open q. #6).
 * Stage 2 swaps the persistence behind `save.service.ts` for a mock API.
 */

import type { SaveFile, PlayerProfile, ActiveRun, RunResult, PlayerAiPresetId } from './types'
import type { BattleResult } from './combat/types'
import {
  loadActiveProfile,
  saveProfile,
  createProfile,
  AUTOBATTLE_DEFAULTS,
  loadProfile,
  setActiveProfileId,
} from './save.service'
import { ensureBoxCount } from './boxes'
import { seedStarterRoster } from './starter'
import { generateRun } from './runs/run-gen'
import { resolveBattleResult, resolveRestNode, tickDurability } from './runs/resolve'
import { removeItem, findGearById } from './inventory'
import { getItem, getSkill } from './data'
import { equipGear, unequipSlot } from './equip'
import { applyStatShot as coreApplyStatShot, applyTome as coreApplyTome } from './items/apply'
import { applyLevelUp, canLevelUp, xpToNext, LEVEL_STATS } from './leveling'
import { validateLoadout } from './items'
import { refreshShopStock } from './shop/shop'
import { refreshRecruitment } from './shop/recruitment'
import { createRng } from './rng/rng'
import { uuid } from './id'
import { validateScriptDepth } from './scripting/interpreter'
import { SCRIPT_LIBRARY_CAP } from './scripting/types'
import type { CharacterScript } from './scripting/types'
import { TOWNS } from './data'

type Listener = () => void

let current: SaveFile
let listeners = new Set<Listener>()

function notify(): void {
  for (const listener of listeners) listener()
}

export interface ItemUseResult {
  ok: boolean
  error?: string
}

export function initStore(): SaveFile {
  const existing = loadActiveProfile()
  if (existing) {
    current = existing
    // Ensure boxes exist for older profiles (migration)
    ensureBoxCount(current.profile)
  } else {
    // No active profile — create a default one
    current = createProfile()
    ensureBoxCount(current.profile)
    seedStarterRoster(current.profile)
    saveProfile(current)
  }
  seedMetaStock()
  return current
}

/**
 * Phase 3 M7: seeds the shop's rotating stock and the recruitment offers on
 * first init so the meta tabs are populated before the first run. Fresh saves
 * (M4 core) start with empty rotating stock and offers; pre-M7 saves are the
 * same. After the first run completion `onRunEnd` regains control of both.
 *
 * Phase 5: Uses the profile's homeTown for town-aware stock generation.
 */
function seedMetaStock(): void {
  const profile = current.profile
  const townId = profile.homeTown ?? 'aldwyn'
  const rotating = profile.shop.rotating
  const stockEmpty = rotating.gear.length === 0 && rotating.skills.length === 0
  const offersEmpty = profile.recruitment.length === 0
  if (!stockEmpty && !offersEmpty) return
  const rng = createRng(Date.now() + profile.stats.totalRuns + 1)
  if (stockEmpty) refreshShopStock(profile, rng, townId)
  if (offersEmpty) refreshRecruitment(profile, rng, townId)
  saveProfile(current)
}

export function getSave(): SaveFile {
  return current
}

export function getProfile(): PlayerProfile {
  return current.profile
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Applies `fn` to the profile, persists, and notifies subscribers. */
export function mutate(fn: (profile: PlayerProfile) => void): void {
  fn(current.profile)
  saveProfile(current)
  notify()
}

// ---------------------------------------------------------------------------
// Run actions (Phase 3 M6, `phase-3-run-loop-plan.md` §5). Each action that
// lands on a node boundary persists immediately, creating the checkpoint the
// autobattle-and-idle.md §4 contract requires (post-battle and at rest).
// ---------------------------------------------------------------------------

/** The active run, or null when none is in progress. */
export function getActiveRun(): ActiveRun | null {
  return current.activeRun ?? null
}

/**
 * Starts a run of the given length with the given party snapshot, replacing
 * any prior (finished or in-progress) run.
 * Phase 5: Accepts optional townId for town-aware run generation.
 */
export function startRun(partyIds: string[], length: number, seed: number, opts?: { infinite?: boolean; townId?: string }): ActiveRun {
  const townId = opts?.townId ?? current.profile.homeTown ?? 'aldwyn'
  const run = generateRun({ profileId: current.profile.profileId, partyIds, length, seed, townId })
  if (opts?.infinite) {
    run.infinite = true
    run.loops = 0
  }
  current.activeRun = run
  saveProfile(current)
  notify()
  return run
}

/**
 * Resolves the just-finished battle against the run and persists a checkpoint.
 * Returns a `RunResult` when the run has ended (node was boss / full wipe /
 * fled), otherwise null after advancing to the next node.
 */
export function resolveNode(battleResult: BattleResult): RunResult | null {
  const run = current.activeRun
  if (!run) throw new Error('No active run')
  const result = resolveBattleResult(run, battleResult, current.profile)
  if (result) {
    onRunEnd(profileStats(result.status))
  }
  saveProfile(current)
  notify()
  return result
}

/** Resolves a rest node (heal/MP restore, no-op in P3) + checkpoint. */
export function resolveRest(): void {
  const run = current.activeRun
  if (!run) throw new Error('No active run')
  resolveRestNode(run)
  saveProfile(current)
  notify()
}

/**
 * Abandons the current run from the run map (survivors keep XP/gear, reduced
 * payout). Applies the same resolution path a fled battle would.
 */
export function abandonRun(): RunResult {
  const run = current.activeRun
  if (!run) throw new Error('No active run')
  const result = resolveBattleResult(
    run,
    { status: 'fled', koIds: [], survivors: [...run.party], xpAwarded: {}, drops: [], log: [] },
    current.profile,
  )
  if (!result) throw new Error('Failed to resolve abandoned run')
  onRunEnd(profileStats(result.status))
  saveProfile(current)
  notify()
  return result
}

/**
 * Sets a character's autobattle script (Phase 4 M1). `presetId` omitted (or
 * `undefined`) returns the character to Manual. Takes effect on the character's
 * next turn — never mid-turn (M2 exit criteria).
 */
export function setAutobattle(characterId: string, presetId: PlayerAiPresetId | undefined): void {
  const character = current.profile.characters[characterId]
  if (!character) throw new Error(`Character not found: ${characterId}`)
  character.autobattle = presetId
  saveProfile(current)
  notify()
}

// ---------------------------------------------------------------------------
// Scripting library (Phase 4.5.2 M3). A per-profile `scriptLibrary` of
// `CharacterScript`s; characters reference one by `scriptId`. Built-in scripts
// are read-only (refuse edit/delete); players duplicate them into editable
// copies. All mutations validate nesting depth and persist immediately.
// ---------------------------------------------------------------------------

/** All scripts in the profile library. */
export function getScripts(): CharacterScript[] {
  return current.profile.scriptLibrary
}

/** A single library script by id, or undefined. */
export function getScript(id: string): CharacterScript | undefined {
  return current.profile.scriptLibrary.find((s) => s.id === id)
}

/**
 * Adds a new (player-authored) script to the library. Throws if the id already
 * exists or the script is flagged built-in. Validates nesting depth ≤ 2.
 */
export function createScript(script: CharacterScript): void {
  if (script.builtIn) throw new Error('Cannot create a built-in script')
  if (getScript(script.id)) throw new Error(`Script "${script.id}" already exists`)
  if (current.profile.scriptLibrary.length >= SCRIPT_LIBRARY_CAP) {
    throw new Error(`Script library is full (max ${SCRIPT_LIBRARY_CAP} scripts)`)
  }
  validateScriptDepth(script)
  mutate((profile) => {
    profile.scriptLibrary.push(script)
  })
}

/**
 * Replaces an existing library script. Refuses built-ins (S14). Validates
 * nesting depth. Live — a character using this script picks up changes next
 * turn (S15).
 */
export function updateScript(script: CharacterScript): void {
  if (script.builtIn) throw new Error('Cannot edit a built-in script')
  const existing = getScript(script.id)
  if (!existing) throw new Error(`Script "${script.id}" not found`)
  if (existing.builtIn) throw new Error('Cannot edit a built-in script')
  validateScriptDepth(script)
  mutate((profile) => {
    const i = profile.scriptLibrary.findIndex((s) => s.id === script.id)
    profile.scriptLibrary[i] = script
  })
}

/** Removes a script from the library. Refuses built-ins (S14). */
export function deleteScript(id: string): void {
  const existing = getScript(id)
  if (!existing) throw new Error(`Script "${id}" not found`)
  if (existing.builtIn) throw new Error('Cannot delete a built-in script')
  mutate((profile) => {
    profile.scriptLibrary = profile.scriptLibrary.filter((s) => s.id !== id)
    // Any character pointing at the deleted script falls back to Manual.
    for (const character of Object.values(profile.characters)) {
      if (character.scriptId === id) character.scriptId = undefined
    }
  })
}

/**
 * Duplicates a library script (built-in or player) into a new editable copy:
 * fresh id, `builtIn` cleared, name suffixed with " (copy)". The copy is added
 * to the library and returned (the caller can then assign it).
 */
export function duplicateScript(id: string): CharacterScript {
  const existing = getScript(id)
  if (!existing) throw new Error(`Script "${id}" not found`)
  if (current.profile.scriptLibrary.length >= SCRIPT_LIBRARY_CAP) {
    throw new Error(`Script library is full (max ${SCRIPT_LIBRARY_CAP} scripts)`)
  }
  const copy: CharacterScript = JSON.parse(JSON.stringify(existing))
  copy.id = uuid()
  copy.builtIn = false
  copy.name = `${existing.name} (copy)`
  copy.createdAt = Date.now()
  copy.updatedAt = Date.now()
  mutate((profile) => {
    profile.scriptLibrary.push(copy)
  })
  return copy
}

/**
 * Assigns a library script to a character (S12). `scriptId` undefined (or a
 * missing id) returns the character to Manual. Takes effect on the character's
 * next turn (S15).
 */
export function assignScript(characterId: string, scriptId: string | undefined): void {
  const character = current.profile.characters[characterId]
  if (!character) throw new Error(`Character not found: ${characterId}`)
  if (scriptId !== undefined && !getScript(scriptId)) {
    throw new Error(`Script "${scriptId}" not found`)
  }
  mutate((profile) => {
    profile.characters[characterId]!.scriptId = scriptId
    profile.characters[characterId]!.scriptMode = scriptId ? 'auto' : 'manual'
  })
}

/** Persists the per-character auto/manual toggle for script-based autobattle. */
export function setScriptMode(characterId: string, mode: 'auto' | 'manual'): void {
  const character = current.profile.characters[characterId]
  if (!character) throw new Error(`Character not found: ${characterId}`)
  mutate((profile) => {
    profile.characters[characterId]!.scriptMode = mode
  })
}

/**
 * Updates the auto-advance stop points (Phase 4 M4, A9). Each flag defaults on;
 * party wipe and run end are always hard stops and are not part of this config.
 * Persisted per profile via `mutate`.
 */
export function setAutoStop(
  stops: { boss?: boolean; elite?: boolean; permadeath?: boolean; rest?: boolean },
): void {
  mutate((profile) => {
    const s = profile.autobattle.stops
    if (stops.boss !== undefined) s.boss = stops.boss
    if (stops.elite !== undefined) s.elite = stops.elite
    if (stops.permadeath !== undefined) s.permadeath = stops.permadeath
    if (stops.rest !== undefined) s.rest = stops.rest
  })
}

/**
 * Sets how long the victory/result notice lingers on screen during auto-advance
 * (Phase 4 M4). 0 = skip instantly; persisted per profile via `mutate`.
 */
export function setResultDelay(ms: number): void {
  mutate((profile) => {
    if (!profile.autobattle) profile.autobattle = { ...AUTOBATTLE_DEFAULTS }
    profile.autobattle.resultDelayMs = ms
  })
}

/** Wraps run-end bookkeeping shared by victory / wipe / abandon. */
function onRunEnd(stats: { won: boolean; lost: boolean }): void {
  tickDurability(current.profile)
  const s = current.profile.stats
  s.totalRuns += 1
  if (stats.won) s.wins += 1
  if (stats.lost) s.losses += 1
  // Phase 3 M7: the shop's rotating stock and the recruitment offers
  // regenerate after every run completion (decisions S10/S6).
  // Phase 5: Uses the profile's homeTown for town-aware refresh.
  const townId = current.profile.homeTown ?? 'aldwyn'
  const rng = createRng(Date.now() + s.totalRuns)
  refreshShopStock(current.profile, rng, townId)
  refreshRecruitment(current.profile, rng, townId)
}

function profileStats(status: 'won' | 'lost' | 'abandoned'): { won: boolean; lost: boolean } {
  return { won: status === 'won', lost: status !== 'won' }
}

/**
 * Uses an item from the run map between battles. Tomes teach their skill
 * permanently and are consumed; battle-only items (potions, scrolls) are
 * rejected — the map has no HP/MP state to heal (data-model §4).
 */
export function useItemOutOfBattle(characterId: string, itemId: string): ItemUseResult {
  const item = getItem(itemId)
  const character = current.profile.characters[characterId]
  if (!character) return { ok: false, error: 'Character not found' }

  if (item.type === 'tome') {
    const result = applyTome(characterId, itemId)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true }
  }

  if (item.type === 'stat-shot') {
    const result = applyStatShot(characterId, itemId)
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true }
  }

  if (item.type === 'consumable' || item.type === 'scroll') {
    return { ok: false, error: `${item.name} is used in battle, not on the map` }
  }

  return { ok: false, error: `${item.name} cannot be used here` }
}

export interface ApplyItemResult {
  ok: boolean
  error?: string
  /** Tomes: true when the skill was already known (item refused, not consumed). */
  alreadyKnown?: boolean
}

/**
 * Phase 4.5.1 (I1/I3/I4): applies a stat-shot to a character permanently. The
 * bonus is written to `Character.statBonus` and persists; the item is consumed.
 */
export function applyStatShot(characterId: string, itemId: string, qty = 1): ApplyItemResult {
  const item = getItem(itemId)
  const character = current.profile.characters[characterId]
  if (!character) return { ok: false, error: 'Character not found' }
  if (item.type !== 'stat-shot' || !item.boostStat) {
    return { ok: false, error: `${item.name} is not a stat-shot` }
  }
  const count = Math.max(1, Math.floor(qty))
  for (let i = 0; i < count; i++) {
    coreApplyStatShot(character, item)
  }
  removeItem(current.profile, itemId, count)
  saveProfile(current)
  notify()
  return { ok: true }
}

/**
 * Phase 4.5.1 (I1/I5): teaches a tome's skill to a character permanently. Refuses
 * (no consume) when already known. On success the skill is added to both
 * `learnedSkills` and `loadout`.
 */
export function applyTome(characterId: string, itemId: string): ApplyItemResult {
  const item = getItem(itemId)
  const character = current.profile.characters[characterId]
  if (!character) return { ok: false, error: 'Character not found' }
  if (item.type !== 'tome' || !item.grantsSkill) {
    return { ok: false, error: `${item.name} is not a tome` }
  }
  const result = coreApplyTome(character, item)
  if (result.alreadyKnown) {
    return { ok: false, error: `${character.name} already knows ${getSkill(item.grantsSkill).name} (tomes are single-use)`, alreadyKnown: true }
  }
  removeItem(current.profile, itemId, 1)
  saveProfile(current)
  notify()
  return { ok: true }
}

/**
 * Levels up a character: deducts XP, increments level, and applies flask
 * assignments to the character's statBonus.
 */
export function levelUpCharacter(
  characterId: string,
  assignments: Partial<Record<string, number>>,
): ItemUseResult {
  const character = current.profile.characters[characterId]
  if (!character) return { ok: false, error: 'Character not found' }
  if (!canLevelUp(character)) {
    return { ok: false, error: `${character.name} needs ${xpToNext(character.level)} XP to level up (has ${character.xp})` }
  }
  // Validate assignments
  let total = 0
  for (const key of LEVEL_STATS) {
    total += assignments[key] ?? 0
  }
  if (total > 7) {
    return { ok: false, error: `Too many flasks assigned (max 7, got ${total})` }
  }
  mutate((p) => {
    const c = p.characters[characterId]
    if (!c) return
    p.characters[characterId] = applyLevelUp(c, assignments)
  })
  return { ok: true }
}

/**
 * Phase 4.5.1 (I6/I7): equips gear and revalidates the character's loadout so any
 * gear-granted skill appears, and removes entries no longer available.
 */
export function equipItem(characterId: string, gearId: string): ItemUseResult {
  const gear = findGearById(current.profile, gearId)
  const character = current.profile.characters[characterId]
  if (!character) return { ok: false, error: 'Character not found' }
  if (!gear) return { ok: false, error: 'Gear not found' }
  mutate((p) => {
    equipGear(p, characterId, gearId)
    validateLoadout(p.characters[characterId])
  })
  return { ok: true }
}

/**
 * Phase 4.5.1 (I7): unequips gear and revalidates the loadout so any skill the
 * gear granted is silently dropped (I7 — no error, just removed from loadout).
 */
export function unequipItem(characterId: string, slot: 'weapon' | 'armor'): ItemUseResult {
  const character = current.profile.characters[characterId]
  if (!character) return { ok: false, error: 'Character not found' }
  mutate((p) => {
    const removed = unequipSlot(p, characterId, slot)
    if (removed) validateLoadout(p.characters[characterId])
  })
  return { ok: true }
}

/** Test helper: clears in-memory state and listeners. */
export function resetStore(): void {
  current = undefined as unknown as SaveFile
  listeners = new Set()
}

// ---------------------------------------------------------------------------
// Profile management (Phase 5 - local profiles)
// ---------------------------------------------------------------------------

// Re-export profile management from save.service (available via @core)
// export { listProfiles, getActiveProfileId, setActiveProfileId, deleteProfile, exportProfile, importProfile, renameProfile, duplicateProfile, createProfile } from './save.service'

/** Switch to a different profile (reloads store). */
export function switchProfile(profileId: string): SaveFile {
  const save = loadProfile(profileId)
  if (!save) throw new Error(`Profile not found: ${profileId}`)
  current = save
  setActiveProfileId(profileId)
  seedMetaStock()
  notify()
  return current
}

// ---------------------------------------------------------------------------
// Town selection (Phase 5)
// ---------------------------------------------------------------------------

/** Sets the profile's home town and refreshes meta stock for the new town. */
export function setHomeTown(townId: string): void {
  if (!TOWNS[townId]) throw new Error(`Unknown town: ${townId}`)
  mutate((profile) => {
    profile.homeTown = townId
    // Reset seen flag so town select shows on next meta visit (optional)
    // profile.hasSeenTownSelect = false
  })
  // Immediately refresh shop/recruitment for the new town
  const rng = createRng(Date.now() + current.profile.stats.totalRuns + 2)
  refreshShopStock(current.profile, rng, townId)
  refreshRecruitment(current.profile, rng, townId)
  saveProfile(current)
  notify()
}

/** Marks the town selection screen as seen (tutorial flag). */
export function markTownSelectSeen(): void {
  mutate((profile) => {
    profile.hasSeenTownSelect = true
  })
}

/** Gets the current home town. */
export function getHomeTown(): string {
  return current.profile.homeTown ?? 'aldwyn'
}

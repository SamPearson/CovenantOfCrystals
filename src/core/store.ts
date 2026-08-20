/**
 * Lightweight store: holds the loaded SaveFile in memory, exposes actions
 * that mutate the profile and persist automatically, and notifies subscribers.
 * No external state library — decided in `docs/roadmap.md` (open q. #6).
 * Stage 2 swaps the persistence behind `save.service.ts` for a mock API.
 */

import type { SaveFile, PlayerProfile, ActiveRun, RunResult, PlayerAiPresetId } from './types'
import type { BattleResult } from './combat/types'
import { loadSave, writeSave, createNewSave } from './save.service'
import { ensureBoxCount } from './boxes'
import { seedStarterRoster } from './starter'
import { generateRun } from './runs/run-gen'
import { resolveBattleResult, resolveRestNode, tickDurability } from './runs/resolve'
import { removeItem } from './inventory'
import { getItem, getSkill } from './data'
import { refreshShopStock } from './shop/shop'
import { refreshRecruitment } from './shop/recruitment'
import { createRng } from './rng/rng'

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
  const existing = loadSave()
  if (existing) {
    current = existing
  } else {
    current = createNewSave()
    ensureBoxCount(current.profile)
    seedStarterRoster(current.profile)
    writeSave(current)
  }
  seedMetaStock()
  return current
}

/**
 * Phase 3 M7: seeds the shop's rotating stock and the recruitment offers on
 * first init so the meta tabs are populated before the first run. Fresh saves
 * (M4 core) start with empty rotating stock and offers; pre-M7 saves are the
 * same. After the first run completion `onRunEnd` regains control of both.
 */
function seedMetaStock(): void {
  const profile = current.profile
  const rotating = profile.shop.rotating
  const stockEmpty = rotating.gear.length === 0 && rotating.skills.length === 0
  const offersEmpty = profile.recruitment.length === 0
  if (!stockEmpty && !offersEmpty) return
  const rng = createRng(Date.now() + profile.stats.totalRuns + 1)
  if (stockEmpty) refreshShopStock(profile, rng)
  if (offersEmpty) refreshRecruitment(profile, rng)
  writeSave(current)
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
  writeSave(current)
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
 */
export function startRun(partyIds: string[], length: number, seed: number): ActiveRun {
  const run = generateRun(current.profile.profileId, partyIds, length, seed)
  current.activeRun = run
  writeSave(current)
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
  writeSave(current)
  notify()
  return result
}

/** Resolves a rest node (heal/MP restore, no-op in P3) + checkpoint. */
export function resolveRest(): void {
  const run = current.activeRun
  if (!run) throw new Error('No active run')
  resolveRestNode(run)
  writeSave(current)
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
  writeSave(current)
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
  writeSave(current)
  notify()
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
  const rng = createRng(Date.now() + s.totalRuns)
  refreshShopStock(current.profile, rng)
  refreshRecruitment(current.profile, rng)
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

  if (item.type === 'tome' && item.skill) {
    if (character.learnedSkills.includes(item.skill)) {
      return { ok: false, error: `${character.name} already knows ${getSkill(item.skill).name} (tomes are single-use)` }
    }
    character.learnedSkills.push(item.skill)
    character.loadout.push(item.skill)
    removeItem(current.profile, itemId, 1)
    writeSave(current)
    notify()
    return { ok: true }
  }

  if (item.type === 'consumable' || item.type === 'scroll') {
    return { ok: false, error: `${item.name} is used in battle, not on the map` }
  }

  return { ok: false, error: `${item.name} cannot be used here` }
}

/** Test helper: clears in-memory state and listeners. */
export function resetStore(): void {
  current = undefined as unknown as SaveFile
  listeners = new Set()
}

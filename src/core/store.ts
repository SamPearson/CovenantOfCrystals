/**
 * Lightweight store: holds the loaded SaveFile in memory, exposes actions
 * that mutate the profile and persist automatically, and notifies subscribers.
 * No external state library — decided in `docs/roadmap.md` (open q. #6).
 * Stage 2 swaps the persistence behind `save.service.ts` for a mock API.
 */

import type { SaveFile, PlayerProfile } from './types'
import { loadSave, writeSave, createNewSave } from './save.service'
import { ensureBoxCount } from './boxes'
import { seedStarterRoster } from './starter'

type Listener = () => void

let current: SaveFile
let listeners = new Set<Listener>()

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
  return current
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
  for (const listener of listeners) listener()
}

/** Test helper: clears in-memory state and listeners. */
export function resetStore(): void {
  current = undefined as unknown as SaveFile
  listeners = new Set()
}

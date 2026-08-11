/**
 * Box operations (the roster storage: 10 boxes × 30 slots — see
 * `docs/metagame.md` §2 and `docs/data-model.md` §4).
 * All functions mutate and return the profile.
 */

import type { PlayerProfile, Box } from './types'
import { BOX_COUNT, BOX_SIZE } from './types'
import { uuid } from './id'

export function createBox(name = 'Box'): Box {
  return { id: uuid(), name, slots: new Array(BOX_SIZE).fill(null) }
}

/** Guarantees `BOX_COUNT` boxes exist (pads with empty boxes if needed). */
export function ensureBoxCount(profile: PlayerProfile): PlayerProfile {
  while (profile.boxes.length < BOX_COUNT) {
    profile.boxes.push(createBox(`Box ${profile.boxes.length + 1}`))
  }
  return profile
}

export function findCharacterBox(
  profile: PlayerProfile,
  characterId: string,
): { boxIndex: number; slotIndex: number } | null {
  for (let boxIndex = 0; boxIndex < profile.boxes.length; boxIndex++) {
    const slotIndex = profile.boxes[boxIndex]!.slots.indexOf(characterId)
    if (slotIndex !== -1) return { boxIndex, slotIndex }
  }
  return null
}

export function isInBox(profile: PlayerProfile, characterId: string): boolean {
  return findCharacterBox(profile, characterId) !== null
}

/** Adds a character to the first free slot of `boxIndex`. */
export function addCharacterToBox(
  profile: PlayerProfile,
  boxIndex: number,
  characterId: string,
): boolean {
  if (boxIndex < 0 || boxIndex >= profile.boxes.length) {
    throw new Error(`Box index out of range: ${boxIndex}`)
  }
  if (isInBox(profile, characterId)) throw new Error(`Character already in a box: ${characterId}`)
  if (!profile.characters[characterId]) throw new Error(`Unknown character: ${characterId}`)

  const box = profile.boxes[boxIndex]!
  const slotIndex = box.slots.indexOf(null)
  if (slotIndex === -1) return false // box full
  box.slots[slotIndex] = characterId
  return true
}

/** Removes the character at a slot; returns its id (or null if empty). */
export function removeCharacterFromSlot(
  profile: PlayerProfile,
  boxIndex: number,
  slotIndex: number,
): string | null {
  const box = profile.boxes[boxIndex]
  if (!box) throw new Error(`Box index out of range: ${boxIndex}`)
  const id = box.slots[slotIndex]
  if (id !== null && id !== undefined) box.slots[slotIndex] = null
  return id ?? null
}

/** Moves a character between two box slots (returns false if the target is taken). */
export function moveCharacter(
  profile: PlayerProfile,
  fromBox: number,
  fromSlot: number,
  toBox: number,
  toSlot: number,
): boolean {
  const src = profile.boxes[fromBox]
  const dst = profile.boxes[toBox]
  if (!src || !dst) throw new Error('Box index out of range')
  const id = src.slots[fromSlot]
  if (id === null || id === undefined) return false
  if (dst.slots[toSlot] !== null && dst.slots[toSlot] !== undefined) return false
  src.slots[fromSlot] = null
  dst.slots[toSlot] = id
  return true
}

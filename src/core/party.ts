/**
 * Party operations. The party is the 4-character squad committed to the next
 * run (see `docs/metagame.md` §3, `docs/combat.md` §1).
 * Members move between boxes and the party; all functions mutate the profile.
 */

import type { PlayerProfile } from './types'
import { PARTY_SIZE } from './types'
import { findCharacterBox, ensureBoxCount } from './boxes'

export function partySize(profile: PlayerProfile): number {
  return profile.party.length
}

export function isPartyFull(profile: PlayerProfile): boolean {
  return profile.party.length >= PARTY_SIZE
}

export function isInParty(profile: PlayerProfile, characterId: string): boolean {
  return profile.party.includes(characterId)
}

/** Picks a character from a box and commits it to the party. */
export function addToParty(profile: PlayerProfile, characterId: string): PlayerProfile {
  if (isPartyFull(profile)) throw new Error(`Party is full (max ${PARTY_SIZE})`)
  if (isInParty(profile, characterId)) throw new Error(`Already in party: ${characterId}`)
  if (!profile.characters[characterId]) throw new Error(`Unknown character: ${characterId}`)

  const boxLoc = findCharacterBox(profile, characterId)
  if (!boxLoc) throw new Error(`Character is not in a box: ${characterId}`)
  removeCharacterFromSlotAt(profile, boxLoc.boxIndex, boxLoc.slotIndex)

  profile.party.push(characterId)
  return profile
}

/** Returns a character from the party to the first free box slot. */
export function removeFromParty(profile: PlayerProfile, characterId: string): PlayerProfile {
  const idx = profile.party.indexOf(characterId)
  if (idx === -1) throw new Error(`Not in party: ${characterId}`)
  profile.party.splice(idx, 1)

  ensureBoxCount(profile)
  for (let boxIndex = 0; boxIndex < profile.boxes.length; boxIndex++) {
    const box = profile.boxes[boxIndex]!
    const slotIndex = box.slots.indexOf(null)
    if (slotIndex !== -1) {
      box.slots[slotIndex] = characterId
      return profile
    }
  }
  throw new Error('All boxes are full — no space to return the character')
}

function removeCharacterFromSlotAt(profile: PlayerProfile, boxIndex: number, slotIndex: number): void {
  profile.boxes[boxIndex]!.slots[slotIndex] = null
}

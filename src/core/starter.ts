/**
 * Starter roster for a fresh profile. Seeds a few characters and gear so the
 * meta UI has something to show before recruitment exists (Phase 5).
 * Only applied when the profile has no characters yet.
 */

import type { PlayerProfile } from './types'
import { createCharacter } from './character'
import { ensureBoxCount, addCharacterToBox } from './boxes'
import { createGearInstance, addGear, addItem } from './inventory'
import { createRng, hashString } from './rng/rng'

const STARTER_CLASSES = ['knight', 'berserker', 'rogue', 'mage', 'healer'] as const

const STARTER_GEAR = [
  'iron_sword',
  'steel_sword',
  'mage_staff',
  'leather_armor',
  'chain_mail',
] as const

export function seedStarterRoster(profile: PlayerProfile): PlayerProfile {
  if (Object.keys(profile.characters).length > 0) return profile

  ensureBoxCount(profile)
  const rng = createRng(hashString(profile.profileId))

  for (const classId of STARTER_CLASSES) {
    const c = createCharacter({ classId, rng })
    profile.characters[c.id] = c
    addCharacterToBox(profile, 0, c.id)
  }

  for (const itemId of STARTER_GEAR) {
    addGear(profile, createGearInstance(itemId, { kind: 'permanent' }))
  }
  addItem(profile, 'health_potion', 3)

  return profile
}

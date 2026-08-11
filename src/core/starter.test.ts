import { describe, expect, it } from 'vitest'
import { createNewSave } from './save.service'
import { seedStarterRoster } from './starter'
import { ensureBoxCount, findCharacterBox } from './boxes'
import type { PlayerProfile } from './types'

function emptyProfile(profileId = 'prof-1'): PlayerProfile {
  const save = createNewSave(profileId)
  ensureBoxCount(save.profile)
  return save.profile
}

describe('seedStarterRoster', () => {
  it('seeds characters, gear, and potions into a fresh profile', () => {
    const p = emptyProfile()
    seedStarterRoster(p)
    expect(Object.keys(p.characters).length).toBe(5)
    expect(p.inventory.gear.length).toBe(5)
    expect(p.inventory.items.find((i) => i.itemId === 'health_potion')?.count).toBe(3)
  })

  it('places all starter characters into a box', () => {
    const p = emptyProfile()
    seedStarterRoster(p)
    for (const id of Object.keys(p.characters)) {
      expect(findCharacterBox(p, id)).not.toBeNull()
    }
  })

  it('is idempotent — does not re-seed an existing roster', () => {
    const p = emptyProfile()
    seedStarterRoster(p)
    seedStarterRoster(p)
    expect(Object.keys(p.characters).length).toBe(5)
  })

  it('is deterministic for a fixed profile id', () => {
    const a = emptyProfile('prof-abc')
    const b = emptyProfile('prof-abc')
    seedStarterRoster(a)
    seedStarterRoster(b)
    const summarize = (p: PlayerProfile) =>
      Object.values(p.characters)
        .map((c) => `${c.classId}:${c.name}`)
        .sort()
    expect(summarize(a)).toEqual(summarize(b))
  })
})

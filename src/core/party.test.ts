import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import { addToParty, removeFromParty, isInParty, isPartyFull, partySize } from './party'
import { addCharacterToBox, ensureBoxCount } from './boxes'
import { PARTY_SIZE } from './types'
import { createRng } from './rng/rng'
import type { PlayerProfile } from './types'

function makeProfile(): PlayerProfile {
  return {
    profileId: 'p1',
    displayName: 'Player',
    gold: 0,
    unlockedClasses: ['knight'],
    characters: {},
    boxes: [],
    inventory: { items: [], gear: [] },
    party: [],
    stats: { totalRuns: 0, wins: 0, losses: 0 },
    shop: { always: [], rotating: { gear: [], skills: [] } },
    recruitment: [],
    createdAt: 0,
  }
}

const rng = createRng(11)

function addCharacter(p: PlayerProfile, box = 0): string {
  const c = createCharacter({ classId: 'knight', rng })
  p.characters[c.id] = c
  addCharacterToBox(p, box, c.id)
  return c.id
}

describe('addToParty', () => {
  it('moves a character from its box into the party', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const id = addCharacter(p)
    addToParty(p, id)
    expect(isInParty(p, id)).toBe(true)
    expect(partySize(p)).toBe(1)
  })

  it('rejects characters that are not in a box', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    expect(() => addToParty(p, c.id)).toThrow(/not in a box/)
  })

  it('rejects duplicates and unknown characters', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const id = addCharacter(p)
    addToParty(p, id)
    expect(() => addToParty(p, id)).toThrow(/Already in party/)
    expect(() => addToParty(p, 'ghost')).toThrow(/Unknown character/)
  })

  it('enforces the party size cap', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    for (let i = 0; i < PARTY_SIZE; i++) addToParty(p, addCharacter(p))
    expect(isPartyFull(p)).toBe(true)
    expect(() => addToParty(p, addCharacter(p))).toThrow(/Party is full/)
  })
})

describe('removeFromParty', () => {
  it('returns a character to the first free box slot', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const id = addCharacter(p, 0)
    addToParty(p, id)
    removeFromParty(p, id)
    expect(isInParty(p, id)).toBe(false)
    expect(p.boxes[0]!.slots[0]).toBe(id)
  })

  it('throws for characters not in the party', () => {
    const p = makeProfile()
    expect(() => removeFromParty(p, 'nobody')).toThrow(/Not in party/)
  })
})

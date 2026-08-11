import { describe, expect, it } from 'vitest'
import { createCharacter } from './character'
import {
  createBox,
  ensureBoxCount,
  findCharacterBox,
  addCharacterToBox,
  removeCharacterFromSlot,
  moveCharacter,
} from './boxes'
import { BOX_COUNT, BOX_SIZE } from './types'
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
    createdAt: 0,
  }
}

const rng = createRng(7)

describe('createBox / ensureBoxCount', () => {
  it('creates a box with BOX_SIZE empty slots', () => {
    const box = createBox('A')
    expect(box.slots).toHaveLength(BOX_SIZE)
    expect(box.slots.every((s) => s === null)).toBe(true)
  })

  it('pads a profile up to BOX_COUNT boxes', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    expect(p.boxes).toHaveLength(BOX_COUNT)
  })
})

describe('addCharacterToBox', () => {
  it('adds a character to the first free slot', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    expect(addCharacterToBox(p, 0, c.id)).toBe(true)
    expect(findCharacterBox(p, c.id)).toEqual({ boxIndex: 0, slotIndex: 0 })
  })

  it('returns false when the box is full', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const full = createBox('full')
    full.slots = new Array(BOX_SIZE).fill('occupied')
    p.boxes[0] = full
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    expect(addCharacterToBox(p, 0, c.id)).toBe(false)
  })

  it('rejects characters already in a box', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    addCharacterToBox(p, 0, c.id)
    expect(() => addCharacterToBox(p, 1, c.id)).toThrow(/already in a box/)
  })
})

describe('moveCharacter / removeCharacterFromSlot', () => {
  it('moves a character between boxes', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    addCharacterToBox(p, 0, c.id)
    expect(moveCharacter(p, 0, 0, 1, 3)).toBe(true)
    expect(findCharacterBox(p, c.id)).toEqual({ boxIndex: 1, slotIndex: 3 })
  })

  it('refuses to move onto an occupied slot', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const a = createCharacter({ classId: 'knight', rng })
    const b = createCharacter({ classId: 'knight', rng })
    p.characters[a.id] = a
    p.characters[b.id] = b
    addCharacterToBox(p, 0, a.id)
    addCharacterToBox(p, 0, b.id)
    expect(moveCharacter(p, 0, 0, 0, 1)).toBe(false)
  })

  it('removes a character by slot and returns its id', () => {
    const p = makeProfile()
    ensureBoxCount(p)
    const c = createCharacter({ classId: 'knight', rng })
    p.characters[c.id] = c
    addCharacterToBox(p, 0, c.id)
    expect(removeCharacterFromSlot(p, 0, 0)).toBe(c.id)
    expect(findCharacterBox(p, c.id)).toBeNull()
  })
})

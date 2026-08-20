import { describe, expect, it } from 'vitest'
import { scriptedSquad, partyForBattle } from './battle-setup'
import { PARTY_SIZE } from '../../core/types'
import type { PlayerProfile } from '../../core/types'

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
    autobattle: { speed: 1, skipAnimations: false, stops: { boss: true, elite: true, permadeath: true, rest: true } },
    stats: { totalRuns: 0, wins: 0, losses: 0 },
    shop: { always: [], rotating: { gear: [], skills: [] } },
    recruitment: [],
    createdAt: 0,
  }
}

describe('scriptedSquad', () => {
  it('returns the fixed M5 squad (2 slimes + 1 goblin)', () => {
    const squad = scriptedSquad()
    expect(squad).toHaveLength(3)
    expect(squad.map((e) => e.id)).toEqual(['slime', 'slime', 'goblin'])
  })

  it('returns defs with usable stats for the engine', () => {
    const [slime, , goblin] = scriptedSquad()
    expect(slime!.stats.hp).toBeGreaterThan(0)
    expect(goblin!.stats.atk).toBeGreaterThan(0)
  })
})

describe('partyForBattle', () => {
  it('prefers the profile party when present', () => {
    const p = makeProfile()
    const a = { id: 'a', classId: 'knight', name: 'A' }
    const b = { id: 'b', classId: 'rogue', name: 'B' } as unknown as PlayerProfile['characters'][string]
    p.characters.a = a as PlayerProfile['characters'][string]
    p.characters.b = b
    p.party = ['a', 'b']
    const got = partyForBattle(p)
    expect(got.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('falls back to the first PARTY_SIZE boxed characters when both party and... party is empty', () => {
    const p = makeProfile()
    const knight = {
      id: 'k',
      classId: 'knight',
      name: 'K',
    } as unknown as PlayerProfile['characters'][string]
    const rogue = {
      id: 'r',
      classId: 'rogue',
      name: 'R',
    } as unknown as PlayerProfile['characters'][string]
    p.characters.k = knight
    p.characters.r = rogue
    p.boxes = [
      { id: 'box1', name: 'Box', slots: ['k', null, 'r', null, null] },
    ]
    const got = partyForBattle(p)
    expect(got.map((c) => c.id)).toEqual(['k', 'r'])
  })

  it('caps the roster fallback at PARTY_SIZE', () => {
    const p = makeProfile()
    for (let i = 0; i < PARTY_SIZE + 2; i++) {
      const c = { id: `c${i}`, classId: 'knight', name: `C${i}` } as unknown as PlayerProfile['characters'][string]
      p.characters[`c${i}`] = c
    }
    p.boxes = [
      { id: 'box1', name: 'Box', slots: Array.from({ length: PARTY_SIZE + 2 }, (_, i) => `c${i}`) },
    ]
    expect(partyForBattle(p)).toHaveLength(PARTY_SIZE)
  })

  it('returns an empty array when there is no party and no boxed characters', () => {
    expect(partyForBattle(makeProfile())).toEqual([])
  })
})
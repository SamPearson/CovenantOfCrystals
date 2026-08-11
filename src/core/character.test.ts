import { describe, expect, it } from 'vitest'
import { createCharacter, generateName, derivedStats } from './character'
import { createGearInstance } from './inventory'
import { createRng } from './rng/rng'
import { getClass } from './data'

const rng = createRng(12345)

describe('createCharacter', () => {
  it('creates a level 1 character with starter skills', () => {
    const c = createCharacter({ classId: 'knight', rng })
    expect(c.level).toBe(1)
    expect(c.learnedSkills).toContain('slashing_strike')
    expect(c.learnedSkills).not.toContain('shield_bash')
    expect(c.loadout.length).toBeGreaterThan(0)
    expect(c.durability).toEqual({ kind: 'permanent' })
    expect(c.earned).toEqual({ runs: 0, wins: 0 })
  })

  it('learns skills from the class learn set at higher levels', () => {
    const c = createCharacter({ classId: 'knight', level: 3, rng })
    expect(c.learnedSkills).toContain('shield_bash')
    expect(c.loadout.length).toBe(2) // level 1 + 3 skills only
  })

  it('throws on an unknown class id', () => {
    expect(() => createCharacter({ classId: 'nope', rng })).toThrow(/Unknown class/)
  })

  it('respects a player-supplied name', () => {
    const c = createCharacter({ classId: 'mage', name: 'Kaelen', rng })
    expect(c.name).toBe('Kaelen')
  })
})

describe('generateName', () => {
  it('generates names deterministically for a fixed seed', () => {
    const a = generateName(createRng(99))
    const b = generateName(createRng(99))
    expect(a).toBe(b)
  })
})

describe('derivedStats', () => {
  it('applies class growth per level', () => {
    const c = createCharacter({ classId: 'knight', level: 3, rng })
    const stats = derivedStats(c)
    const cls = getClass('knight')
    expect(stats.hp).toBe(cls.baseStats.hp + cls.growth.hp * 2)
    expect(stats.def).toBe(cls.baseStats.def + cls.growth.def * 2)
  })

  it('adds gear stat bonuses on top of base stats', () => {
    const c = createCharacter({ classId: 'knight', level: 1, rng })
    const before = derivedStats(c)
    c.gear.weapon = createGearInstance('iron_sword', { kind: 'permanent' })
    const after = derivedStats(c)
    expect(after.atk).toBe(before.atk + 10)
  })

  it('ignores durability when deriving stats', () => {
    const c = createCharacter({ classId: 'knight', level: 1, rng })
    c.gear.armor = createGearInstance('leather_armor', { kind: 'expires', runsRemaining: 2 })
    expect(derivedStats(c).def).toBe(getClass('knight').baseStats.def + 6)
  })
})

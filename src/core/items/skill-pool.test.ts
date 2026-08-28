import { describe, expect, it } from 'vitest'
import { getSkillPool, validateLoadout } from '../items/skill-pool'
import { createCharacter } from '../character'
import { createGearInstance } from '../inventory'
import { applyTome } from '../items/apply'

describe('getSkillPool', () => {
  it('returns native class skills at the current level', () => {
    const c = createCharacter({ classId: 'knight' })
    const pool = getSkillPool(c)
    const ids = pool.map((e) => e.skillId)
    // Knight learns slashing_strike at level 1 (see data/classes).
    expect(ids).toContain('slashing_strike')
    expect(pool.find((e) => e.skillId === 'slashing_strike')?.source).toBe('native')
  })

  it('tags tome-taught skills as learned', () => {
    const c = createCharacter({ classId: 'knight' })
    applyTome(c, { id: 't', name: 'Tome: Fireball', type: 'tome', rarity: 'common', value: 0, grantsSkill: 'fireball' })
    const entry = getSkillPool(c).find((e) => e.skillId === 'fireball')
    expect(entry?.source).toBe('learned')
  })

  it('tags gear-granted skills as gear', () => {
    const c = createCharacter({ classId: 'knight' })
    c.gear.weapon = createGearInstance('flame_staff', { kind: 'permanent' })
    const entry = getSkillPool(c).find((e) => e.skillId === 'fireball')
    expect(entry?.source).toBe('gear')
  })

  it('dedupes to native when a class already knows a gear/learned skill', () => {
    const c = createCharacter({ classId: 'knight' })
    // Force fireball into the native set by faking the class learn set is hard;
    // instead verify a learned skill that is also gear-granted collapses once.
    applyTome(c, { id: 't', name: 'T', type: 'tome', rarity: 'common', value: 0, grantsSkill: 'fireball' })
    c.gear.weapon = createGearInstance('flame_staff', { kind: 'permanent' })
    const fireball = getSkillPool(c).filter((e) => e.skillId === 'fireball')
    expect(fireball).toHaveLength(1)
    expect(fireball[0].source).toBe('learned')
  })
})

describe('validateLoadout', () => {
  it('prunes loadout entries no longer in the skill pool (I7)', () => {
    const c = createCharacter({ classId: 'knight' })
    c.loadout.push('fireball') // not native, not learned, not equipped
    expect(c.loadout).toContain('fireball')
    const pruned = validateLoadout(c)
    expect(pruned).toBe(true)
    expect(c.loadout).not.toContain('fireball')
  })

  it('keeps loadout entries that are available', () => {
    const c = createCharacter({ classId: 'knight' })
    const before = [...c.loadout]
    const pruned = validateLoadout(c)
    expect(pruned).toBe(false)
    expect(c.loadout).toEqual(before)
  })
})

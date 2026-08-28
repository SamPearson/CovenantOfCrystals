import { describe, expect, it } from 'vitest'
import { applyStatShot, applyTome } from '../items/apply'
import { createCharacter, baseStatsFor } from '../character'
import { getItem } from '../data'

describe('applyStatShot', () => {
  it('adds the boost to the character base stats permanently', () => {
    const c = createCharacter({ classId: 'knight' })
    const before = baseStatsFor(c).atk
    const shot = getItem('shot_atk_1')
    const result = applyStatShot(c, shot)
    expect(result.itemConsumed).toBe(true)
    expect(baseStatsFor(c).atk).toBe(before + 1)
    // Stat-shots flow into fully derived stats too.
    expect(c.statBonus?.atk).toBe(1)
  })

  it('clamps negatives to zero and rounds (defensive)', () => {
    const c = createCharacter({ classId: 'knight' })
    const hpBefore = baseStatsFor(c).hp
    applyStatShot(c, { id: 'x', name: 'bad', type: 'stat-shot', rarity: 'common', value: 0, boostStat: { stat: 'hp', amount: -5 } })
    expect(baseStatsFor(c).hp).toBe(hpBefore)
  })

  it('throws on a non-stat-shot item', () => {
    const c = createCharacter({ classId: 'knight' })
    expect(() => applyStatShot(c, getItem('health_potion'))).toThrow()
  })
})

describe('applyTome', () => {
  it('teaches the skill permanently to learnedSkills and loadout', () => {
    const c = createCharacter({ classId: 'knight' })
    const tome = getItem('tome_fireball')
    const result = applyTome(c, tome)
    expect(result.itemConsumed).toBe(true)
    expect(result.alreadyKnown).toBe(false)
    expect(c.learnedSkills).toContain('fireball')
    expect(c.loadout).toContain('fireball')
  })

  it('refuses (no consume) when the skill is already known', () => {
    const c = createCharacter({ classId: 'knight' })
    applyTome(c, getItem('tome_fireball'))
    const learnedCount = c.learnedSkills.length
    const result = applyTome(c, getItem('tome_fireball'))
    expect(result.alreadyKnown).toBe(true)
    expect(result.itemConsumed).toBe(false)
    expect(c.learnedSkills.length).toBe(learnedCount)
  })

  it('throws on a non-tome item', () => {
    const c = createCharacter({ classId: 'knight' })
    expect(() => applyTome(c, getItem('health_potion'))).toThrow()
  })
})

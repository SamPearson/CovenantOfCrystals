import { describe, expect, it } from 'vitest'
import { BALANCE, getEnemy } from '../data'
import { scaleEnemy } from './enemy-scale'

describe('enemy scaling', () => {
  const slime = getEnemy('slime')

  it('returns the base def unchanged at node index 0 with mult 1', () => {
    expect(scaleEnemy(slime, 0, 3, 1)).toEqual(slime)
  })

  it('scales stats, level, xp and gold up with node index', () => {
    const early = scaleEnemy(slime, 0, 5, 1)
    const late = scaleEnemy(slime, 4, 5, 1)
    expect(late.stats.hp).toBeGreaterThan(early.stats.hp)
    expect(late.stats.atk).toBeGreaterThan(early.stats.atk)
    expect(late.stats.def).toBeGreaterThan(early.stats.def)
    expect(late.stats.mag).toBeGreaterThan(early.stats.mag)
    expect(late.stats.res).toBeGreaterThan(early.stats.res)
    expect(late.stats.spd).toBeGreaterThan(early.stats.spd)
    expect(late.level).toBeGreaterThan(early.level)
    expect(late.xp).toBeGreaterThan(early.xp)
    expect(late.gold).toBeGreaterThan(early.gold)
  })

  it('elite beats a standard fight at the same node index', () => {
    const standard = scaleEnemy(slime, 2, 10, 1)
    const elite = scaleEnemy(slime, 2, 10, BALANCE.run.eliteMult)
    expect(elite.stats.hp).toBeGreaterThan(standard.stats.hp)
    expect(elite.xp).toBeGreaterThan(standard.xp)
    expect(elite.gold).toBeGreaterThan(standard.gold)
  })

  it('boss multiplier peaks above elite at the same node index', () => {
    const elite = scaleEnemy(slime, 4, 5, BALANCE.run.eliteMult)
    const boss = scaleEnemy(slime, 4, 5, BALANCE.run.bossMult)
    expect(boss.stats.hp).toBeGreaterThan(elite.stats.hp)
    expect(boss.stats.atk).toBeGreaterThan(elite.stats.atk)
    expect(boss.gold).toBeGreaterThan(elite.gold)
  })

  it('is deterministic for identical inputs', () => {
    expect(scaleEnemy(slime, 2, 5, BALANCE.run.eliteMult)).toEqual(
      scaleEnemy(slime, 2, 5, BALANCE.run.eliteMult),
    )
  })

  it('throws for out-of-range node indices', () => {
    expect(() => scaleEnemy(slime, -1, 5, 1)).toThrow(RangeError)
    expect(() => scaleEnemy(slime, 5, 5, 1)).toThrow(RangeError)
  })

  it('preserves the enemy identity and skills', () => {
    const scaled = scaleEnemy(slime, 1, 5, 1)
    expect(scaled.id).toBe(slime.id)
    expect(scaled.name).toBe(slime.name)
    expect(scaled.element).toBe(slime.element)
    expect(scaled.ai).toBe(slime.ai)
    expect(scaled.skills).toEqual(slime.skills)
  })

  it('uses the balance curve constants from data', () => {
    const at1 = scaleEnemy(slime, 1, 5, 1).stats.hp
    const at2 = scaleEnemy(slime, 2, 5, 1).stats.hp
    expect(at2).toBeGreaterThan(at1)
    expect(BALANCE.run.difficultyStep).toBeGreaterThan(1)
    expect(BALANCE.run.eliteMult).toBeGreaterThan(1)
    expect(BALANCE.run.bossMult).toBeGreaterThan(BALANCE.run.eliteMult)
  })
})
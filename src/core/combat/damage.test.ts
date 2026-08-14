import { describe, expect, it } from 'vitest'
import { BALANCE } from '../data/balance'
import type { Element } from '../types'
import {
  finalizeDamage,
  healMagic,
  hitCheck,
  itemHeal,
  magicalDamage,
  physicalDamage,
  rollCrit,
  varianceFactor,
} from './damage'
import type { Rng } from '../rng/rng'

/** A roll that yields variance exactly 1.0 (min + 0.5 × range). */
const VAR_ONE = 0.5

/** Fixed-sequence RNG so hit/crit rolls are deterministic in tests. */
function rngOf(values: number[]): Rng {
  return () => values.shift() ?? 0
}

describe('ratio damage (unclamped)', () => {
  it('physical = base × (ATK / DEF)', () => {
    expect(physicalDamage(30, 12, 8)).toBe(45)
    expect(physicalDamage(30, 10, 10)).toBe(30)
  })

  it('magical = base × (MAG / RES)', () => {
    expect(magicalDamage(45, 15, 10)).toBe(67.5)
    expect(magicalDamage(45, 10, 10)).toBe(45)
  })

  it('extreme mismatches are NOT clamped', () => {
    // 2.5× swing: huge or tiny hits are accepted (docs/combat.md §5).
    expect(physicalDamage(30, 20, 8)).toBe(75)
    expect(physicalDamage(30, 8, 20)).toBe(12)
    expect(physicalDamage(30, 100, 1)).toBe(3000)
    expect(physicalDamage(30, 1, 100)).toBe(0.3)
  })

  it('rejects non-finite or negative inputs', () => {
    expect(() => physicalDamage(-1, 10, 10)).toThrow(/base must be/)
    expect(() => physicalDamage(30, -1, 10)).toThrow(/atk must be/)
    expect(() => physicalDamage(30, 10, 0)).toThrow(/def must be/)
    expect(() => magicalDamage(45, 10, 0)).toThrow(/res must be/)
    expect(() => physicalDamage(30, NaN, 10)).toThrow(/atk must be/)
  })
})

describe('finalizeDamage (element × defend × variance × crit)', () => {
  it('no element, no crit, variance 1.0 → identity', () => {
    expect(finalizeDamage(45, { varianceRoll: VAR_ONE })).toBe(45)
  })

  it('damage is rounded to the nearest whole number', () => {
    // 45 × 1.1 (variance max) = 49.5 → rounds to 50
    expect(finalizeDamage(45, { varianceRoll: 1 })).toBe(50)
  })

  it('element multiplier applies (weak = 2×, resist = 0.5×)', () => {
    expect(finalizeDamage(45, { attackElement: 'fire', defendElement: 'frost', varianceRoll: VAR_ONE })).toBe(90)
    // 45 × 0.5 = 22.5 → rounds to 23
    expect(finalizeDamage(45, { attackElement: 'fire', defendElement: 'water', varianceRoll: VAR_ONE })).toBe(23)
  })

  it('every element chart pair resolves from the data table', () => {
    const cases: [Element, Element, number][] = [
      ['fire', 'frost', 2], ['water', 'fire', 2], ['frost', 'water', 2],
      ['earth', 'holy', 2], ['holy', 'shadow', 2], ['shadow', 'earth', 2],
      ['fire', 'water', 0.5], ['water', 'frost', 0.5], ['frost', 'fire', 0.5],
      ['earth', 'shadow', 0.5], ['holy', 'earth', 0.5], ['shadow', 'holy', 0.5],
      ['none', 'fire', 1], ['fire', 'none', 1], ['holy', 'holy', 1],
    ]
    for (const [atk, def, mult] of cases) {
      expect(finalizeDamage(10, { attackElement: atk, defendElement: def, varianceRoll: VAR_ONE })).toBe(10 * mult)
    }
  })

  it('defending halves damage', () => {
    // 45 × 0.5 = 22.5 → rounds to 23
    expect(finalizeDamage(45, { varianceRoll: VAR_ONE, defending: true })).toBe(23)
  })

  it('crit multiplies by BALANCE.critDamage (~1.5×)', () => {
    expect(finalizeDamage(45, { varianceRoll: VAR_ONE, crit: true })).toBe(Math.round(45 * BALANCE.critDamage))
  })

  it('variance stays inside [0.9, 1.1] incl. the roll endpoints', () => {
    expect(varianceFactor(0)).toBe(0.9)
    expect(varianceFactor(1)).toBe(1.1)
    expect(varianceFactor(0.5)).toBe(1)
    for (let i = 0; i <= 100; i++) {
      const v = varianceFactor(i / 100)
      expect(v).toBeGreaterThanOrEqual(0.9)
      expect(v).toBeLessThanOrEqual(1.1)
    }
  })

  it('ordering: element then defend then variance then crit', () => {
    // final = 45 × 2 (fire→frost) × 0.5 (defend) × 1.0 (variance) × 1.5 (crit)
    const dmg = finalizeDamage(45, {
      attackElement: 'fire',
      defendElement: 'frost',
      defending: true,
      varianceRoll: VAR_ONE,
      crit: true,
    })
    expect(dmg).toBe(Math.round(45 * 2 * 0.5 * 1 * BALANCE.critDamage))
  })
})

describe('hit roll (accuracy vs. dodge)', () => {
  it('hit check = accuracy × (1 − dodge)', () => {
    // threshold = 0.8 × (1 − 0.5) = 0.4
    expect(hitCheck(0.8, 0.5, rngOf([0.39]))).toBe(true)
    expect(hitCheck(0.8, 0.5, rngOf([0.4]))).toBe(false)
  })

  it('a dodge of 1 never hits; accuracy 1 with dodge 0 always hits', () => {
    expect(hitCheck(1, 1, rngOf([0.999]))).toBe(false)
    expect(hitCheck(1, 0, rngOf([0.999]))).toBe(true)
  })

  it('blind halves the attacker accuracy before the roll', () => {
    // blind → accuracy 1.0 becomes 0.5; dodge 0 → threshold 0.5
    const effective = 0.5
    expect(hitCheck(effective, 0, rngOf([0.49]))).toBe(true)
    expect(hitCheck(effective, 0, rngOf([0.5]))).toBe(false)
  })

  it('a miss deals 0 (roll gates the multiplicative pipeline)', () => {
    const hit = hitCheck(0.5, 0, rngOf([0.6]))
    const dmg = hit ? finalizeDamage(45, { varianceRoll: VAR_ONE }) : 0
    expect(hit).toBe(false)
    expect(dmg).toBe(0)
  })

  it('rejects negative accuracy / dodge', () => {
    expect(() => hitCheck(-0.1, 0, rngOf([0.5]))).toThrow(/accuracy must be/)
    expect(() => hitCheck(1, -0.1, rngOf([0.5]))).toThrow(/dodge must be/)
  })
})

describe('crit roll', () => {
  it('rolls below the rate crit', () => {
    expect(rollCrit(rngOf([0.04]), 0.05)).toBe(true)
    expect(rollCrit(rngOf([0.05]), 0.05)).toBe(false)
  })

  it('defaults to BALANCE.critRate', () => {
    expect(rollCrit(rngOf([BALANCE.critRate - 0.001]))).toBe(true)
  })
})

describe('healing', () => {
  it('magic heal = basePower × (MAG / MAG_REF)', () => {
    expect(healMagic(60, 20)).toBe(60) // MAG == MAG_REF
    expect(healMagic(60, 40)).toBe(120)
    expect(healMagic(120, 10)).toBe(60)
    expect(healMagic(60, 20, 40)).toBe(30) // explicit MAG_REF
    expect(healMagic(50, 15)).toBe(38) // 37.5 → rounds to 38
  })

  it('item heal is flat — no scaling', () => {
    expect(itemHeal(25)).toBe(25)
    expect(itemHeal(60)).toBe(60)
  })

  it('healing has no RES input — RES is magic defense only', () => {
    // The heal formula reads power, MAG and MAG_REF only (`docs/combat.md` §5).
    expect(healMagic(60, 20)).toBe(60)
  })

  it('rejects negative / zero inputs', () => {
    expect(() => healMagic(-1, 20)).toThrow(/power must be/)
    expect(() => healMagic(60, -5)).toThrow(/mag must be/)
    expect(() => healMagic(60, 20, 0)).toThrow(/magRef must be/)
    expect(() => itemHeal(-1)).toThrow(/flat must be/)
  })
})
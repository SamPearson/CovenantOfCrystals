import { describe, expect, it } from 'vitest'
import {
  chance,
  createRng,
  hashString,
  intBetween,
  pick,
  shuffle,
} from './rng'

const SEED_A = 12345
const SEED_B = 54321

// Reference values locked from the current mulberry32 implementation. If
// these change, the run-reproducibility guarantee is broken — update
// deliberately.
const SEED_A_FIRST_5 = [
  0.979728267761,
  0.3067522645,
  0.484205421526,
  0.817934412509,
  0.509428369347,
]

describe('createRng', () => {
  it('produces floats in [0, 1)', () => {
    const rng = createRng(SEED_A)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is reproducible for the same seed (reference sequence)', () => {
    const rng = createRng(SEED_A)
    for (const expected of SEED_A_FIRST_5) {
      expect(rng()).toBeCloseTo(expected, 9)
    }
  })

  it('produces the same sequence for the same seed', () => {
    const a = createRng(SEED_A)
    const b = createRng(SEED_A)
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b())
    }
  })

  it('produces a different sequence for a different seed', () => {
    const a = createRng(SEED_A)
    const b = createRng(SEED_B)
    let differs = false
    for (let i = 0; i < 100; i++) {
      if (a() !== b()) {
        differs = true
        break
      }
    }
    expect(differs).toBe(true)
  })
})

describe('intBetween', () => {
  it('stays within the inclusive range', () => {
    const rng = createRng(SEED_A)
    for (let i = 0; i < 500; i++) {
      const v = intBetween(rng, 3, 10)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(10)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('returns the min when min === max', () => {
    expect(intBetween(createRng(SEED_A), 7, 7)).toBe(7)
  })
})

describe('pick', () => {
  it('always returns an element from the array', () => {
    const items = ['a', 'b', 'c', 'd']
    const rng = createRng(SEED_A)
    for (let i = 0; i < 200; i++) {
      expect(items).toContain(pick(rng, items))
    }
  })
})

describe('shuffle', () => {
  it('preserves all elements', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const rng = createRng(SEED_A)
    for (let i = 0; i < 50; i++) {
      const result = shuffle(rng, items)
      expect(result).toHaveLength(items.length)
      expect([...result].sort((x, y) => x - y)).toEqual([...items].sort((x, y) => x - y))
    }
  })

  it('does not mutate the input array', () => {
    const items = [1, 2, 3, 4]
    shuffle(createRng(SEED_A), items)
    expect(items).toEqual([1, 2, 3, 4])
  })
})

describe('chance', () => {
  it('returns true for probability 1 and false for 0', () => {
    expect(chance(createRng(SEED_A), 1)).toBe(true)
    expect(chance(createRng(SEED_A), 0)).toBe(false)
  })
})

describe('hashString', () => {
  it('is deterministic for the same input', () => {
    expect(hashString('run-abc')).toBe(hashString('run-abc'))
  })

  it('produces a 32-bit unsigned integer', () => {
    const h = hashString('any-string')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(2 ** 32)
  })
})

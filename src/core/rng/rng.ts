/**
 * Seeded PRNG (mulberry32) — the single source of randomness for run
 * generation and any other reproducible game logic.
 *
 * Same seed ⇒ same sequence, so runs are reproducible/replayable
 * (see `docs/runs-and-gauntlet.md` §4).
 */

export type Rng = () => number

/** Creates a seeded PRNG returning floats in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return function rng(): number {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random integer in [min, max], inclusive. */
export function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Random element of a non-empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

/** Fisher–Yates shuffle returning a new array (input is not mutated). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = result[i]!
    result[i] = result[j]!
    result[j] = tmp
  }
  return result
}

/** Returns true with the given probability. */
export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability
}

/** Deterministic 32-bit hash so string seeds (e.g. run IDs) become numbers. */
export function hashString(input: string): number {
  let h = 1779033703 ^ input.length
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  h ^= h >>> 16
  return h >>> 0
}

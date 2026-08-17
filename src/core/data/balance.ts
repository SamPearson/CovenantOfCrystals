/**
 * Balance constants (`docs/combat.md` §5, Phase 2 plan §6). All values are
 * placeholder stubs — the Phase 5 data pass tunes them. Code reads tuning
 * numbers from here; it never hardcodes them.
 */

import type { Rarity } from '../types'

export interface RunBalanceConfig {
  /** Per-node difficulty step: enemy scale multiplies by this per step. */
  difficultyStep: number
  /** Elite node scaling multiplier. */
  eliteMult: number
  /** Boss node scaling multiplier. */
  bossMult: number
  /**
   * Length-aware boss multiplier overrides, keyed by run length. Shorter runs
   * can't survive the full exponential — a 3-battle run needs a level 7–10
   * boss, not the level ~17 the flat `bossMult` produces. Lengths without an
   * entry fall back to `bossMult`.
   */
  bossMultByLength?: Record<number, number>
  /** A rest node appears at every Nth step (0 = never). */
  restCadence: number
  /** Base gold per battle, before variance. */
  baseGold: number
  /** Gold variance range (seeded roll). */
  goldVariance: [number, number]
  /** Per-battle drop chance (0..1). */
  dropChance: number
  /** Drop pool weights per item type (relative). */
  dropWeights: { gear: number; consumable: number; skillItem: number }
  /** Fraction of run gold/drops banked at resolution, per end state (M3). */
  runPayout: { won: number; lost: number; abandoned: number }
}

export interface EconomyConfig {
  /** Gold granted to a brand-new profile (M4). */
  startingGold: number
  /** Fraction of item value returned when selling. */
  sellRatio: number
  /** Flat gold price of a recruitment offer (decision S6). */
  recruitPrice: number
  /** Rotating stock sizes per refresh (decision S10). */
  rotatingGear: number
  rotatingSkillItems: number
  /** Scroll price tier table (stub power curve, see ./skill-items). */
  skillItemPrice: Record<Rarity, number>
  /** Tomes cost this multiple of a scroll's price. */
  tomePriceMult: number
}

export interface BalanceConfig {
  /** Normalizes SPD onto the timeline: nextAt = turnTime + actionDelay × (spdRef / spd). */
  spdRef: number
  /** Damage variance range (seeded roll). */
  variance: [number, number]
  critRate: number
  critDamage: number
  dodgeRate: number
  /** Heal scaling reference: heal = basePower × (MAG / magRef). */
  magRef: number
  /** Blind halves the affected actor's accuracy. */
  blindAccuracy: number
  /** Per-status effective-modifier cap (statuses stack per-status). */
  statCap: number
  /** Poison ticks after every N resolved turns. */
  poisonInterval: number
  /** Shared MP pool size for party actors (enemies use cost-0 skills). */
  maxMp: number
  /** Base power of a basic attack (`docs/combat.md` §5). */
  basicAttackPower: number
  /** Action weights on the queue (higher = slower re-insert). */
  actionDelays: {
    attack: number
    defend: number
    item: number
    skill: number
  }
  /** Run generation + difficulty tuning (Phase 3 plan §5). */
  run: RunBalanceConfig
  /** Meta/run economy tuning (Phase 3 plan §5). */
  economy: EconomyConfig
}

export const BALANCE: BalanceConfig = {
  spdRef: 100,
  variance: [0.9, 1.1],
  critRate: 0.05,
  critDamage: 1.5,
  dodgeRate: 0.05,
  magRef: 20,
  blindAccuracy: 0.5,
  statCap: 2,
  poisonInterval: 3,
  maxMp: 30,
  basicAttackPower: 15,
  actionDelays: { attack: 100, defend: 110, item: 160, skill: 120 },
  run: {
    difficultyStep: 1.12,
    eliteMult: 1.6,
    bossMult: 2.2,
    // A 3-battle run starts fresh with no leveling, so its boss must sit in
    // the level 7–10 band instead of the level ~17 the flat bossMult yields.
    bossMultByLength: { 3: 1.2 },
    restCadence: 5,
    baseGold: 20,
    goldVariance: [0.8, 1.2],
    dropChance: 0.5,
    dropWeights: { gear: 1, consumable: 1, skillItem: 0.5 },
    runPayout: { won: 1, abandoned: 0.5, lost: 0.25 },
  },
  economy: {
    startingGold: 1500,
    sellRatio: 0.5,
    recruitPrice: 150,
    rotatingGear: 4,
    rotatingSkillItems: 3,
    skillItemPrice: { common: 200, rare: 450, epic: 900, legendary: 1600 },
    tomePriceMult: 2.5,
  },
}

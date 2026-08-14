/**
 * Damage, healing & hit-roll formulas (`docs/combat.md` §5). Pure module: no
 * Phaser, no store access; a seeded RNG is passed in. Tuning constants are
 * read from `../data/balance` — never hardcoded here.
 *
 * Damage is ratio-based and **unclamped**:
 *
 *   physical:  damage = base × (ATK_eff / DEF_eff)
 *   magical:   damage = base × (MAG_eff / RES_eff)
 *   final     = ratio-damage × elementMultiplier × defendModifier
 *               × variance × crit     (in that order)
 *
 * Final damage (`finalizeDamage`) and outgoing healing (`healMagic`) are
 * **rounded to the nearest whole number** before being applied to HP.
 *
 * Before damage, a hit roll passes `accuracy × (1 − dodge)`; a missed attack
 * deals 0 via whichever layer calls `hitCheck`. Crit chance derives from
 * SPD/gear/class (Rogue higher) — the roll itself is `rng() < critRate`.
 */

import { BALANCE, type BalanceConfig } from '../data/balance'
import { elementMultiplier } from '../data/elements'
import type { Element } from '../types'
import type { Rng } from '../rng/rng'

function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0, got ${value}`)
  }
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number > 0, got ${value}`)
  }
}

/**
 * Physical ratio damage: `base × (ATK / DEF)`, unclamped. Extreme stat
 * mismatches produce proportionally huge or tiny hits (`docs/combat.md` §5).
 */
export function physicalDamage(base: number, atk: number, def: number): number {
  assertNonNegative(base, 'base')
  assertNonNegative(atk, 'atk')
  assertPositive(def, 'def')
  return base * (atk / def)
}

/** Magical ratio damage: `base × (MAG / RES)`, unclamped. */
export function magicalDamage(base: number, mag: number, res: number): number {
  assertNonNegative(base, 'base')
  assertNonNegative(mag, 'mag')
  assertPositive(res, 'res')
  return base * (mag / res)
}

/** Variance factor for a seeded roll: `min + roll × (max − min)`. */
export function varianceFactor(roll: number, range: [number, number] = BALANCE.variance): number {
  assertNonNegative(roll, 'roll')
  return range[0] + roll * (range[1] - range[0])
}

export interface FinalizeOptions {
  /** Attacker's element. Defaults to `'none'` (no multiplier). */
  attackElement?: Element
  /** Defender's element. Defaults to `'none'` (no multiplier). */
  defendElement?: Element
  /** True while the target is Defending — halves incoming damage. */
  defending?: boolean
  /** Seeded float in [0, 1). */
  varianceRoll: number
  /** True when the hit landed as a crit (~1.5×). */
  crit?: boolean
}

/**
 * Apply `element × defend × variance × crit` in order to a ratio-damage value.
 * `rating` is the output of `physicalDamage` / `magicalDamage`. The result is
 * rounded to the nearest whole number — damage dealt is always an integer.
 */
export function finalizeDamage(
  rating: number,
  opts: FinalizeOptions,
  balance: BalanceConfig = BALANCE,
): number {
  assertNonNegative(rating, 'rating')
  assertNonNegative(opts.varianceRoll, 'varianceRoll')
  const elem = elementMultiplier(opts.attackElement ?? 'none', opts.defendElement ?? 'none')
  const defend = opts.defending ? 0.5 : 1
  const variance = varianceFactor(opts.varianceRoll, balance.variance)
  const crit = opts.crit ? balance.critDamage : 1
  return Math.round(rating * elem * defend * variance * crit)
}

/**
 * Hit roll: `rng() < accuracy × (1 − dodge)`. `accuracy` should already be
 * blind-adjusted via `effectiveAccuracy` (`status.ts`). A miss deals 0.
 */
export function hitCheck(accuracy: number, dodge: number, rng: Rng): boolean {
  assertNonNegative(accuracy, 'accuracy')
  assertNonNegative(dodge, 'dodge')
  return rng() < accuracy * (1 - dodge)
}

/** Crit roll: `rng() < critRate` (default from balance). */
export function rollCrit(rng: Rng, rate: number = BALANCE.critRate): boolean {
  assertNonNegative(rate, 'critRate')
  return rng() < rate
}

/**
 * Magic heal: `basePower × (MAG / MAG_REF)` (`docs/combat.md` §5). Scales with
 * the caster's MAG; RES does not modify outgoing healing. The result is rounded
 * to the nearest whole number — healing applied is always an integer.
 */
export function healMagic(power: number, mag: number, magRef: number = BALANCE.magRef): number {
  assertNonNegative(power, 'power')
  assertNonNegative(mag, 'mag')
  assertPositive(magRef, 'magRef')
  return Math.round(power * (mag / magRef))
}

/** Item heal: flat `healHp`, no scaling (`docs/combat.md` §5). */
export function itemHeal(flat: number): number {
  assertNonNegative(flat, 'flat')
  return flat
}
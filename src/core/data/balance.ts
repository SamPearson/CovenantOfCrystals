/**
 * Balance constants (`docs/combat.md` §5, Phase 2 plan §6). All values are
 * placeholder stubs — the Phase 5 data pass tunes them. Code reads tuning
 * numbers from here; it never hardcodes them.
 */

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
}

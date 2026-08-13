import { describe, expect, it } from 'vitest'
import { BALANCE } from '../data/balance'
import type { BattleActor, ActiveStatus } from './types'
import {
  applyStatus,
  cleanse,
  countStacks,
  effectiveAccuracy,
  effectiveModifier,
  getStacks,
  hasStatus,
  isCrowdControlled,
  tickDurations,
  tickOwnTurnEffects,
  tickPoison,
  wakeOnDamage,
} from './status'

function actor(id = 'a1', hp = 100): BattleActor {
  return {
    id,
    sourceId: id,
    side: 'enemy',
    name: id,
    stats: { hp: 100, atk: 10, def: 10, mag: 10, res: 10, spd: 10 },
    hp,
    mp: 50,
    statuses: [],
    ko: false,
  }
}

const statBuff = (stat: 'atk' | 'def' | 'spd' | 'mag' | 'res', power: number, duration: number): ActiveStatus =>
  ({ kind: 'statBuff', stat, power, duration })

const statDebuff = (stat: 'atk' | 'def' | 'spd' | 'mag' | 'res', power: number, duration: number): ActiveStatus =>
  ({ kind: 'statDebuff', stat, power, duration })

describe('applyStatus / stacking / cap', () => {
  it('adds an independent stack with its own duration', () => {
    const a = actor()
    applyStatus(a, statBuff('atk', 1.3, 3))
    applyStatus(a, statBuff('atk', 1.2, 2))
    expect(a.statuses).toHaveLength(2)
    expect(getStacks(a, 'statBuff', 'atk').map((s) => s.duration)).toEqual([3, 2])
  })

  it('stacks of different stats are independent', () => {
    const a = actor()
    applyStatus(a, statBuff('atk', 1.3, 3))
    applyStatus(a, statBuff('def', 1.3, 3))
    expect(a.statuses).toHaveLength(2)
  })

  it('caps stat statuses per (kind, stat) at BALANCE.statCap (2×)', () => {
    const a = actor()
    expect(applyStatus(a, statBuff('atk', 1.3, 3))).toBe(true)
    expect(applyStatus(a, statBuff('atk', 1.3, 3))).toBe(true)
    expect(applyStatus(a, statBuff('atk', 1.3, 3))).toBe(false) // at cap → ignored
    expect(countStacks(a, 'statBuff', 'atk')).toBe(2)
  })

  it('ignores a third stack but a fresh stat still applies', () => {
    const a = actor()
    applyStatus(a, statBuff('atk', 1.3, 3))
    applyStatus(a, statBuff('atk', 1.3, 3))
    applyStatus(a, statBuff('atk', 1.3, 3))
    applyStatus(a, statDebuff('spd', 0.7, 2))
    expect(countStacks(a, 'statDebuff', 'spd')).toBe(1)
  })

  it('DOT and CC statuses stack freely (no count cap)', () => {
    const a = actor()
    for (let i = 0; i < 5; i++) applyStatus(a, { kind: 'burn', power: 4, duration: 3 })
    expect(a.statuses).toHaveLength(5)
  })

  it('requires a valid duration and a stat for stat statuses', () => {
    const a = actor()
    expect(() => applyStatus(a, { kind: 'burn', power: 4, duration: 0 })).toThrow(/duration must be/)
    expect(() => applyStatus(a, { kind: 'statBuff', power: 1.3, duration: 3 })).toThrow(/requires a stat/)
    expect(() => applyStatus(a, { kind: 'statDebuff', power: 0.8, duration: 3 })).toThrow(/requires a stat/)
  })
})

describe('effectiveModifier (stacks combined, capped)', () => {
  it('no stacks → 1', () => {
    const a = actor()
    expect(effectiveModifier(a, 'statBuff', 'atk')).toBe(1)
  })

  it('multiplies stack powers', () => {
    const a = actor()
    applyStatus(a, statBuff('atk', 1.3, 3))
    applyStatus(a, statBuff('atk', 1.3, 3))
    expect(effectiveModifier(a, 'statBuff', 'atk')).toBeCloseTo(1.69)
  })

  it('caps buffs at statCap (2×)', () => {
    const a = actor()
    applyStatus(a, statBuff('atk', 1.5, 3))
    applyStatus(a, statBuff('atk', 1.5, 3))
    expect(effectiveModifier(a, 'statBuff', 'atk')).toBe(BALANCE.statCap)
  })

  it('floors debuffs at 1/statCap (0.5×)', () => {
    const a = actor()
    applyStatus(a, statDebuff('atk', 0.6, 3))
    applyStatus(a, statDebuff('atk', 0.6, 3))
    expect(effectiveModifier(a, 'statDebuff', 'atk')).toBeCloseTo(1 / BALANCE.statCap)
    expect(effectiveModifier(a, 'statDebuff', 'atk')).toBeCloseTo(0.5)
  })
})

describe('own-turn DOT ticks (burn / regen)', () => {
  it('burn damages at the start of the victim own turn', () => {
    const a = actor('a1', 100)
    applyStatus(a, { kind: 'burn', power: 5, duration: 3 })
    const tick = tickOwnTurnEffects(a)
    expect(tick.burnDamage).toBe(5)
    expect(a.hp).toBe(95)
    expect(tick.ko).toBe(false)
  })

  it('burn stacks combine by summing power', () => {
    const a = actor('a1', 100)
    applyStatus(a, { kind: 'burn', power: 4, duration: 3 })
    applyStatus(a, { kind: 'burn', power: 6, duration: 3 })
    const tick = tickOwnTurnEffects(a)
    expect(tick.burnDamage).toBe(10)
    expect(a.hp).toBe(90)
  })

  it('a killing burn tick ends the turn (KO, no action)', () => {
    const a = actor('a1', 3)
    applyStatus(a, { kind: 'burn', power: 5, duration: 3 })
    const tick = tickOwnTurnEffects(a)
    expect(tick.burnDamage).toBe(5)
    expect(a.hp).toBe(0)
    expect(tick.ko).toBe(true)
  })

  it('regen heals a flat power at the start of the own turn', () => {
    const a = actor('a1', 70)
    applyStatus(a, { kind: 'regen', power: 8, duration: 2 })
    const tick = tickOwnTurnEffects(a)
    expect(tick.regenHeal).toBe(8)
    expect(a.hp).toBe(78)
  })

  it('regen does not overheal past max HP', () => {
    const a = actor('a1', 97)
    applyStatus(a, { kind: 'regen', power: 8, duration: 2 })
    const tick = tickOwnTurnEffects(a)
    expect(tick.regenHeal).toBe(3)
    expect(a.hp).toBe(100)
  })

  it('regen stacks combine by summing power', () => {
    const a = actor('a1', 50)
    applyStatus(a, { kind: 'regen', power: 3, duration: 2 })
    applyStatus(a, { kind: 'regen', power: 5, duration: 2 })
    const tick = tickOwnTurnEffects(a)
    expect(tick.regenHeal).toBe(8)
    expect(a.hp).toBe(58)
  })
})

describe('poison (global-interval DOT)', () => {
  it('deals the summed stack power to every poisoned actor', () => {
    const a = actor('a1', 50)
    const b = actor('b1', 50)
    applyStatus(a, { kind: 'poison', power: 4, duration: 4 })
    applyStatus(b, { kind: 'poison', power: 6, duration: 4 })
    const ticks = tickPoison([a, b])
    expect(ticks).toHaveLength(2)
    expect(ticks[0]).toEqual({ actorId: 'a1', damage: 4, ko: false })
    expect(ticks[1]).toEqual({ actorId: 'b1', damage: 6, ko: false })
    expect(a.hp).toBe(46)
    expect(b.hp).toBe(44)
  })

  it('skips actors without poison and KO actors', () => {
    const clean = actor('c1', 50)
    const dead = actor('d1', 0)
    dead.ko = true
    applyStatus(dead, { kind: 'poison', power: 5, duration: 4 })
    expect(tickPoison([clean, dead])).toEqual([])
    expect(clean.hp).toBe(50)
  })

  it('a killing poison tick marks the actor KO', () => {
    const a = actor('a1', 3)
    applyStatus(a, { kind: 'poison', power: 5, duration: 4 })
    const ticks = tickPoison([a])
    expect(ticks[0]).toEqual({ actorId: 'a1', damage: 5, ko: true })
    expect(a.hp).toBe(0)
    expect(a.ko).toBe(true)
  })
})

describe('own-turn durations (expire after N own turns)', () => {
  it('an N-turn buff is removed after N of the actor own turns', () => {
    const a = actor()
    applyStatus(a, statBuff('atk', 1.3, 2))
    tickDurations(a) // own turn 1 → duration 1
    expect(hasStatus(a, 'statBuff', 'atk')).toBe(true)
    const removed = tickDurations(a) // own turn 2 → duration 0
    expect(removed).toHaveLength(1)
    expect(removed[0]?.kind).toBe('statBuff')
    expect(a.statuses).toHaveLength(0)
  })

  it('stacks expire independently', () => {
    const a = actor()
    applyStatus(a, statBuff('atk', 1.3, 1))
    applyStatus(a, statBuff('atk', 1.2, 3))
    tickDurations(a)
    expect(countStacks(a, 'statBuff', 'atk')).toBe(1)
    expect(getStacks(a, 'statBuff', 'atk')[0]?.power).toBe(1.2)
  })

  it('burn damage is dealt on each own turn and the status persists until expired', () => {
    const a = actor('a1', 100)
    applyStatus(a, { kind: 'burn', power: 5, duration: 3 })
    tickOwnTurnEffects(a); tickDurations(a) // turn 1: −5, dur 2
    expect(a.hp).toBe(95)
    tickDurations(a) // turn 2: dur 1
    expect(hasStatus(a, 'burn')).toBe(true)
    tickDurations(a) // turn 3: expired
    expect(hasStatus(a, 'burn')).toBe(false)
  })
})

describe('CC (sleep / freeze) and blind', () => {
  it('sleep and freeze both flag the actor as crowd-controlled', () => {
    const a = actor()
    expect(isCrowdControlled(a)).toBe(false)
    applyStatus(a, { kind: 'sleep', duration: 2 })
    expect(isCrowdControlled(a)).toBe(true)
    const b = actor()
    applyStatus(b, { kind: 'freeze', duration: 2 })
    expect(isCrowdControlled(b)).toBe(true)
  })

  it('wakeOnDamage removes sleep stacks (wake on taking damage)', () => {
    const a = actor()
    applyStatus(a, { kind: 'sleep', duration: 3 })
    applyStatus(a, { kind: 'sleep', duration: 2 })
    const removed = wakeOnDamage(a)
    expect(removed).toHaveLength(2)
    expect(hasStatus(a, 'sleep')).toBe(false)
    expect(isCrowdControlled(a)).toBe(false)
  })

  it('sleep ends after N own turns when not woken by damage', () => {
    const a = actor()
    applyStatus(a, { kind: 'sleep', duration: 2 })
    tickDurations(a)
    expect(isCrowdControlled(a)).toBe(true)
    const removed = tickDurations(a)
    expect(removed).toHaveLength(1)
    expect(isCrowdControlled(a)).toBe(false)
  })

  it('freeze skips N turns unconditionally — damage does not wake it', () => {
    const a = actor('a1', 50)
    applyStatus(a, { kind: 'freeze', duration: 2 })
    // damage lands (would wake sleep) but freeze persists
    a.hp -= 10
    wakeOnDamage(a)
    expect(isCrowdControlled(a)).toBe(true)
    tickDurations(a)
    expect(isCrowdControlled(a)).toBe(true)
    tickDurations(a)
    expect(isCrowdControlled(a)).toBe(false)
  })

  it('blind halves the actor accuracy', () => {
    const a = actor()
    expect(effectiveAccuracy(a, 1)).toBe(1)
    applyStatus(a, { kind: 'blind', duration: 2 })
    expect(effectiveAccuracy(a, 1)).toBe(1 * BALANCE.blindAccuracy)
    expect(effectiveAccuracy(a, 0.8)).toBe(0.8 * BALANCE.blindAccuracy)
  })
})

describe('cleanse', () => {
  it('removes harmful effects but keeps buffs and regen', () => {
    const a = actor()
    applyStatus(a, statBuff('atk', 1.3, 3))
    applyStatus(a, statDebuff('spd', 0.7, 2))
    applyStatus(a, { kind: 'burn', power: 4, duration: 3 })
    applyStatus(a, { kind: 'poison', power: 4, duration: 3 })
    applyStatus(a, { kind: 'blind', duration: 2 })
    applyStatus(a, { kind: 'sleep', duration: 2 })
    applyStatus(a, { kind: 'freeze', duration: 2 })
    applyStatus(a, { kind: 'regen', power: 5, duration: 2 })
    const removed = cleanse(a)
    expect(removed.map((s) => s.kind).sort()).toEqual(['blind', 'burn', 'freeze', 'poison', 'sleep', 'statDebuff'])
    const remaining = a.statuses.map((s) => s.kind).sort()
    expect(remaining).toEqual(['regen', 'statBuff'])
    expect(isCrowdControlled(a)).toBe(false)
  })
})
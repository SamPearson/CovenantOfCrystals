/**
 * Run resolution (Phase 3 M3, `phase-3-run-loop-plan.md` §8). Permadeath
 * (combat.md §6), survivor XP, node advance, and the three run-end states.
 */

import { describe, expect, it } from 'vitest'
import type { BattleResult } from '../combat/types'
import { addToParty } from '../party'
import { seedStarterRoster } from '../starter'
import { createNewSave } from '../save.service'
import type { ActiveRun, PlayerProfile } from '../types'
import { addGear, createGearInstance, findGearById } from '../inventory'
import { equipGear } from '../equip'
import { generateRun } from './run-gen'
import { resolveBattleResult, resolveRestNode, tickDurability } from './resolve'

function makeContext() {
  const save = createNewSave('resolve-test')
  const profile = save.profile
  seedStarterRoster(profile)
  const partyIds = Object.keys(profile.characters).slice(0, 3)
  for (const id of partyIds) addToParty(profile, id)
  const run = generateRun(profile.profileId, partyIds, 3, 42)
  const battle = (partial: {
    status: BattleResult['status']
    koIds?: string[]
    survivors?: string[]
  }): BattleResult => ({
    status: partial.status,
    koIds: partial.koIds ?? [],
    survivors: partial.survivors ?? [],
    xpAwarded: {},
    drops: [],
    log: [],
  })
  return { profile, run, battle }
}

describe('resolveBattleResult', () => {
  it('returns null and advances after a non-boss win', () => {
    const { profile, run, battle } = makeContext()
    const result = resolveBattleResult(
      run,
      battle({ status: 'won', survivors: [...run.party] }),
      profile,
    )

    expect(result).toBeNull()
    expect(run.status).toBe('active')
    expect(run.currentNodeIndex).toBe(1)
    expect(run.goldEarned).toBeGreaterThan(0)
    for (const id of run.party) {
      expect(profile.characters[id]!.xp).toBeGreaterThan(0)
    }
  })

  it('permadeaths KO characters: removed, gear returned, box cleared', () => {
    const { profile, run, battle } = makeContext()
    const survivor = run.party[0]!
    const doomed = run.party[1]!

    const gear = createGearInstance('iron_sword', { kind: 'permanent' })
    addGear(profile, gear)
    equipGear(profile, doomed, gear.id)

    const result = resolveBattleResult(
      run,
      battle({ status: 'won', koIds: [doomed], survivors: [survivor] }),
      profile,
    )

    expect(result).toBeNull()
    expect(profile.characters[doomed]).toBeUndefined()
    expect(run.party).not.toContain(doomed)
    expect(run.party).toContain(survivor)
    expect(findGearById(profile, gear.id)).toBeDefined()
    expect(profile.characters[survivor]!.xp).toBeGreaterThan(0)
    expect(run.currentNodeIndex).toBe(1)
  })

  it('ends the run as lost on a full wipe', () => {
    const { profile, run, battle } = makeContext()
    const koIds = [...run.party]

    const result = resolveBattleResult(
      run,
      battle({ status: 'lost', koIds }),
      profile,
    )

    expect(run.status).toBe('lost')
    expect(result!.status).toBe('lost')
    expect(result!.survivors).toEqual([])
    expect(result!.koIds).toEqual(koIds)
    for (const id of koIds) {
      expect(profile.characters[id]).toBeUndefined()
    }
    expect(run.party).toEqual([])
  })

  it('banks a full payout on boss victory and ends the run won', () => {
    const { profile, run, battle } = makeContext()
    run.currentNodeIndex = run.nodes.length - 1

    const result = resolveBattleResult(
      run,
      battle({ status: 'won', survivors: [...run.party] }),
      profile,
    )

    expect(run.status).toBe('won')
    expect(result!.status).toBe('won')
    expect(result!.survivors).toEqual(run.party)
    expect(result!.goldBanked).toBe(run.goldEarned)
    for (const id of run.party) {
      expect(profile.characters[id]!.xp).toBeGreaterThan(0)
    }
  })

  it('ends the run abandoned on a successful flee', () => {
    const { profile, run, battle } = makeContext()

    const result = resolveBattleResult(
      run,
      battle({ status: 'fled', survivors: [...run.party] }),
      profile,
    )

    expect(run.status).toBe('abandoned')
    expect(result!.status).toBe('abandoned')
    expect(result!.survivors).toEqual(run.party)
    for (const id of run.party) {
      expect(profile.characters[id]).toBeDefined()
    }
  })

  it('keeps survivors alive when a teammate dies', () => {
    const { profile, run, battle } = makeContext()
    const survivor = run.party[0]!
    const doomed = run.party[1]!

    resolveBattleResult(
      run,
      battle({ status: 'won', koIds: [doomed], survivors: [survivor] }),
      profile,
    )

    expect(profile.characters[survivor]).toBeDefined()
    expect(profile.characters[doomed]).toBeUndefined()
  })

  it('awards only survivors their xp share after a partial wipe', () => {
    const { profile, run, battle } = makeContext()
    const survivor = run.party[0]!
    const doomed = run.party[1]!

    resolveBattleResult(
      run,
      battle({ status: 'won', koIds: [doomed], survivors: [survivor] }),
      profile,
    )

    expect(profile.characters[survivor]!.xp).toBeGreaterThan(0)
    expect(profile.characters[doomed]).toBeUndefined()
  })
})

describe('resolveRestNode', () => {
  it('advances the run', () => {
    const { profile, run, battle } = makeContext()
    // give the run a couple of resolved battle steps so rest advance is meaningful
    for (let i = 0; i < 2; i++) {
      resolveBattleResult(
        run,
        battle({ status: 'won', survivors: [...run.party] }),
        profile,
      )
    }
    const before = run.currentNodeIndex

    resolveRestNode(run as ActiveRun)

    expect(run.currentNodeIndex).toBe(before + 1)
  })
})

describe('tickDurability', () => {
  it('is a no-op in P3 (permanent gear untouched)', () => {
    const save = createNewSave('durability-test')
    seedStarterRoster(save.profile)
    const profile: PlayerProfile = save.profile

    expect(() => tickDurability(profile)).not.toThrow()
    for (const gear of profile.inventory.gear) {
      expect(gear.durability).toEqual({ kind: 'permanent' })
    }
    for (const char of Object.values(profile.characters)) {
      expect(char.durability).toEqual({ kind: 'permanent' })
    }
  })
})
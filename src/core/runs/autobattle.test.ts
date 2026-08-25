/**
 * Phase 4 M4 (auto-advance + stop points): the pure stop decision and the
 * persisted `setAutoStop` preference. Party wipe / run end are hard stops and
 * are covered by the run-resolution tests in `resolve.test.ts`; here we assert
 * they are NOT governed by the soft stop config.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { shouldStopBeforeAdvance } from './autobattle'
import { AUTOBATTLE_DEFAULTS } from '../save.service'
import type { AutobattlePrefs, RunNode, RunNodeType } from '../types'
import { initStore, getProfile, setAutoStop, setResultDelay, resolveNode, startRun, getActiveRun } from '../store'
import { seedStarterRoster } from '../starter'
import { generateRun } from './run-gen'
import type { BattleResult } from '../combat/types'

class MemStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    this.store.set(k, v)
  }
  removeItem(k: string): void {
    this.store.delete(k)
  }
  clear(): void {
    this.store.clear()
  }
}

function makeNode(type: RunNodeType): RunNode {
  return { type, index: 0 }
}

function makePrefs(stops: Partial<AutobattlePrefs['stops']>): AutobattlePrefs {
  return {
    speed: 1,
    skipAnimations: false,
    stops: { boss: true, elite: true, permadeath: true, rest: true, ...stops },
  }
}

describe('shouldStopBeforeAdvance', () => {
  it('never stops when all prefs are off (full auto-advance)', () => {
    const prefs = makePrefs({ boss: false, elite: false, permadeath: false, rest: false })
    expect(shouldStopBeforeAdvance(prefs, { koIds: [], nextNode: makeNode('boss') })).toBe(false)
    expect(shouldStopBeforeAdvance(prefs, { koIds: [], nextNode: makeNode('elite') })).toBe(false)
    expect(shouldStopBeforeAdvance(prefs, { koIds: ['c1'], nextNode: makeNode('battle') })).toBe(false)
    expect(shouldStopBeforeAdvance(prefs, { koIds: [], nextNode: makeNode('rest') })).toBe(false)
  })

  it('stops at boss only when the boss stop is enabled', () => {
    const off = makePrefs({ boss: false })
    expect(shouldStopBeforeAdvance(off, { koIds: [], nextNode: makeNode('boss') })).toBe(false)
    const on = makePrefs({ boss: true })
    expect(shouldStopBeforeAdvance(on, { koIds: [], nextNode: makeNode('boss') })).toBe(true)
  })

  it('stops at elite only when the elite stop is enabled', () => {
    const off = makePrefs({ elite: false })
    expect(shouldStopBeforeAdvance(off, { koIds: [], nextNode: makeNode('elite') })).toBe(false)
    const on = makePrefs({ elite: true })
    expect(shouldStopBeforeAdvance(on, { koIds: [], nextNode: makeNode('elite') })).toBe(true)
  })

  it('stops at rest only when the rest stop is enabled', () => {
    const off = makePrefs({ rest: false })
    expect(shouldStopBeforeAdvance(off, { koIds: [], nextNode: makeNode('rest') })).toBe(false)
    const on = makePrefs({ rest: true })
    expect(shouldStopBeforeAdvance(on, { koIds: [], nextNode: makeNode('rest') })).toBe(true)
  })

  it('stops on permadeath only with KO ids and the permadeath stop enabled', () => {
    const off = makePrefs({ permadeath: false })
    expect(shouldStopBeforeAdvance(off, { koIds: ['c1'], nextNode: makeNode('battle') })).toBe(false)
    const on = makePrefs({ permadeath: true })
    expect(shouldStopBeforeAdvance(on, { koIds: ['c1'], nextNode: makeNode('battle') })).toBe(true)
    // No KO ids => no permadeath stop, even when enabled.
    expect(shouldStopBeforeAdvance(on, { koIds: [], nextNode: makeNode('battle') })).toBe(false)
  })

  it('returns false when the run has ended (caller must hard-stop)', () => {
    const prefs = makePrefs({})
    expect(shouldStopBeforeAdvance(prefs, { koIds: [], nextNode: undefined })).toBe(false)
  })

  it('permadeath stop takes priority and still fires before a configured node stop', () => {
    const prefs = makePrefs({ permadeath: true, rest: true })
    expect(shouldStopBeforeAdvance(prefs, { koIds: ['c1'], nextNode: makeNode('rest') })).toBe(true)
  })

  it('skips the result screen for a won battle whose next node is a plain battle (auto-advance)', () => {
    const prefs = makePrefs({})
    expect(shouldStopBeforeAdvance(prefs, { koIds: [], nextNode: makeNode('battle') })).toBe(false)
  })
})

describe('setAutoStop persistence', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage()
  })

  it('updates only the provided flags and round-trips through save/load', () => {
    initStore()
    setAutoStop({ boss: false, rest: false })

    const live = getProfile().autobattle.stops
    expect(live.boss).toBe(false)
    expect(live.rest).toBe(false)
    // untouched flags keep their defaults
    expect(live.elite).toBe(true)
    expect(live.permadeath).toBe(true)

    const reloaded = initStore().profile.autobattle.stops
    expect(reloaded.boss).toBe(false)
    expect(reloaded.rest).toBe(false)
    expect(reloaded.elite).toBe(true)
    expect(reloaded.permadeath).toBe(true)
  })
})

describe('result notice duration', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage()
  })

  it('defaults the result notice to 3 seconds', () => {
    expect(AUTOBATTLE_DEFAULTS.resultDelayMs).toBe(3000)
  })

  it('persists the configured notice duration', () => {
    initStore()
    setResultDelay(5000)
    expect(getProfile().autobattle.resultDelayMs).toBe(5000)
    const reloaded = initStore().profile.autobattle.resultDelayMs
    expect(reloaded).toBe(5000)
  })
})

describe('hard stops are not configurable', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage()
  })

  function activeRun() {
    initStore()
    const profile = getProfile()
    seedStarterRoster(profile)
    const partyIds = Object.keys(profile.characters).slice(0, 3)
    const run = generateRun(profile.profileId, partyIds, 3, 7)
    startRun(partyIds, 3, 7)
    return { run, partyIds }
  }

  it('a full wipe ends the run regardless of stop config', () => {
    const { run } = activeRun()
    setAutoStop({ permadeath: false, boss: false, elite: false, rest: false })
    const koIds = [...run.party]
    const result = resolveNode({
      status: 'lost',
      koIds,
      survivors: [],
      xpAwarded: {},
      drops: [],
      log: [],
    } as BattleResult)
    expect(result).not.toBeNull()
    expect(result!.status).toBe('lost')
  })

  it('a boss victory ends the run regardless of stop config', () => {
    activeRun()
    setAutoStop({ boss: false })
    const run = getActiveRun()!
    run.currentNodeIndex = run.nodes.length - 1
    const result = resolveNode({
      status: 'won',
      koIds: [],
      survivors: [...run.party],
      xpAwarded: {},
      drops: [],
      log: [],
    } as BattleResult)
    expect(result).not.toBeNull()
    expect(result!.status).toBe('won')
  })
})

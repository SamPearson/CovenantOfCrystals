import { describe, expect, it } from 'vitest'
import { hasPermission, matchesPermission } from './battle-events'
import type { BattleActor, BattleEvent, BattleState } from './types'
import type { EventPattern } from '../scripting/types'

function makeActor(id: string, side: BattleActor['side']): BattleActor {
  return {
    id,
    sourceId: id,
    side,
    name: id,
    stats: { hp: 100, atk: 10, def: 5, mag: 5, res: 5, spd: 5 },
    hp: 80,
    mp: 10,
    statuses: [],
    ko: false,
  }
}

function makeBattle(): BattleState {
  const actors: Record<string, BattleActor> = {
    hero: makeActor('hero', 'player'),
    ally: makeActor('ally', 'player'),
    goblin: makeActor('goblin', 'enemy'),
  }
  return {
    seed: 1,
    actors,
    queue: [],
    turnTime: 0,
    turnCount: 0,
    pendingEvents: [],
    reactionQueue: [],
    log: [],
    status: 'ongoing',
    over: false,
  }
}

const attacked: BattleEvent = { kind: 'attacked', actorId: 'hero', sourceId: 'goblin' }

describe('matchesPermission', () => {
  it('matches on kind alone when source and target are omitted', () => {
    const battle = makeBattle()
    const reactor = battle.actors.hero!
    expect(matchesPermission({ kind: 'attacked' }, attacked, reactor, battle)).toBe(true)
  })

  it('matches a self target filter', () => {
    const battle = makeBattle()
    const reactor = battle.actors.hero!
    const pattern: EventPattern = { kind: 'attacked', target: 'self' }
    expect(matchesPermission(pattern, attacked, reactor, battle)).toBe(true)
  })

  it('rejects an event whose target is not the reactor under a self filter', () => {
    const battle = makeBattle()
    const reactor = battle.actors.ally!
    const pattern: EventPattern = { kind: 'attacked', target: 'self' }
    expect(matchesPermission(pattern, attacked, reactor, battle)).toBe(false)
  })

  it('resolves ally/enemy filters by side relative to the reactor', () => {
    const battle = makeBattle()
    const reactor = battle.actors.hero!
    expect(matchesPermission({ kind: 'attacked', source: 'enemy' }, attacked, reactor, battle)).toBe(true)
    expect(matchesPermission({ kind: 'attacked', source: 'ally' }, attacked, reactor, battle)).toBe(false)
  })

  it('rejects a kind mismatch', () => {
    const battle = makeBattle()
    const reactor = battle.actors.hero!
    expect(matchesPermission({ kind: 'evaded', source: 'enemy' }, attacked, reactor, battle)).toBe(false)
  })

  it('rejects undefined source ids even under a wildcard-free filter', () => {
    const battle = makeBattle()
    const reactor = battle.actors.hero!
    const orphan: BattleEvent = { kind: 'attacked', actorId: 'hero', sourceId: undefined }
    expect(matchesPermission({ kind: 'attacked', source: 'enemy' }, orphan, reactor, battle)).toBe(false)
  })

  it('treats the reactor itself as self, not enemy', () => {
    const battle = makeBattle()
    const reactor = battle.actors.hero!
    const selfHit: BattleEvent = { kind: 'attacked', actorId: 'hero', sourceId: 'hero' }
    expect(matchesPermission({ kind: 'attacked', source: 'enemy' }, selfHit, reactor, battle)).toBe(false)
    expect(matchesPermission({ kind: 'attacked', source: 'self' }, selfHit, reactor, battle)).toBe(true)
  })
})

describe('hasPermission (reactionTo legality)', () => {
  const battle = makeBattle()
  const reactor = battle.actors.hero!

  it('is false when permissions are undefined or empty', () => {
    expect(hasPermission(undefined, attacked, reactor, battle)).toBe(false)
    expect(hasPermission([], attacked, reactor, battle)).toBe(false)
  })

  it('is true when any pattern matches the event', () => {
    const permissions: EventPattern[] = [
      { kind: 'status-applied', target: 'ally' },
      { kind: 'attacked', source: 'enemy', target: 'self' },
    ]
    expect(hasPermission(permissions, attacked, reactor, battle)).toBe(true)
  })

  it('is false when no pattern matches', () => {
    const permissions: EventPattern[] = [{ kind: 'evaded' }]
    expect(hasPermission(permissions, attacked, reactor, battle)).toBe(false)
  })
})
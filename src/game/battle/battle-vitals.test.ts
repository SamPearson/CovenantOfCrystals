import { describe, expect, it } from 'vitest'
import { diffVitals, snapshotVitals, type VitalsSnapshot } from './battle-vitals'
import { createBattle } from '../../core/combat/battle'
import { scriptedSquad } from './battle-setup'
import type { BattleState, BattleActor } from '../../core/combat/types'

function makeActor(id: string, hp: number, mp: number): BattleActor {
  return {
    id,
    sourceId: id,
    side: 'enemy',
    name: id,
    stats: { hp: 100, atk: 10, def: 5, mag: 5, res: 5, spd: 5 },
    hp,
    mp,
    statuses: [],
    ko: false,
  }
}

function makeBattle(actors: BattleActor[]): BattleState {
  const record: Record<string, BattleActor> = {}
  for (const a of actors) record[a.id] = a
  return {
    seed: 1,
    actors: record,
    queue: [],
    turnTime: 0,
    turnCount: 0,
    log: [],
    status: 'ongoing',
    over: false,
  }
}

describe('snapshotVitals', () => {
  it('records hp and mp for every living actor', () => {
    const battle = makeBattle([makeActor('a', 10, 3), makeActor('b', 55, 8)])
    const snap = snapshotVitals(battle)
    expect(snap.a).toEqual({ hp: 10, mp: 3 })
    expect(snap.b).toEqual({ hp: 55, mp: 8 })
  })
})

describe('diffVitals', () => {
  it('reports only changed actors with signed deltas', () => {
    const battle = makeBattle([makeActor('a', 50, 5), makeActor('b', 30, 2)])
    const before = snapshotVitals(battle)
    battle.actors.a!.hp = 37
    battle.actors.a!.mp = 5
    battle.actors.b!.hp = 30
    battle.actors.b!.mp = 0
    const deltas = diffVitals(before, battle)
    expect(deltas).toContainEqual({ actorId: 'a', hpDelta: -13, mpDelta: 0 })
    expect(deltas).toContainEqual({ actorId: 'b', hpDelta: 0, mpDelta: -2 })
  })

  it('skips actors with no vitals change', () => {
    const battle = makeBattle([makeActor('a', 50, 5)])
    const before = snapshotVitals(battle)
    expect(diffVitals(before, battle)).toEqual([])
  })

  it('handles KO (hp to zero) as a negative delta', () => {
    const battle = makeBattle([makeActor('a', 5, 5)])
    const before = snapshotVitals(battle)
    battle.actors.a!.hp = 0
    battle.actors.a!.ko = true
    expect(diffVitals(before, battle)).toEqual([{ actorId: 'a', hpDelta: -5, mpDelta: 0 }])
  })
})

describe('integration with createBattle', () => {
  it('snapshot/diff is stable across a real battle state', () => {
    const battle = createBattle([], scriptedSquad(), 42)
    const before: VitalsSnapshot = snapshotVitals(battle)
    const after = diffVitals(before, battle)
    expect(after).toEqual([])
  })
})
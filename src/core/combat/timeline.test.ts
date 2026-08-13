import { describe, expect, it } from 'vitest'
import { BALANCE } from '../data/balance'
import type { TimelineEntry } from './types'
import {
  compareEntries,
  insertActor,
  peekNext,
  pullForward,
  pushBack,
  removeActor,
  sortQueue,
  timeToNextTurn,
} from './timeline'

function entry(actorId: string, nextAt: number, side: 'player' | 'enemy' = 'enemy'): TimelineEntry {
  return { actorId, side, nextAt }
}

describe('timeToNextTurn (SPD/SPD_REF curve)', () => {
  it('applies nextAt = actionDelay × (spdRef / spd)', () => {
    expect(timeToNextTurn(10, 100, 100)).toBe(1000)
    expect(timeToNextTurn(25, 100, 100)).toBe(400)
  })

  it('higher SPD climbs the queue faster (smaller delay)', () => {
    const fast = timeToNextTurn(20, 100, 100)
    const slow = timeToNextTurn(10, 100, 100)
    expect(fast).toBeLessThan(slow)
  })

  it('heavier actions push further back (larger delay)', () => {
    const light = timeToNextTurn(10, BALANCE.actionDelays.attack, 100)
    const heavy = timeToNextTurn(10, BALANCE.actionDelays.item, 100)
    expect(heavy).toBeGreaterThan(light)
  })

  it('defaults spdRef to BALANCE.spdRef', () => {
    expect(timeToNextTurn(10, 100)).toBe(100 * (BALANCE.spdRef / 10))
  })

  it('scales SPD_REF against the timeline', () => {
    // Same SPD/delay but a "slower" reference — ticks are bigger.
    expect(timeToNextTurn(10, 100, 200)).toBe(2000)
    expect(timeToNextTurn(10, 100, 100)).toBe(1000)
  })

  it('rejects non-positive SPD and negative delays', () => {
    expect(() => timeToNextTurn(0, 100, 100)).toThrow(/SPD must be > 0/)
    expect(() => timeToNextTurn(-5, 100, 100)).toThrow(/SPD must be > 0/)
    expect(() => timeToNextTurn(10, -1, 100)).toThrow(/actionDelay must be >= 0/)
    expect(() => timeToNextTurn(10, 100, 0)).toThrow(/spdRef must be > 0/)
  })
})

describe('insertActor / sortQueue (reinsert ordering)', () => {
  it('keeps the queue sorted ascending by nextAt', () => {
    let q = insertActor([], 'a', 'enemy', 500)
    q = insertActor(q, 'b', 'enemy', 100)
    q = insertActor(q, 'c', 'enemy', 300)
    expect(q.map((e) => e.actorId)).toEqual(['b', 'c', 'a'])
    expect(peekNext(q)).toEqual(entry('b', 100))
  })

  it('re-inserting an actor replaces its slot (no duplicates)', () => {
    let q = insertActor([], 'a', 'enemy', 100)
    q = insertActor(q, 'b', 'enemy', 200)
    q = insertActor(q, 'a', 'enemy', 500)
    expect(q.filter((e) => e.actorId === 'a')).toHaveLength(1)
    expect(q.map((e) => e.actorId)).toEqual(['b', 'a'])
  })

  it('adopts the side/position given at (re)insert', () => {
    let q = insertActor([], 'x', 'enemy', 0)
    q = insertActor(q, 'x', 'player', 100)
    expect(q).toEqual([entry('x', 100, 'player')])
  })

  it('reports the queue front via peekNext', () => {
    const q = insertActor(insertActor([], 'a', 'enemy', 300), 'b', 'enemy', 100)
    expect(peekNext(q)?.actorId).toBe('b')
    expect(peekNext([])).toBeUndefined()
  })
})

describe('tie rules (stable order)', () => {
  it('ties resolve by player side first', () => {
    let q = insertActor([], 'enemy1', 'enemy', 100)
    q = insertActor(q, 'player1', 'player', 100)
    expect(q.map((e) => e.actorId)).toEqual(['player1', 'enemy1'])
  })

  it('ties on the same side resolve by actor ID', () => {
    let q = insertActor([], 'zeta', 'enemy', 100)
    q = insertActor(q, 'alpha', 'enemy', 100)
    expect(q.map((e) => e.actorId)).toEqual(['alpha', 'zeta'])
  })

  it('resolves mixed equalities deterministically', () => {
    const a = entry('player-b', 100, 'player')
    const b = entry('player-a', 100, 'player')
    const c = entry('enemy-a', 100, 'enemy')
    expect([a, b, c].sort(compareEntries).map((e) => e.actorId)).toEqual([
      'player-a',
      'player-b',
      'enemy-a',
    ])
  })
})

describe('battle-clock reinsertion (SPD vs. delays over time)', () => {
  function runTurns(playerSpd: number, enemySpd: number, actionDelay: number, turns: number): string[] {
    // Fast player (spd 20), slow enemy (spd 10), both start at time 0.
    let q = insertActor([], 'player1', 'player', 0)
    q = insertActor(q, 'enemy1', 'enemy', 0)
    let clock = 0
    const order: string[] = []
    for (let i = 0; i < turns; i++) {
      const front = peekNext(q)
      if (!front) break
      q = insertActor(q, front.actorId, front.side, clock + timeToNextTurn(front.side === 'player' ? playerSpd : enemySpd, actionDelay, 100))
      clock = front.nextAt
      order.push(front.actorId)
    }
    return order
  }

  it('the faster actor re-inserts sooner and wins turns', () => {
    const order = runTurns(20, 10, 100, 8)
    const playerTurns = order.filter((id) => id === 'player1').length
    const enemyTurns = order.filter((id) => id === 'enemy1').length
    expect(playerTurns).toBeGreaterThan(enemyTurns)
  })

  it('ties at equal clock position fall back to side + ID (no skip)', () => {
    // Equal SPD: the player and enemy interleave; the player always wins the tie.
    const q = insertActor(insertActor([], 'player1', 'player', 0), 'enemy1', 'enemy', 0)
    expect(q.map((e) => e.actorId)).toEqual(['player1', 'enemy1'])
  })
})

describe('pullForward / pushBack (nextAt mutation hooks)', () => {
  it('pullForward brings a turn forward and reorders', () => {
    let q = insertActor([], 'a', 'enemy', 200)
    q = insertActor(q, 'b', 'enemy', 300)
    pullForward(q, 'b', 150)
    expect(q.map((e) => e.actorId)).toEqual(['b', 'a'])
    expect(peekNext(q)?.nextAt).toBe(150)
  })

  it('pullForward clamps at 0', () => {
    const q = insertActor([], 'a', 'enemy', 40)
    pullForward(q, 'a', 1000)
    expect(peekNext(q)?.nextAt).toBe(0)
  })

  it('pushBack pushes a turn back and reorders', () => {
    let q = insertActor([], 'a', 'enemy', 200)
    q = insertActor(q, 'b', 'enemy', 300)
    pushBack(q, 'a', 150)
    expect(q.map((e) => e.actorId)).toEqual(['b', 'a'])
    expect(peekNext(q)?.nextAt).toBe(300)
  })

  it('reorders deterministically when mutations create ties', () => {
    let q = insertActor([], 'p', 'player', 200)
    q = insertActor(q, 'e', 'enemy', 200)
    pushBack(q, 'e', 100) // enemy @300
    pullForward(q, 'e', 100) // enemy back @200 → tie with player
    expect(q.map((e) => e.actorId)).toEqual(['p', 'e'])
  })

  it('throws for unknown actors and negative amounts', () => {
    const q = insertActor([], 'a', 'enemy', 100)
    expect(() => pullForward(q, 'ghost', 10)).toThrow(/No queue entry for actor: ghost/)
    expect(() => pushBack(q, 'ghost', 10)).toThrow(/No queue entry for actor: ghost/)
    expect(() => pullForward(q, 'a', -1)).toThrow(/amount must be >= 0/)
    expect(() => pushBack(q, 'a', -1)).toThrow(/amount must be >= 0/)
  })
})

describe('removeActor', () => {
  it('removes an actor slot and keeps the rest ordered', () => {
    let q = insertActor([], 'a', 'enemy', 100)
    q = insertActor(q, 'b', 'enemy', 200)
    q = insertActor(q, 'c', 'enemy', 300)
    q = removeActor(q, 'b')
    expect(q.map((e) => e.actorId)).toEqual(['a', 'c'])
  })

  it('no-ops on an absent actor', () => {
    const q = insertActor([], 'a', 'enemy', 100)
    expect(removeActor(q, 'ghost').map((e) => e.actorId)).toEqual(['a'])
  })
})

describe('sortQueue', () => {
  it('normalizes an unordered queue', () => {
    const q = sortQueue([entry('z', 300), entry('a', 100), entry('m', 100, 'player')])
    expect(q.map((e) => e.actorId)).toEqual(['m', 'a', 'z'])
  })
})
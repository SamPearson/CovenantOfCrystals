import { describe, it, expect, beforeEach } from 'vitest'
import { createTicker, type Ticker } from './ticker'
import { createBattle, chooseEnemyAction, choosePartyAction, performAction, getBattleResult } from '../combat/battle'
import { peekNext } from '../combat/timeline'
import { createCharacter } from '../character'
import { ENEMIES } from '../data'
import { createRng } from '../rng/rng'

/** A mutable injected clock so tests can advance time deterministically. */
function makeClock() {
  let t = 0
  const clock = () => t
  const advance = (ms: number) => {
    t += ms
  }
  return { clock, advance }
}

describe('createTicker', () => {
  let tk: Ticker

  beforeEach(() => {
    const { clock } = makeClock()
    tk = createTicker({ clock, intervalMs: 50 })
  })

  it('does not fire before the scheduled delay elapses', () => {
    let fired = 0
    tk.schedule(1000, () => (fired += 1))
    // No flush before time advances → nothing fires.
    expect(fired).toBe(0)
  })

  it('fires once the scaled delay has elapsed (wall-clock resolution)', () => {
    const clock2 = makeClock()
    const tk2 = createTicker({ clock: clock2.clock, intervalMs: 50 })
    let fired2 = 0
    tk2.schedule(1000, () => (fired2 += 1))
    clock2.advance(1000)
    tk2.flush()
    expect(fired2).toBe(1)
    // Idempotent — does not fire again on a later flush.
    tk2.flush()
    expect(fired2).toBe(1)
  })

  it('fires tasks in due-time order', () => {
    const order: number[] = []
    const c = makeClock()
    const t = createTicker({ clock: c.clock, intervalMs: 10 })
    t.schedule(300, () => order.push(3))
    t.schedule(100, () => order.push(1))
    t.schedule(200, () => order.push(2))
    c.advance(300)
    t.flush()
    expect(order).toEqual([1, 2, 3])
  })

  it('cancel prevents a scheduled callback from firing', () => {
    let fired = 0
    const handle = tk.schedule(500, () => (fired += 1))
    handle.cancel()
    const c = makeClock()
    const t = createTicker({ clock: c.clock, intervalMs: 10 })
    let fired2 = 0
    const h = t.schedule(500, () => (fired2 += 1))
    h.cancel()
    c.advance(1000)
    t.flush()
    expect(fired2).toBe(0)
  })

  it('onTick callbacks run on every processing pass', () => {
    let ticks = 0
    tk.onTick(() => (ticks += 1))
    tk.flush()
    tk.flush()
    tk.flush()
    expect(ticks).toBe(3)
  })

  it('speed multiplier shortens the scaled delay', () => {
    const c = makeClock()
    const t = createTicker({ clock: c.clock, intervalMs: 10, speed: 2 })
    let fired = 0
    t.schedule(1000, () => (fired += 1))
    // At 2x, 1000 scaled-ms are reached after 500 real ms.
    c.advance(500)
    t.flush()
    expect(fired).toBe(1)
  })

  it('drives a full battle via wall-clock (turns fire at their due nextAt)', () => {
    const { clock, advance } = makeClock()
    const tk = createTicker({ clock, intervalMs: 5 })
    const rng = createRng(123)
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)

    const drive = () => {
      if (battle.over) return
      const next = peekNext(battle.queue)
      if (!next) return
      const delay = Math.max(0, next.nextAt - tk.scaledNow())
      tk.schedule(delay, () => {
        if (battle.over) return
        const n = peekNext(battle.queue)
        if (!n) return
        const action =
          n.side === 'enemy'
            ? chooseEnemyAction(battle, n.actorId, rng)
            : choosePartyAction(battle, n.actorId, 'dps', rng)
        performAction(battle, n.actorId, action, rng)
        drive()
      })
    }
    drive()

    let guard = 0
    while (!battle.over && guard < 4000) {
      advance(20)
      tk.flush()
      guard++
    }

    expect(battle.over).toBe(true)
    expect(getBattleResult(battle).status).toBe('won')
  })
})

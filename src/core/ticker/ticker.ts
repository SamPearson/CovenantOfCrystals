/**
 * M5 — rAF-independent wall-clock ticker (Phase 4 autobattle).
 *
 * The combat engine (`../combat/battle.ts`) is stateful: `performAction`
 * resolves exactly one actor's turn and mutates `BattleState`. A battle is
 * therefore driven by repeatedly resolving the front of the CTB queue
 * (`peekNext`) until it is `over`. This module supplies the *clock* that
 * decides when each turn is due.
 *
 * It must NOT depend on Phaser's frame loop: when a browser tab is hidden the
 * rAF loop (and with it `scene.time`) pauses, so a battle driven by
 * `this.time.delayedCall` freezes. A `setInterval` keeps firing (throttled to
 * ~1s while hidden, which is acceptable for turn-based pacing) and is fed by
 * `performance.now()`, making the ticker rAF-independent.
 *
 * The clock is injectable so unit tests can advance time deterministically via
 * `flush()` without real timers.
 */

export type Clock = () => number

export interface ScheduledTask {
  cancel(): void
}

export interface Ticker {
  /** Real wall-clock time in ms (whatever the injected `clock` returns). */
  now(): number
  /** Speed-scaled clock in ms — used for turn cadence. */
  scaledNow(): number
  /** Fire `cb` after `delayMs` of SCALED time. Returns a cancelable handle. */
  schedule(delayMs: number, cb: () => void): ScheduledTask
  /** Run `cb` on every processing pass (real-time cadence). Cancelable. */
  onTick(cb: () => void): ScheduledTask
  /** Begin the internal interval that drives processing. */
  start(): void
  /** Stop the internal interval (pending tasks are left intact but not fired). */
  stop(): void
  /** Run one processing pass immediately — for tests with an injected clock. */
  flush(): void
  /** Change the speed multiplier (1 = real time). */
  setSpeed(speed: number): void
}

export interface TickerOptions {
  clock?: Clock
  intervalMs?: number
  speed?: number
}

const defaultClock: Clock = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

/**
 * Creates a wall-clock ticker. Call `start()` to drive it via `setInterval`, or
 * call `flush()` manually (with an injected, advanced `clock`) in tests.
 */
export function createTicker(opts: TickerOptions = {}): Ticker {
  const clock = opts.clock ?? defaultClock
  const intervalMs = opts.intervalMs ?? 100
  let speed = opts.speed ?? 1
  let running = false
  let timer: ReturnType<typeof setInterval> | null = null
  let startedAt = clock()

  interface Timed {
    dueScaled: number
    cb: () => void
    done: boolean
  }
  const scheduled: Timed[] = []
  const tickers: { cb: () => void; done: boolean }[] = []

  const scaledNow = (): number => (clock() - startedAt) * speed

  const process = (): void => {
    const nowS = scaledNow()
    const due = scheduled
      .filter((t) => !t.done && t.dueScaled <= nowS)
      .sort((a, b) => a.dueScaled - b.dueScaled)
    for (const t of due) {
      t.done = true
      t.cb()
    }
    for (let i = scheduled.length - 1; i >= 0; i--) {
      if (scheduled[i]!.done) scheduled.splice(i, 1)
    }
    for (const tk of tickers) {
      if (!tk.done) tk.cb()
    }
  }

  return {
    now: () => clock(),
    scaledNow,
    schedule(delayMs, cb) {
      const task: Timed = { dueScaled: scaledNow() + delayMs, cb, done: false }
      scheduled.push(task)
      return { cancel: () => { task.done = true } }
    },
    onTick(cb) {
      const task = { cb, done: false }
      tickers.push(task)
      return { cancel: () => { task.done = true } }
    },
    start() {
      if (running) return
      running = true
      startedAt = clock()
      timer = setInterval(process, intervalMs)
    },
    stop() {
      running = false
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
    flush() {
      process()
    },
    setSpeed(next) {
      speed = next
    },
  }
}

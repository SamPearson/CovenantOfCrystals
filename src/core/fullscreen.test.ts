import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from './fullscreen'

type Listener = () => void

interface FakeDoc {
  documentElement: { requestFullscreen?: () => Promise<void> }
  fullscreenElement: unknown
  exitFullscreen: () => Promise<void>
  addEventListener(type: string, listener: Listener): void
  removeEventListener(type: string, listener: Listener): void
  emit(type: string): void
  listenerCount(type: string): number
}

/** Stand-in for the handful of DOM members the wrapper touches. */
function makeDoc(opts: { supported?: boolean } = {}): FakeDoc {
  const listeners = new Map<string, Set<Listener>>()
  const doc: FakeDoc = {
    documentElement: {
      requestFullscreen:
        opts.supported === false
          ? undefined
          : vi.fn(async () => {
              doc.fullscreenElement = {}
            }),
    },
    fullscreenElement: null,
    exitFullscreen: vi.fn(async () => {
      doc.fullscreenElement = null
    }),
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set<Listener>()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    emit(type) {
      for (const listener of listeners.get(type) ?? []) listener()
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0
    },
  }
  return doc
}

function stubDoc(doc: FakeDoc): void {
  vi.stubGlobal('document', doc as unknown as Document)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isFullscreenSupported', () => {
  it('is true when the documentElement exposes requestFullscreen', () => {
    stubDoc(makeDoc())
    expect(isFullscreenSupported()).toBe(true)
  })

  it('is false when the browser has no Fullscreen API', () => {
    stubDoc(makeDoc({ supported: false }))
    expect(isFullscreenSupported()).toBe(false)
  })

  it('is false without a DOM', () => {
    vi.stubGlobal('document', undefined)
    expect(isFullscreenSupported()).toBe(false)
  })
})

describe('isFullscreen', () => {
  it('is false when nothing is fullscreen', () => {
    stubDoc(makeDoc())
    expect(isFullscreen()).toBe(false)
  })

  it('is true while an element is fullscreen', () => {
    const doc = makeDoc()
    doc.fullscreenElement = {}
    stubDoc(doc)
    expect(isFullscreen()).toBe(true)
  })
})

describe('enterFullscreen', () => {
  it('requests fullscreen on the documentElement and reports success', async () => {
    const doc = makeDoc()
    stubDoc(doc)
    await expect(enterFullscreen()).resolves.toBe(true)
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(isFullscreen()).toBe(true)
  })

  it('resolves false when the API is missing instead of throwing', async () => {
    stubDoc(makeDoc({ supported: false }))
    await expect(enterFullscreen()).resolves.toBe(false)
  })

  it('resolves false when the browser rejects the request (no user gesture)', async () => {
    const doc = makeDoc()
    doc.documentElement.requestFullscreen = vi.fn(async () => {
      throw new Error('Permissions check failed')
    })
    stubDoc(doc)
    await expect(enterFullscreen()).resolves.toBe(false)
  })
})

describe('exitFullscreen', () => {
  it('leaves fullscreen and reports success', async () => {
    const doc = makeDoc()
    doc.fullscreenElement = {}
    stubDoc(doc)
    await expect(exitFullscreen()).resolves.toBe(true)
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(isFullscreen()).toBe(false)
  })

  it('resolves false when not fullscreen, without calling the API', async () => {
    const doc = makeDoc()
    stubDoc(doc)
    await expect(exitFullscreen()).resolves.toBe(false)
    expect(doc.exitFullscreen).not.toHaveBeenCalled()
  })

  it('resolves false when the browser rejects the request', async () => {
    const doc = makeDoc()
    doc.fullscreenElement = {}
    doc.exitFullscreen = vi.fn(async () => {
      throw new Error('Permissions check failed')
    })
    stubDoc(doc)
    await expect(exitFullscreen()).resolves.toBe(false)
  })
})

describe('toggleFullscreen', () => {
  it('enters when windowed', async () => {
    const doc = makeDoc()
    stubDoc(doc)
    await expect(toggleFullscreen()).resolves.toBe(true)
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(doc.exitFullscreen).not.toHaveBeenCalled()
  })

  it('exits when already fullscreen', async () => {
    const doc = makeDoc()
    doc.fullscreenElement = {}
    stubDoc(doc)
    await expect(toggleFullscreen()).resolves.toBe(true)
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled()
  })
})

describe('onFullscreenChange', () => {
  it('fires on fullscreenchange and stops after unsubscribing', () => {
    const doc = makeDoc()
    stubDoc(doc)
    const listener = vi.fn()
    const unsubscribe = onFullscreenChange(listener)

    doc.emit('fullscreenchange')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    doc.emit('fullscreenchange')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(doc.listenerCount('fullscreenchange')).toBe(0)
  })

  it('supports several listeners and only removes its own', () => {
    const doc = makeDoc()
    stubDoc(doc)
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribeFirst = onFullscreenChange(first)
    onFullscreenChange(second)

    doc.emit('fullscreenchange')
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    unsubscribeFirst()
    doc.emit('fullscreenchange')
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
  })

  it('returns a no-op unsubscribe without a DOM', () => {
    vi.stubGlobal('document', undefined)
    expect(() => onFullscreenChange(vi.fn())()).not.toThrow()
  })
})

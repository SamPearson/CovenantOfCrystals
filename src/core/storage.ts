/**
 * Storage abstraction layer for save persistence.
 * Supports localStorage (browser) and in-memory (testing/Node) backends.
 * Designed to be swappable for future cloud/API backends.
 */

export interface StorageBackend {
  /** Get a value by key. Returns null if not found. */
  getItem(key: string): string | null
  /** Set a value by key. */
  setItem(key: string, value: string): void
  /** Remove a value by key. */
  removeItem(key: string): void
  /** Get all keys. */
  keys(): string[]
  /** Clear all storage. */
  clear(): void
}

/** localStorage backend for browser environments. */
export class LocalStorageBackend implements StorageBackend {
  private storage: Storage | null = null

  constructor() {
    try {
      if (typeof localStorage !== 'undefined') {
        this.storage = localStorage
      }
    } catch {
      // Access denied (privacy mode, non-browser)
    }
  }

  getItem(key: string): string | null {
    return this.storage?.getItem(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.storage?.setItem(key, value)
  }

  removeItem(key: string): void {
    this.storage?.removeItem(key)
  }

  keys(): string[] {
    if (!this.storage) return []
    const result: string[] = []
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)
      if (key) result.push(key)
    }
    return result
  }

  clear(): void {
    this.storage?.clear()
  }
}

/** In-memory backend for testing / non-browser environments. */
export class MemoryBackend implements StorageBackend {
  private data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  keys(): string[] {
    return Array.from(this.data.keys())
  }

  clear(): void {
    this.data.clear()
  }
}

/** Default backend — localStorage if available, else memory. */
export function createDefaultBackend(): StorageBackend {
  try {
    if (typeof localStorage !== 'undefined') {
      return new LocalStorageBackend()
    }
  } catch {
    // Fall through to memory
  }
  return new MemoryBackend()
}

/** The active backend — can be swapped for testing or future cloud backends. */
let activeBackend: StorageBackend = createDefaultBackend()

/** Get the currently active storage backend. */
export function getBackend(): StorageBackend {
  return activeBackend
}

/** Set a custom storage backend (e.g., for testing or cloud sync). */
export function setBackend(backend: StorageBackend): void {
  activeBackend = backend
}

/** Keys used by the save system. */
export const STORAGE_KEYS = {
  /** Prefix for all profile keys. */
  profilePrefix: 'coc.profile.',
  /** Active profile ID key. */
  activeProfileKey: 'coc.activeProfile',
  /** Global settings key. */
  settingsKey: 'coc.settings',
} as const

/** Profile metadata (for the profile list without loading full data). */
export interface ProfileMeta {
  profileId: string
  displayName: string
  createdAt: number
  lastPlayed: number
  stats: { totalRuns: number; wins: number; losses: number }
  /** Approximate size of the full save in bytes (for UI). */
  sizeBytes?: number
}
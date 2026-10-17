/**
 * Core module entry point. Re-exporting everything so UI and tests can import
 * from a single path (`@core`).
 */

export * from './types'
export * from './id'
export * from './rng/rng'
export * from './validation'
export * from './storage'
export * from './inventory'
export * from './character'
export * from './boxes'
export * from './party'
export * from './equip'
export * from './items'
export * from './starter'
export * from './store'
export * from './themes'
export * from './combat'
export * from './data'
export * from './runs'
export * from './shop'

// Re-export save.service explicitly to avoid TS2308 ambiguity with store
export {
  createNewSave,
  loadActiveProfile,
  saveProfile,
  createProfile,
  deleteProfile,
  listProfiles,
  getActiveProfileId,
  setActiveProfileId,
  exportProfile,
  importProfile,
  renameProfile,
  duplicateProfile,
  clearAllProfiles,
  loadProfile,
  SCHEMA_VERSION,
  ALL_CLASSES,
  AUTOBATTLE_DEFAULTS,
} from './save.service'
/**
 * Structural validation for the save file format.
 * `validateSaveFile` throws a `ValidationError` if the shape is wrong.
 * Unknown/extra fields are ignored — this is forward-compatible with later
 * schema versions.
 */

import type {
  SaveFile,
  PlayerProfile,
  Character,
  Box,
  Inventory,
  GearInstance,
} from './types'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function validateDurability(v: unknown, path: string): void {
  if (!isRecord(v)) throw new ValidationError(`${path}: expected object`)
  if (v.kind === 'permanent') return
  if (v.kind === 'expires') {
    if (!isNumber(v.runsRemaining)) throw new ValidationError(`${path}.runsRemaining: expected number`)
    return
  }
  throw new ValidationError(`${path}.kind: unknown durability kind`)
}

function validateGear(v: unknown, path: string): GearInstance {
  if (!isRecord(v)) throw new ValidationError(`${path}: expected object`)
  if (!isString(v.id) || !isString(v.itemId)) {
    throw new ValidationError(`${path}: expected id and itemId strings`)
  }
  validateDurability(v.durability, `${path}.durability`)
  return v as unknown as GearInstance
}

function validateCharacter(v: unknown, path: string): Character {
  if (!isRecord(v)) throw new ValidationError(`${path}: expected object`)
  for (const key of ['id', 'classId', 'name'] as const) {
    if (!isString(v[key])) throw new ValidationError(`${path}.${key}: expected string`)
  }
  for (const key of ['level', 'xp'] as const) {
    if (!isNumber(v[key])) throw new ValidationError(`${path}.${key}: expected number`)
  }
  if (!isRecord(v.gear)) throw new ValidationError(`${path}.gear: expected object`)
  if (v.gear.weapon !== undefined && v.gear.weapon !== null) validateGear(v.gear.weapon, `${path}.gear.weapon`)
  if (v.gear.armor !== undefined && v.gear.armor !== null) validateGear(v.gear.armor, `${path}.gear.armor`)
  if (!Array.isArray(v.learnedSkills) || !v.learnedSkills.every(isString)) {
    throw new ValidationError(`${path}.learnedSkills: expected string[]`)
  }
  if (!Array.isArray(v.loadout) || !v.loadout.every(isString)) {
    throw new ValidationError(`${path}.loadout: expected string[]`)
  }
  validateDurability(v.durability, `${path}.durability`)
  if (!isRecord(v.earned)) throw new ValidationError(`${path}.earned: expected object`)
  if (!isNumber(v.earned.runs) || !isNumber(v.earned.wins)) {
    throw new ValidationError(`${path}.earned: expected runs and wins numbers`)
  }
  return v as unknown as Character
}

function validateBox(v: unknown, path: string): Box {
  if (!isRecord(v)) throw new ValidationError(`${path}: expected object`)
  if (!isString(v.id) || !isString(v.name)) throw new ValidationError(`${path}: expected id and name strings`)
  if (!Array.isArray(v.slots) || !v.slots.every((s) => s === null || isString(s))) {
    throw new ValidationError(`${path}.slots: expected (string|null)[]`)
  }
  return v as unknown as Box
}

function validateInventory(v: unknown, path: string): Inventory {
  if (!isRecord(v)) throw new ValidationError(`${path}: expected object`)
  if (
    !Array.isArray(v.items) ||
    !v.items.every((i) => isRecord(i) && isString(i.itemId) && isNumber(i.count))
  ) {
    throw new ValidationError(`${path}.items: expected {itemId,count}[]`)
  }
  if (!Array.isArray(v.gear) || !v.gear.every((g) => validateGear(g, `${path}.gear[]`))) {
    throw new ValidationError(`${path}.gear: expected gear instances`)
  }
  return v as unknown as Inventory
}

function validateProfile(v: unknown, path: string): PlayerProfile {
  if (!isRecord(v)) throw new ValidationError(`${path}: expected object`)
  for (const key of ['profileId', 'displayName'] as const) {
    if (!isString(v[key])) throw new ValidationError(`${path}.${key}: expected string`)
  }
  if (!isNumber(v.gold)) throw new ValidationError(`${path}.gold: expected number`)
  if (!Array.isArray(v.unlockedClasses) || !v.unlockedClasses.every(isString)) {
    throw new ValidationError(`${path}.unlockedClasses: expected string[]`)
  }
  if (!isRecord(v.characters)) throw new ValidationError(`${path}.characters: expected object`)
  for (const key of Object.keys(v.characters)) {
    validateCharacter(v.characters[key], `${path}.characters.${key}`)
  }
  if (!Array.isArray(v.boxes)) throw new ValidationError(`${path}.boxes: expected array`)
  v.boxes.forEach((b, i) => validateBox(b, `${path}.boxes[${i}]`))
  validateInventory(v.inventory, `${path}.inventory`)
  if (!Array.isArray(v.party) || !v.party.every(isString)) {
    throw new ValidationError(`${path}.party: expected string[]`)
  }
  if (!isRecord(v.stats)) throw new ValidationError(`${path}.stats: expected object`)
  for (const key of ['totalRuns', 'wins', 'losses'] as const) {
    if (!isNumber(v.stats[key])) throw new ValidationError(`${path}.stats.${key}: expected number`)
  }
  if (!isNumber(v.createdAt)) throw new ValidationError(`${path}.createdAt: expected number`)
  return v as unknown as PlayerProfile
}

export function validateSaveFile(v: unknown): SaveFile {
  if (!isRecord(v)) throw new ValidationError('save: expected object')
  if (!isNumber(v.schemaVersion)) throw new ValidationError('save.schemaVersion: expected number')
  if (!isNumber(v.savedAt)) throw new ValidationError('save.savedAt: expected number')
  validateProfile(v.profile, 'save.profile')
  return v as unknown as SaveFile
}

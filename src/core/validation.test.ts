import { describe, expect, it } from 'vitest'
import { validateSaveFile, ValidationError } from './validation'
import { createNewSave } from './save.service'

describe('validateSaveFile', () => {
  it('accepts a well-formed save', () => {
    const save = createNewSave('prof-1', 'Ada')
    expect(() => validateSaveFile(save)).not.toThrow()
  })

  it('rejects non-object roots', () => {
    expect(() => validateSaveFile(null)).toThrow(ValidationError)
    expect(() => validateSaveFile('nope')).toThrow(ValidationError)
  })

  it('rejects missing profile', () => {
    expect(() => validateSaveFile({ schemaVersion: 1, savedAt: 1 })).toThrow(ValidationError)
  })

  it('rejects invalid character records', () => {
    const save = createNewSave('prof-1', 'Ada')
    save.profile.characters['c1'] = { id: 'c1', classId: 'knight' } as never
    expect(() => validateSaveFile(save)).toThrow(ValidationError)
  })

  it('accepts characters with optional gear omitted', () => {
    const save = createNewSave('prof-1', 'Ada')
    save.profile.characters['c1'] = {
      id: 'c1',
      classId: 'knight',
      name: 'Kael',
      level: 1,
      xp: 0,
      gear: {},
      learnedSkills: ['slashing_strike'],
      loadout: ['slashing_strike'],
      durability: { kind: 'permanent' },
      earned: { runs: 0, wins: 0 },
    }
    expect(() => validateSaveFile(save)).not.toThrow()
  })

  it('rejects an unknown durability kind', () => {
    const save = createNewSave('prof-1', 'Ada')
    save.profile.characters['c1'] = {
      id: 'c1',
      classId: 'knight',
      name: 'Kael',
      level: 1,
      xp: 0,
      gear: {},
      learnedSkills: ['slashing_strike'],
      loadout: ['slashing_strike'],
      durability: { kind: 'half' } as never,
      earned: { runs: 0, wins: 0 },
    }
    expect(() => validateSaveFile(save)).toThrow(/durability/)
  })
})

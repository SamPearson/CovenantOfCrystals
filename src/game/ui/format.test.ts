import { describe, expect, it } from 'vitest'
import {
  durabilityLabel,
  statLabel,
  statList,
  itemTypeLabel,
  roleLabel,
  elementLabel,
  truncate,
} from './format'

describe('durabilityLabel', () => {
  it('labels permanent assets', () => {
    expect(durabilityLabel({ kind: 'permanent' })).toBe('Permanent')
  })

  it('pluralizes run counts correctly', () => {
    expect(durabilityLabel({ kind: 'expires', runsRemaining: 1 })).toBe('1 run left')
    expect(durabilityLabel({ kind: 'expires', runsRemaining: 3 })).toBe('3 runs left')
  })
})

describe('stat helpers', () => {
  it('uppercases stat keys', () => {
    expect(statLabel('atk')).toBe('ATK')
    expect(statLabel('res')).toBe('RES')
  })

  it('lists stats in a canonical order', () => {
    const stats = { hp: 1, atk: 2, def: 3, mag: 4, res: 5, spd: 6 }
    const keys = statList(stats).map((s) => s.key)
    expect(keys).toEqual(['hp', 'atk', 'def', 'mag', 'res', 'spd'])
    expect(statList(stats)[0]!.value).toBe(1)
  })
})

describe('labels', () => {
  it('capitalizes item, role, and element labels', () => {
    expect(itemTypeLabel('weapon')).toBe('Weapon')
    expect(roleLabel('healer')).toBe('Healer')
    expect(elementLabel('frost')).toBe('Frost')
    expect(elementLabel('none')).toBe('—')
  })
})

describe('truncate', () => {
  it('keeps short strings intact', () => {
    expect(truncate('Kael', 4)).toBe('Kael')
  })

  it('ellipsizes longer strings', () => {
    expect(truncate('Kaelric', 4)).toBe('Kae…')
  })
})

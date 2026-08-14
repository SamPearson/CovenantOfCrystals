import { describe, expect, it } from 'vitest'
import { statusIcon, statusLabel } from './status-icons'
import type { ActiveStatus } from '../../core/combat/types'

describe('statusLabel', () => {
  it('uses a three-letter code for dot statuses', () => {
    const burn: ActiveStatus = { kind: 'burn', power: 5, duration: 3 }
    expect(statusLabel(burn)).toBe('BRN')
  })

  it('annotates buffs and debuffs with the affected stat', () => {
    const buff: ActiveStatus = { kind: 'statBuff', stat: 'atk', power: 1.2, duration: 3 }
    const debuff: ActiveStatus = { kind: 'statDebuff', stat: 'def', power: 0.8, duration: 2 }
    expect(statusLabel(buff)).toBe('▲ATK')
    expect(statusLabel(debuff)).toBe('▼DEF')
  })
})

describe('statusIcon', () => {
  it('maps tones for positive, negative and neutral statuses', () => {
    expect(statusIcon({ kind: 'regen', power: 3, duration: 3 }).tone).toBe('good')
    expect(statusIcon({ kind: 'poison', power: 5, duration: 3 }).tone).toBe('bad')
    expect(statusIcon({ kind: 'sleep', duration: 2 }).tone).toBe('info')
    expect(statusIcon({ kind: 'statBuff', stat: 'spd', power: 1.1, duration: 2 }).label).toBe('▲SPD')
  })
})
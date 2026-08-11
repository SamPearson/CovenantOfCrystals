import { describe, expect, it } from 'vitest'
import { CLASSES, SKILLS, ITEMS, ENEMIES, elementMultiplier } from './index'

describe('data integrity', () => {
  it('defines the starter classes with unique ids', () => {
    const ids = CLASSES.map((c) => c.id)
    expect(ids.length).toBe(7)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('class learn sets reference known skills at valid levels', () => {
    for (const c of CLASSES) {
      for (const entry of c.learnSet) {
        expect(SKILLS[entry.skillId], `class ${c.id} skill ${entry.skillId}`).toBeDefined()
        expect(entry.level).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('enemy skill references are known', () => {
    for (const e of Object.values(ENEMIES)) {
      for (const s of e.skills) {
        expect(SKILLS[s], `enemy ${e.id} skill ${s}`).toBeDefined()
      }
    }
  })

  it('tomes grant a known skill', () => {
    for (const i of Object.values(ITEMS)) {
      if (i.type === 'tome') {
        expect(i.skill).toBeDefined()
        expect(SKILLS[i.skill!], `tome ${i.id}`).toBeDefined()
      }
    }
  })
})

describe('element chart', () => {
  it('fire is strong vs frost and resisted by water', () => {
    expect(elementMultiplier('fire', 'frost')).toBe(2)
    expect(elementMultiplier('fire', 'water')).toBe(0.5)
  })

  it('none has no multipliers', () => {
    expect(elementMultiplier('none', 'fire')).toBe(1)
    expect(elementMultiplier('none', 'none')).toBe(1)
  })
})

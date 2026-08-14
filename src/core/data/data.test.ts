import { describe, expect, it } from 'vitest'
import type { AiScript } from '../combat/ai'
import type { AiProfileId } from '../types'
import { CLASSES, SKILLS, ITEMS, ENEMIES, elementMultiplier, AI_SCRIPTS, getAiScript } from './index'
import { PLAYER_SKILL_IDS, ENEMY_ONLY_SKILL_IDS, SKILL_SCROLLS, SKILL_TOMES, scrollFor, tomeFor } from './skill-items'

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

  it('scrolls cast a known skill', () => {
    for (const i of Object.values(ITEMS)) {
      if (i.type === 'scroll') {
        expect(i.castSkill).toBeDefined()
        expect(SKILLS[i.castSkill!], `scroll ${i.id}`).toBeDefined()
      }
    }
  })
})

describe('skill items', () => {
  it('every player skill produces a scroll and a tome', () => {
    for (const id of PLAYER_SKILL_IDS) {
      expect(scrollFor(id).id).toBe(`scroll_${id}`)
      expect(tomeFor(id).id).toBe(`tome_${id}`)
    }
  })

  it('skill items are registered in ITEMS', () => {
    expect(Object.keys(ITEMS).length).toBeGreaterThanOrEqual(Object.keys(SKILL_SCROLLS).length + Object.keys(SKILL_TOMES).length)
    for (const [id, item] of Object.entries(SKILL_SCROLLS)) {
      expect(ITEMS[id], `scroll ${id}`).toBe(item)
    }
    for (const [id, item] of Object.entries(SKILL_TOMES)) {
      expect(ITEMS[id], `tome ${id}`).toBe(item)
    }
  })

  it('enemy-only skills are excluded from the player list', () => {
    for (const id of ENEMY_ONLY_SKILL_IDS) {
      expect(PLAYER_SKILL_IDS).not.toContain(id)
    }
    expect(PLAYER_SKILL_IDS.length).toBeGreaterThan(0)
  })

  it('scrolls and tomes resolve to a known skill and are non-empty', () => {
    for (const id of PLAYER_SKILL_IDS) {
      const scroll = scrollFor(id)
      const tome = tomeFor(id)
      expect(scroll.rarity).toBeDefined()
      expect(tome.rarity).toBeDefined()
      expect(scroll.castSkill).toBe(id)
      expect(tome.skill).toBe(id)
    }
  })
})

describe('AI profile scripts', () => {
  const PROFILES: AiProfileId[] = ['minion', 'tanky', 'glass', 'boss']

  it('covers exactly the enemy AiProfileId union', () => {
    expect(Object.keys(AI_SCRIPTS).sort()).toEqual([...PROFILES].sort())
  })

  it('every profile is assigned to at least one existing enemy', () => {
    const used = new Set(Object.values(ENEMIES).map((e) => e.ai))
    expect([...used].sort()).toEqual([...PROFILES].sort())
  })

  it('every enemy has a known ai profile with a script', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(() => getAiScript(e.ai), `enemy ${e.id} ai ${e.ai}`).not.toThrow()
      expect(AI_SCRIPTS[e.ai].length, `enemy ${e.id}`).toBeGreaterThan(0)
    }
  })

  it('every script ends in a catch-all so a move always resolves', () => {
    for (const [profile, script] of Object.entries(AI_SCRIPTS) as [AiProfileId, AiScript][]) {
      expect(script.length, profile).toBeGreaterThan(0)
      expect(script[script.length - 1]!.condition.kind, profile).toBe('always')
    }
  })

  it('explicit scripted skillIds are known to some enemy of the profile', () => {
    const knownByProfile = new Map<AiProfileId, Set<string>>()
    for (const e of Object.values(ENEMIES)) {
      const known = knownByProfile.get(e.ai) ?? new Set<string>()
      for (const s of e.skills) known.add(s)
      knownByProfile.set(e.ai, known)
    }
    for (const [profile, script] of Object.entries(AI_SCRIPTS) as [AiProfileId, AiScript][]) {
      for (const entry of script) {
        if (entry.action.kind === 'skill' && entry.action.skillId) {
          expect(knownByProfile.get(profile)?.has(entry.action.skillId), `${profile} skill ${entry.action.skillId}`)
            .toBe(true)
        }
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

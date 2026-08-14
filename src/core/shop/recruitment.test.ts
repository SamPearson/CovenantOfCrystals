/**
 * Between-runs recruitment (Phase 3 M4, `phase-3-run-loop-plan.md` §7/§8):
 * 2–3 random level-1 permanent offers at a flat price; recruiting pays gold,
 * boxes the character and removes the offer; stock refreshes on run completion.
 */

import { describe, expect, it } from 'vitest'
import { BALANCE } from '../data/balance'
import { createNewSave } from '../save.service'
import { findCharacterBox } from '../boxes'
import type { Character, PlayerProfile, RecruitOffer } from '../types'
import { createRng } from '../rng/rng'
import {
  canRecruit,
  generateRecruitOffers,
  recruit,
  refreshRecruitment,
} from './recruitment'

function profile(): PlayerProfile {
  return createNewSave('recruit-test').profile
}

function offerIds(offers: RecruitOffer[]): string[] {
  return offers.map((o) => o.id)
}

describe('generateRecruitOffers', () => {
  it('returns an empty list when there are no unlocked classes', () => {
    expect(generateRecruitOffers(createRng(1), [], 3)).toEqual([])
  })

  it('generates exactly the requested number of offers', () => {
    expect(generateRecruitOffers(createRng(1), ['knight'], 2).length).toBe(2)
    expect(generateRecruitOffers(createRng(1), ['knight'], 3).length).toBe(3)
  })

  it('only uses unlocked classes', () => {
    const p = profile()
    p.unlockedClasses = ['knight', 'mage']

    for (let seed = 0; seed < 50; seed++) {
      const offers = generateRecruitOffers(createRng(seed), p.unlockedClasses, 3)
      for (const o of offers) {
        expect(p.unlockedClasses).toContain(o.character.classId)
      }
    }
  })

  it('creates permanent, level-1 characters', () => {
    const offers = generateRecruitOffers(createRng(1), ['knight', 'mage', 'rogue'], 3)
    for (const o of offers) {
      expect(o.character.level).toBe(1)
      expect(o.character.earned).toEqual({ runs: 0, wins: 0 })
      expect((o.character as Character).durability).toEqual({ kind: 'permanent' })
    }
  })

  it('charges the flat recruit price from balance', () => {
    const offers = generateRecruitOffers(createRng(1), ['knight'], 3)
    for (const o of offers) {
      expect(o.price).toBe(BALANCE.economy.recruitPrice)
    }
  })

  it('is seeded and reproducible', () => {
    const a = generateRecruitOffers(createRng(7), ['knight', 'mage'], 3).map((o) => o.character.classId)
    const b = generateRecruitOffers(createRng(7), ['knight', 'mage'], 3).map((o) => o.character.classId)
    expect(b).toEqual(a)
  })

  it('changes with the seed', () => {
    const a = generateRecruitOffers(createRng(7), ['knight', 'mage'], 3).map((o) => o.character.classId)
    const b = generateRecruitOffers(createRng(8), ['knight', 'mage'], 3).map((o) => o.character.classId)
    expect(b).not.toEqual(a)
  })
})

describe('refreshRecruitment', () => {
  it('regenerates 2–3 offers on refresh', () => {
    const p = profile()
    for (let seed = 0; seed < 30; seed++) {
      const offers = refreshRecruitment(p, createRng(seed))
      expect(offers.length).toBeGreaterThanOrEqual(2)
      expect(offers.length).toBeLessThanOrEqual(3)
    }
  })
})

describe('recruit', () => {
  it('pays gold, boxes the character and drops the offer', () => {
    const p = profile()
    refreshRecruitment(p, createRng(1))
    const recruitedId = p.recruitment[0]!.id
    const charId = p.recruitment[0]!.character.id
    const price = p.recruitment[0]!.price
    const before = p.gold

    const result = recruit(p, recruitedId)

    expect(result.ok).toBe(true)
    expect(result.price).toBe(price)
    expect(p.gold).toBe(before - price)
    expect(p.characters[charId]).toBeDefined()
    expect(offerIds(p.recruitment)).not.toContain(recruitedId)
    expect(findCharacterBox(p, charId)).not.toBeNull()
  })

  it('rejects unknown offer ids without charging', () => {
    const p = profile()
    refreshRecruitment(p, createRng(1))
    const before = p.gold

    const result = recruit(p, 'nope')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Unknown offer: nope')
    expect(p.gold).toBe(before)
  })

  it('rejects offers the player cannot afford', () => {
    const p = profile()
    refreshRecruitment(p, createRng(1))
    const offerId = p.recruitment[0]!.id
    p.gold = 5

    expect(canRecruit(p, offerId).ok).toBe(false)
    const result = recruit(p, offerId)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Not enough gold')
    expect(p.gold).toBe(5)
    expect(Object.keys(p.characters)).toHaveLength(0)
  })

  it('does not affect other offers', () => {
    const p = profile()
    refreshRecruitment(p, createRng(1))
    const otherId = p.recruitment[1]!.id
    recruit(p, p.recruitment[0]!.id)
    expect(offerIds(p.recruitment)).toContain(otherId)
  })
})
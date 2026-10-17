/**
 * Between-runs recruitment (Phase 3 M4, `phase-3-run-loop-plan.md` §5/§7):
 * 2–3 random level-1 permanent characters from the unlocked classes at a
 * flat gold price (decision S6). Offers refresh on run completion.
 *
 * `generateRecruitOffers` is pure/seeded; `recruit` mutates the profile the
 * same way the other core modules do (the store wraps it in `mutate()` later).
 *
 * Phase 5: Town-aware recruitment — each town has its own class pool, weights,
 * and level range.
 */

import { BALANCE } from '../data/balance'
import { TOWNS } from '../data'
import type { PlayerProfile, RecruitOffer } from '../types'
import { weightedPick, intBetween, type Rng } from '../rng/rng'
import { createCharacter } from '../character'
import { uuid } from '../id'
import { addCharacterToBox, ensureBoxCount } from '../boxes'

export interface RecruitActionResult {
  ok: boolean
  price?: number
  error?: string
}

/** Generates `count` permanent offers from the unlocked classes, filtered by town. */
export function generateRecruitOffers(
  rng: Rng,
  unlockedClasses: string[],
  count: number,
  townId: string = 'aldwyn'
): RecruitOffer[] {
  const town = TOWNS[townId] ?? TOWNS.aldwyn
  const available = unlockedClasses.filter((c) => town.recruitClassPool.includes(c))
  if (available.length === 0) return []
  const offers: RecruitOffer[] = []
  const [minLevel, maxLevel] = town.recruitLevelRange ?? [1, 1]
  for (let i = 0; i < count; i++) {
    const classId = weightedPick(rng, available, (c) => town.recruitClassWeights?.[c] ?? 1)
    const level = intBetween(rng, minLevel, maxLevel)
    const character = createCharacter({ classId, level, rng })
    offers.push({
      id: uuid(),
      character,
      price: BALANCE.economy.recruitPrice,
    })
  }
  return offers
}

/** Regenerates `profile.recruitment` with 2–3 offers for a specific town (call at run completion). */
export function refreshRecruitment(profile: PlayerProfile, rng: Rng, townId: string = 'aldwyn'): RecruitOffer[] {
  const count = 2 + Math.floor(rng() * 2)
  profile.recruitment = generateRecruitOffers(rng, profile.unlockedClasses, count, townId)
  return profile.recruitment
}

/** Pure guard: may the player recruit this offer? */
export function canRecruit(profile: PlayerProfile, offerId: string): RecruitActionResult {
  const offer = profile.recruitment.find((o) => o.id === offerId)
  if (!offer) return { ok: false, error: `Unknown offer: ${offerId}` }
  if (profile.gold < offer.price) return { ok: false, error: 'Not enough gold' }
  return { ok: true, price: offer.price }
}

/** Recruits the offer: pays gold, adds the character to a box, drops the offer. */
export function recruit(profile: PlayerProfile, offerId: string): RecruitActionResult {
  const check = canRecruit(profile, offerId)
  if (!check.ok || check.price === undefined) return check
  const offer = profile.recruitment.find((o) => o.id === offerId)
  if (!offer) return check

  profile.gold -= check.price
  profile.characters[offer.character.id] = offer.character
  profile.recruitment = profile.recruitment.filter((o) => o.id !== offerId)

  ensureBoxCount(profile)
  const boxIndex = profile.boxes.findIndex((box) => box.slots.includes(null))
  if (boxIndex !== -1) {
    addCharacterToBox(profile, boxIndex, offer.character.id)
  }
  return check
}

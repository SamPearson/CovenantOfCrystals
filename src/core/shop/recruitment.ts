/**
 * Between-runs recruitment (Phase 3 M4, `phase-3-run-loop-plan.md` §5/§7):
 * 2–3 random level-1 permanent characters from the unlocked classes at a
 * flat gold price (decision S6). Offers refresh on run completion.
 *
 * `generateRecruitOffers` is pure/seeded; `recruit` mutates the profile the
 * same way the other core modules do (the store wraps it in `mutate()` later).
 */

import { BALANCE } from '../data/balance'
import type { PlayerProfile, RecruitOffer } from '../types'
import { pick, type Rng } from '../rng/rng'
import { createCharacter } from '../character'
import { uuid } from '../id'
import { addCharacterToBox, ensureBoxCount } from '../boxes'

export interface RecruitActionResult {
  ok: boolean
  price?: number
  error?: string
}

/** Generates `count` level-1 permanent offers from the unlocked classes. */
export function generateRecruitOffers(
  rng: Rng,
  unlockedClasses: string[],
  count: number,
): RecruitOffer[] {
  if (unlockedClasses.length === 0) return []
  const offers: RecruitOffer[] = []
  for (let i = 0; i < count; i++) {
    const classId = pick(rng, unlockedClasses)
    const character = createCharacter({ classId, level: 1, rng })
    offers.push({
      id: uuid(),
      character,
      price: BALANCE.economy.recruitPrice,
    })
  }
  return offers
}

/** Regenerates `profile.recruitment` with 2–3 offers (call at run completion). */
export function refreshRecruitment(profile: PlayerProfile, rng: Rng): RecruitOffer[] {
  const count = 2 + Math.floor(rng() * 2)
  profile.recruitment = generateRecruitOffers(rng, profile.unlockedClasses, count)
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

/**
 * BattleScene setup helpers — pure and Phaser-free so they can be unit-tested
 * (`docs/architecture.md` §2). The scene consumes these to build a battle from
 * the meta profile without mutating any stored state.
 */

import { getEnemy } from '../../core/data'
import { PARTY_SIZE } from '../../core/types'
import type { Character, EnemyDef, PlayerProfile } from '../../core/types'

/** The fixed scripted squad used by the M5 test battle (2 slimes + 1 goblin). */
export function scriptedSquad(): EnemyDef[] {
  return [getEnemy('slime'), getEnemy('slime'), getEnemy('goblin')]
}

/**
 * Resolve the characters that fight in the test battle. Prefers the profile's
 * party; when the party is empty (e.g. a fresh save), falls back to the first
 * `PARTY_SIZE` characters found in the boxes as a read-only convenience so the
 * battle is playable immediately. Never mutates profile state.
 */
export function partyForBattle(profile: PlayerProfile): Character[] {
  const byId = (id: string): Character | undefined => profile.characters[id]

  const fromParty = profile.party.map(byId).filter((c): c is Character => c !== undefined)
  if (fromParty.length > 0) return fromParty

  const roster: Character[] = []
  for (const box of profile.boxes) {
    for (const slot of box.slots) {
      if (roster.length >= PARTY_SIZE) break
      const c = slot ? byId(slot) : undefined
      if (c && !roster.some((r) => r.id === c.id)) roster.push(c)
    }
  }
  return roster
}
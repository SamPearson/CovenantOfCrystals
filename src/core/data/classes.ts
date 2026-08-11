import type { ClassDef } from '../types'

/**
 * Class archetypes (docs/party-and-equipment.md §2).
 * Balance numbers are stubs — tuned in the Phase 5 data pass.
 */
export const CLASSES: ClassDef[] = [
  {
    id: 'knight',
    name: 'Knight',
    role: 'tank',
    element: 'earth',
    baseStats: { hp: 90, atk: 14, def: 16, mag: 4, res: 8, spd: 6 },
    growth: { hp: 12, atk: 2, def: 3, mag: 1, res: 2, spd: 1 },
    learnSet: [
      { skillId: 'slashing_strike', level: 1 },
      { skillId: 'shield_bash', level: 3 },
      { skillId: 'iron_guard', level: 5 },
    ],
    loadoutSize: 4,
    passive: 'fortress',
  },
  {
    id: 'berserker',
    name: 'Berserker',
    role: 'melee',
    element: 'fire',
    baseStats: { hp: 75, atk: 20, def: 10, mag: 4, res: 6, spd: 8 },
    growth: { hp: 10, atk: 4, def: 2, mag: 1, res: 1, spd: 2 },
    learnSet: [
      { skillId: 'flame_slash', level: 1 },
      { skillId: 'berserk_strike', level: 2 },
      { skillId: 'battle_fury', level: 4 },
    ],
    loadoutSize: 4,
    passive: 'reckless',
  },
  {
    id: 'rogue',
    name: 'Rogue',
    role: 'melee',
    element: 'shadow',
    baseStats: { hp: 60, atk: 18, def: 8, mag: 6, res: 6, spd: 14 },
    growth: { hp: 8, atk: 3, def: 1, mag: 1, res: 1, spd: 3 },
    learnSet: [
      { skillId: 'backstab', level: 1 },
      { skillId: 'poison_blade', level: 2 },
      { skillId: 'shadow_bolt', level: 3 },
    ],
    loadoutSize: 4,
  },
  {
    id: 'ranger',
    name: 'Ranger',
    role: 'ranged',
    element: 'water',
    baseStats: { hp: 65, atk: 15, def: 9, mag: 8, res: 8, spd: 11 },
    growth: { hp: 8, atk: 3, def: 1, mag: 2, res: 1, spd: 2 },
    learnSet: [
      { skillId: 'rapid_shot', level: 1 },
      { skillId: 'frost_arrow', level: 2 },
      { skillId: 'tri_shot', level: 4 },
    ],
    loadoutSize: 4,
  },
  {
    id: 'mage',
    name: 'Mage',
    role: 'mage',
    element: 'fire',
    baseStats: { hp: 50, atk: 6, def: 6, mag: 18, res: 10, spd: 9 },
    growth: { hp: 6, atk: 1, def: 1, mag: 4, res: 2, spd: 1 },
    learnSet: [
      { skillId: 'fireball', level: 1 },
      { skillId: 'frost_bite', level: 2 },
      { skillId: 'flame_wave', level: 3 },
      { skillId: 'arcane_bolt', level: 5 },
    ],
    loadoutSize: 4,
  },
  {
    id: 'healer',
    name: 'Healer',
    role: 'healer',
    element: 'holy',
    baseStats: { hp: 55, atk: 7, def: 7, mag: 12, res: 16, spd: 8 },
    growth: { hp: 7, atk: 1, def: 1, mag: 3, res: 3, spd: 1 },
    learnSet: [
      { skillId: 'heal', level: 1 },
      { skillId: 'cleanse', level: 2 },
      { skillId: 'holy_light', level: 3 },
      { skillId: 'greater_heal', level: 5 },
    ],
    loadoutSize: 4,
  },
  {
    id: 'bard',
    name: 'Bard',
    role: 'support',
    element: 'frost',
    baseStats: { hp: 60, atk: 8, def: 8, mag: 12, res: 12, spd: 12 },
    growth: { hp: 7, atk: 1, def: 1, mag: 3, res: 2, spd: 2 },
    learnSet: [
      { skillId: 'battle_anthem', level: 1 },
      { skillId: 'ice_song', level: 2 },
      { skillId: 'soothing_song', level: 3 },
      { skillId: 'slow_rhythm', level: 4 },
    ],
    loadoutSize: 4,
  },
]

import type { EnemyDef } from '../types'

/**
 * Enemy definitions. Stubs for the Phase 2/3 combat engine.
 * `ai` references a behavior profile id ('minion' | 'tanky' | 'glass' | 'boss').
 */
export const ENEMIES: Record<string, EnemyDef> = {
  slime: {
    id: 'slime', name: 'Slime', element: 'water', level: 1,
    stats: { hp: 40, atk: 8, def: 6, mag: 3, res: 4, spd: 4 },
    skills: ['tackle'], ai: 'minion',
  },
  goblin: {
    id: 'goblin', name: 'Goblin', element: 'none', level: 2,
    stats: { hp: 45, atk: 12, def: 6, mag: 3, res: 4, spd: 8 },
    skills: ['goblin_swipe'], ai: 'minion',
  },
  fire_elemental: {
    id: 'fire_elemental', name: 'Fire Elemental', element: 'fire', level: 3,
    stats: { hp: 55, atk: 10, def: 7, mag: 14, res: 8, spd: 9 },
    skills: ['ember'], ai: 'glass',
  },
  frost_wraith: {
    id: 'frost_wraith', name: 'Frost Wraith', element: 'frost', level: 3,
    stats: { hp: 50, atk: 9, def: 6, mag: 15, res: 9, spd: 10 },
    skills: ['frost_breath'], ai: 'glass',
  },
  shadow_assassin: {
    id: 'shadow_assassin', name: 'Shadow Assassin', element: 'shadow', level: 4,
    stats: { hp: 60, atk: 16, def: 8, mag: 8, res: 7, spd: 13 },
    skills: ['shadow_strike'], ai: 'glass',
  },
  earth_golem: {
    id: 'earth_golem', name: 'Earth Golem', element: 'earth', level: 4,
    stats: { hp: 110, atk: 13, def: 14, mag: 4, res: 10, spd: 5 },
    skills: ['rock_smash'], ai: 'tanky',
  },
  holy_guardian: {
    id: 'holy_guardian', name: 'Holy Guardian', element: 'holy', level: 5,
    stats: { hp: 100, atk: 12, def: 12, mag: 12, res: 14, spd: 7 },
    skills: ['holy_smite'], ai: 'tanky',
  },
  goblin_king: {
    id: 'goblin_king', name: 'Goblin King', element: 'none', level: 6, isBoss: true,
    stats: { hp: 180, atk: 18, def: 12, mag: 10, res: 10, spd: 9 },
    skills: ['goblin_swipe', 'rock_smash'], ai: 'boss',
  },
}

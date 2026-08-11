import type { SkillDef } from '../types'

/**
 * Skill definitions. Balance numbers are stubs — tuned in the Phase 5 data
 * pass. Includes a few enemy-only skills (tackle, ember, …).
 */
export const SKILLS: Record<string, SkillDef> = {
  // Knight
  slashing_strike: {
    id: 'slashing_strike', name: 'Slashing Strike', kind: 'damage', element: 'earth',
    power: 45, scaling: 'atk', targets: 'single', cost: 4,
  },
  shield_bash: {
    id: 'shield_bash', name: 'Shield Bash', kind: 'damage', element: 'earth',
    power: 35, scaling: 'atk', targets: 'single', cost: 5, cooldown: 2,
    effect: { kind: 'statDebuff', stat: 'def', power: 0.8, duration: 2 },
  },
  iron_guard: {
    id: 'iron_guard', name: 'Iron Guard', kind: 'buff', element: 'earth',
    power: 0, scaling: 'hp', targets: 'self', cost: 6, cooldown: 3,
    effect: { kind: 'statBuff', stat: 'def', power: 1.3, duration: 3 },
  },

  // Berserker
  flame_slash: {
    id: 'flame_slash', name: 'Flame Slash', kind: 'damage', element: 'fire',
    power: 50, scaling: 'atk', targets: 'single', cost: 5,
  },
  berserk_strike: {
    id: 'berserk_strike', name: 'Berserk Strike', kind: 'damage', element: 'fire',
    power: 60, scaling: 'atk', targets: 'single', cost: 6, cooldown: 1,
  },
  battle_fury: {
    id: 'battle_fury', name: 'Battle Fury', kind: 'buff', element: 'fire',
    power: 0, scaling: 'hp', targets: 'self', cost: 6, cooldown: 3,
    effect: { kind: 'statBuff', stat: 'atk', power: 1.25, duration: 3 },
  },

  // Rogue
  backstab: {
    id: 'backstab', name: 'Backstab', kind: 'damage', element: 'shadow',
    power: 55, scaling: 'atk', targets: 'single', cost: 5,
  },
  poison_blade: {
    id: 'poison_blade', name: 'Poison Blade', kind: 'damage', element: 'shadow',
    power: 40, scaling: 'atk', targets: 'single', cost: 4,
    effect: { kind: 'poison', power: 5, duration: 3 },
  },
  shadow_bolt: {
    id: 'shadow_bolt', name: 'Shadow Bolt', kind: 'damage', element: 'shadow',
    power: 45, scaling: 'mag', targets: 'single', cost: 5,
  },

  // Ranger
  rapid_shot: {
    id: 'rapid_shot', name: 'Rapid Shot', kind: 'damage', element: 'water',
    power: 30, scaling: 'atk', targets: 'single', cost: 3,
  },
  frost_arrow: {
    id: 'frost_arrow', name: 'Frost Arrow', kind: 'damage', element: 'frost',
    power: 45, scaling: 'atk', targets: 'single', cost: 5,
  },
  tri_shot: {
    id: 'tri_shot', name: 'Tri-Shot', kind: 'damage', element: 'none',
    power: 30, scaling: 'atk', targets: 'single', cost: 4,
  },

  // Mage
  fireball: {
    id: 'fireball', name: 'Fireball', kind: 'damage', element: 'fire',
    power: 55, scaling: 'mag', targets: 'single', cost: 6,
  },
  frost_bite: {
    id: 'frost_bite', name: 'Frost Bite', kind: 'damage', element: 'frost',
    power: 45, scaling: 'mag', targets: 'single', cost: 5,
    effect: { kind: 'statDebuff', stat: 'spd', power: 0.7, duration: 2 },
  },
  flame_wave: {
    id: 'flame_wave', name: 'Flame Wave', kind: 'damage', element: 'fire',
    power: 40, scaling: 'mag', targets: 'all-enemies', cost: 8, cooldown: 2,
  },
  arcane_bolt: {
    id: 'arcane_bolt', name: 'Arcane Bolt', kind: 'damage', element: 'none',
    power: 40, scaling: 'mag', targets: 'single', cost: 4,
  },

  // Healer
  heal: {
    id: 'heal', name: 'Heal', kind: 'heal', element: 'holy',
    power: 60, scaling: 'hp', targets: 'single', cost: 5,
  },
  cleanse: {
    id: 'cleanse', name: 'Cleanse', kind: 'utility', element: 'holy',
    power: 0, scaling: 'hp', targets: 'single', cost: 4,
  },
  holy_light: {
    id: 'holy_light', name: 'Holy Light', kind: 'damage', element: 'holy',
    power: 45, scaling: 'mag', targets: 'single', cost: 5,
  },
  greater_heal: {
    id: 'greater_heal', name: 'Greater Heal', kind: 'heal', element: 'holy',
    power: 120, scaling: 'hp', targets: 'single', cost: 8,
  },

  // Bard
  battle_anthem: {
    id: 'battle_anthem', name: 'Battle Anthem', kind: 'buff', element: 'frost',
    power: 0, scaling: 'hp', targets: 'all-allies', cost: 6, cooldown: 3,
    effect: { kind: 'statBuff', stat: 'atk', power: 1.2, duration: 3 },
  },
  ice_song: {
    id: 'ice_song', name: 'Ice Song', kind: 'damage', element: 'frost',
    power: 40, scaling: 'mag', targets: 'single', cost: 5,
  },
  soothing_song: {
    id: 'soothing_song', name: 'Soothing Song', kind: 'heal', element: 'frost',
    power: 50, scaling: 'hp', targets: 'single', cost: 5,
  },
  slow_rhythm: {
    id: 'slow_rhythm', name: 'Slow Rhythm', kind: 'debuff', element: 'frost',
    power: 0, scaling: 'hp', targets: 'all-enemies', cost: 6, cooldown: 3,
    effect: { kind: 'statDebuff', stat: 'spd', power: 0.7, duration: 2 },
  },

  // Enemy skills
  tackle: {
    id: 'tackle', name: 'Tackle', kind: 'damage', element: 'none',
    power: 30, scaling: 'atk', targets: 'single', cost: 0,
  },
  goblin_swipe: {
    id: 'goblin_swipe', name: 'Goblin Swipe', kind: 'damage', element: 'none',
    power: 35, scaling: 'atk', targets: 'single', cost: 0,
  },
  ember: {
    id: 'ember', name: 'Ember', kind: 'damage', element: 'fire',
    power: 40, scaling: 'mag', targets: 'single', cost: 0,
  },
  frost_breath: {
    id: 'frost_breath', name: 'Frost Breath', kind: 'damage', element: 'frost',
    power: 40, scaling: 'mag', targets: 'single', cost: 0,
  },
  shadow_strike: {
    id: 'shadow_strike', name: 'Shadow Strike', kind: 'damage', element: 'shadow',
    power: 45, scaling: 'atk', targets: 'single', cost: 0,
  },
  rock_smash: {
    id: 'rock_smash', name: 'Rock Smash', kind: 'damage', element: 'earth',
    power: 40, scaling: 'atk', targets: 'single', cost: 0,
  },
  holy_smite: {
    id: 'holy_smite', name: 'Holy Smite', kind: 'damage', element: 'holy',
    power: 40, scaling: 'mag', targets: 'single', cost: 0,
  },
}

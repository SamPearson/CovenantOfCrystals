import type { SkillDef } from '../types'

/**
 * Skill definitions. Balance numbers are stubs — tuned in the Phase 5 data
 * pass. Includes a few enemy-only skills (tackle, ember, …).
 *
 * Phase 4.5.2 (S6/S7): every skill carries a `type` (active / passive) and
 * `tags` used by the scripting skill-selector filters. Player and enemy skills
 * are all active; the passive skills (fortress, reckless, toughness,
 * regen_aura) and the reaction-capable actives (steal, guardians_vow, thorns)
 * are seeded here too, and reach the engine through `applyPassivesAtBattleStart`
 * and the reaction bus respectively (docs/specs/skills.md).
 */
function tag(s: Omit<SkillDef, 'type' | 'tags'>): SkillDef {
  const tags: string[] = [s.kind]
  if (s.element !== 'none') tags.push(s.element)
  if (s.targets === 'all-enemies' || s.targets === 'all-allies') tags.push('aoe')
  if (s.effect) tags.push(s.effect.kind)
  return { ...s, type: 'active', tags }
}

export const SKILLS: Record<string, SkillDef> = {
  // Knight
  slashing_strike: tag({
    id: 'slashing_strike', name: 'Slashing Strike', kind: 'damage', element: 'earth',
    power: 45, scaling: 'atk', targets: 'single', cost: 4,
  }),
  shield_bash: tag({
    id: 'shield_bash', name: 'Shield Bash', kind: 'damage', element: 'earth',
    power: 35, scaling: 'atk', targets: 'single', cost: 5, cooldown: 2,
    effect: { kind: 'statDebuff', stat: 'def', power: 0.8, duration: 2 },
  }),
  iron_guard: tag({
    id: 'iron_guard', name: 'Iron Guard', kind: 'buff', element: 'earth',
    power: 0, scaling: 'hp', targets: 'self', cost: 6, cooldown: 3,
    effect: { kind: 'statBuff', stat: 'def', power: 1.3, duration: 3 },
  }),

  // Berserker
  flame_slash: tag({
    id: 'flame_slash', name: 'Flame Slash', kind: 'damage', element: 'fire',
    power: 50, scaling: 'atk', targets: 'single', cost: 5,
  }),
  berserk_strike: tag({
    id: 'berserk_strike', name: 'Berserk Strike', kind: 'damage', element: 'fire',
    power: 60, scaling: 'atk', targets: 'single', cost: 6, cooldown: 1,
  }),
  battle_fury: tag({
    id: 'battle_fury', name: 'Battle Fury', kind: 'buff', element: 'fire',
    power: 0, scaling: 'hp', targets: 'self', cost: 6, cooldown: 3,
    effect: { kind: 'statBuff', stat: 'atk', power: 1.25, duration: 3 },
  }),

  // Rogue
  backstab: tag({
    id: 'backstab', name: 'Backstab', kind: 'damage', element: 'shadow',
    power: 55, scaling: 'atk', targets: 'single', cost: 5,
  }),
  poison_blade: tag({
    id: 'poison_blade', name: 'Poison Blade', kind: 'damage', element: 'shadow',
    power: 40, scaling: 'atk', targets: 'single', cost: 4,
    effect: { kind: 'poison', power: 5, duration: 3 },
  }),
  shadow_bolt: tag({
    id: 'shadow_bolt', name: 'Shadow Bolt', kind: 'damage', element: 'shadow',
    power: 45, scaling: 'mag', targets: 'single', cost: 5,
  }),

  // Ranger
  rapid_shot: tag({
    id: 'rapid_shot', name: 'Rapid Shot', kind: 'damage', element: 'water',
    power: 30, scaling: 'atk', targets: 'single', cost: 3,
  }),
  frost_arrow: tag({
    id: 'frost_arrow', name: 'Frost Arrow', kind: 'damage', element: 'frost',
    power: 45, scaling: 'atk', targets: 'single', cost: 5,
  }),
  tri_shot: tag({
    id: 'tri_shot', name: 'Tri-Shot', kind: 'damage', element: 'none',
    power: 30, scaling: 'atk', targets: 'single', cost: 4,
  }),

  // Mage
  fireball: tag({
    id: 'fireball', name: 'Fireball', kind: 'damage', element: 'fire',
    power: 55, scaling: 'mag', targets: 'single', cost: 6,
  }),
  frost_bite: tag({
    id: 'frost_bite', name: 'Frost Bite', kind: 'damage', element: 'frost',
    power: 45, scaling: 'mag', targets: 'single', cost: 5,
    effect: { kind: 'statDebuff', stat: 'spd', power: 0.7, duration: 2 },
  }),
  flame_wave: tag({
    id: 'flame_wave', name: 'Flame Wave', kind: 'damage', element: 'fire',
    power: 40, scaling: 'mag', targets: 'all-enemies', cost: 8, cooldown: 2,
  }),
  arcane_bolt: tag({
    id: 'arcane_bolt', name: 'Arcane Bolt', kind: 'damage', element: 'none',
    power: 40, scaling: 'mag', targets: 'single', cost: 4,
  }),

  // Healer
  heal: tag({
    id: 'heal', name: 'Heal', kind: 'heal', element: 'holy',
    power: 60, scaling: 'mag', targets: 'single', cost: 5,
  }),
  cleanse: tag({
    id: 'cleanse', name: 'Cleanse', kind: 'utility', element: 'holy',
    power: 0, scaling: 'hp', targets: 'single', cost: 4,
  }),
  holy_light: tag({
    id: 'holy_light', name: 'Holy Light', kind: 'damage', element: 'holy',
    power: 45, scaling: 'mag', targets: 'single', cost: 5,
  }),
  greater_heal: tag({
    id: 'greater_heal', name: 'Greater Heal', kind: 'heal', element: 'holy',
    power: 120, scaling: 'mag', targets: 'single', cost: 8,
  }),

  // Bard
  battle_anthem: tag({
    id: 'battle_anthem', name: 'Battle Anthem', kind: 'buff', element: 'frost',
    power: 0, scaling: 'hp', targets: 'all-allies', cost: 6, cooldown: 3,
    effect: { kind: 'statBuff', stat: 'atk', power: 1.2, duration: 3 },
  }),
  ice_song: tag({
    id: 'ice_song', name: 'Ice Song', kind: 'damage', element: 'frost',
    power: 40, scaling: 'mag', targets: 'single', cost: 5,
  }),
  soothing_song: tag({
    id: 'soothing_song', name: 'Soothing Song', kind: 'heal', element: 'frost',
    power: 50, scaling: 'mag', targets: 'single', cost: 5,
  }),
  slow_rhythm: tag({
    id: 'slow_rhythm', name: 'Slow Rhythm', kind: 'debuff', element: 'frost',
    power: 0, scaling: 'hp', targets: 'all-enemies', cost: 6, cooldown: 3,
    effect: { kind: 'statDebuff', stat: 'spd', power: 0.7, duration: 2 },
  }),

  // Enemy skills
  tackle: tag({
    id: 'tackle', name: 'Tackle', kind: 'damage', element: 'none',
    power: 30, scaling: 'atk', targets: 'single', cost: 0,
  }),
  goblin_swipe: tag({
    id: 'goblin_swipe', name: 'Goblin Swipe', kind: 'damage', element: 'none',
    power: 35, scaling: 'atk', targets: 'single', cost: 0,
  }),
  ember: tag({
    id: 'ember', name: 'Ember', kind: 'damage', element: 'fire',
    power: 40, scaling: 'mag', targets: 'single', cost: 0,
  }),
  frost_breath: tag({
    id: 'frost_breath', name: 'Frost Breath', kind: 'damage', element: 'frost',
    power: 40, scaling: 'mag', targets: 'single', cost: 0,
  }),
  shadow_strike: tag({
    id: 'shadow_strike', name: 'Shadow Strike', kind: 'damage', element: 'shadow',
    power: 45, scaling: 'atk', targets: 'single', cost: 0,
  }),
  rock_smash: tag({
    id: 'rock_smash', name: 'Rock Smash', kind: 'damage', element: 'earth',
    power: 40, scaling: 'atk', targets: 'single', cost: 0,
  }),
  holy_smite: tag({
    id: 'holy_smite', name: 'Holy Smite', kind: 'damage', element: 'holy',
    power: 40, scaling: 'mag', targets: 'single', cost: 0,
  }),

  // Phase 4.5.2 — passive skills (M2): applied at battle start by
  // applyPassivesAtBattleStart; must be in the character loadout.
  fortress: {
    ...tag({
      id: 'fortress', name: 'Fortress', kind: 'buff', element: 'earth',
      power: 0, scaling: 'hp', targets: 'self', cost: 0,
      effect: { kind: 'statBuff', stat: 'def', power: 1.3, duration: 999 },
    }),
    type: 'passive',
  },
  reckless: {
    ...tag({
      id: 'reckless', name: 'Reckless', kind: 'buff', element: 'fire',
      power: 0, scaling: 'hp', targets: 'self', cost: 0,
      effect: { kind: 'statBuff', stat: 'atk', power: 1.25, duration: 999 },
    }),
    type: 'passive',
  },
  toughness: {
    ...tag({
      id: 'toughness', name: 'Toughness', kind: 'buff', element: 'earth',
      power: 0, scaling: 'hp', targets: 'self', cost: 0,
      effect: { kind: 'statBuff', stat: 'def', power: 1.2, duration: 999 },
    }),
    type: 'passive',
  },
  regen_aura: {
    ...tag({
      id: 'regen_aura', name: 'Regen Aura', kind: 'heal', element: 'holy',
      power: 5, scaling: 'hp', targets: 'all-allies', cost: 0,
      effect: { kind: 'regen', power: 5, duration: 999 },
    }),
    type: 'passive',
  },

  // Phase 4.5.2 — reaction-capable actives (M2): legal only inside the gated
  // events they react to (docs/specs/skills.md reactionTo).
  thorns: {
    ...tag({
      id: 'thorns', name: 'Thorns', kind: 'damage', element: 'earth',
      power: 25, scaling: 'atk', targets: 'single', cost: 4,
    }),
    reactionTo: [{ kind: 'attacked', target: 'self' }],
  },
  steal: {
    ...tag({
      id: 'steal', name: 'Steal', kind: 'damage', element: 'shadow',
      power: 30, scaling: 'atk', targets: 'single', cost: 6,
    }),
    reactionTo: [{ kind: 'evaded', source: 'enemy', target: 'self' }],
  },
  guardians_vow: {
    ...tag({
      id: 'guardians_vow', name: "Guardian's Vow", kind: 'damage', element: 'earth',
      power: 35, scaling: 'atk', targets: 'single', cost: 5,
    }),
    reactionTo: [{ kind: 'attacked', source: 'enemy', target: 'ally' }],
  },
}

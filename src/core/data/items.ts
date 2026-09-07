import type { ItemDef } from '../types'
import { SKILL_SCROLLS, SKILL_TOMES } from './skill-items'

/**
 * Item definitions (gear templates, consumables, skill tomes, scrolls).
 * Durability is per-instance (see `docs/durability.md`), not per-definition.
 * Skill tomes/scrolls are auto-generated from `SKILLS` (see `./skill-items`).
 */
export const ITEMS: Record<string, ItemDef> = {
  // Weapons
  iron_sword: {
    id: 'iron_sword', name: 'Iron Sword', type: 'weapon', rarity: 'common',
    statBonus: { atk: 10 }, value: 120,
  },
  steel_sword: {
    id: 'steel_sword', name: 'Steel Sword', type: 'weapon', rarity: 'rare',
    statBonus: { atk: 18 }, value: 420,
  },
  warhammer: {
    id: 'warhammer', name: 'Warhammer', type: 'weapon', rarity: 'epic',
    statBonus: { atk: 26 }, value: 980,
  },
  mage_staff: {
    id: 'mage_staff', name: 'Mage Staff', type: 'weapon', rarity: 'common',
    statBonus: { mag: 10 }, value: 120,
  },
  arcane_staff: {
    id: 'arcane_staff', name: 'Arcane Staff', type: 'weapon', rarity: 'rare',
    statBonus: { mag: 18 }, value: 430,
  },
  hunter_bow: {
    id: 'hunter_bow', name: 'Hunter Bow', type: 'weapon', rarity: 'rare',
    statBonus: { atk: 12, spd: 4 }, value: 410,
  },
  shadow_dagger: {
    id: 'shadow_dagger', name: 'Shadow Dagger', type: 'weapon', rarity: 'rare',
    statBonus: { atk: 14, spd: 6 }, value: 450,
  },

  // Armor
  leather_armor: {
    id: 'leather_armor', name: 'Leather Armor', type: 'armor', rarity: 'common',
    statBonus: { def: 6 }, value: 90,
  },
  chain_mail: {
    id: 'chain_mail', name: 'Chain Mail', type: 'armor', rarity: 'rare',
    statBonus: { def: 12, hp: 15 }, value: 380,
  },
  plate_armor: {
    id: 'plate_armor', name: 'Plate Armor', type: 'armor', rarity: 'epic',
    statBonus: { def: 20, hp: 25 }, value: 900,
  },
  super_plate_armor: {
    id: 'super_plate_armor', name: 'Super Plate Armor', type: 'armor', rarity: 'epic',
    statBonus: { def: 200, hp: 250 }, value: 900,
  },
  mage_robe: {
    id: 'mage_robe', name: 'Mage Robe', type: 'armor', rarity: 'common',
    statBonus: { res: 8 }, value: 95,
  },
  holy_vestments: {
    id: 'holy_vestments', name: 'Holy Vestments', type: 'armor', rarity: 'epic',
    statBonus: { res: 16, hp: 20 }, value: 880,
  },
  ranger_cloak: {
    id: 'ranger_cloak', name: 'Ranger Cloak', type: 'armor', rarity: 'rare',
    statBonus: { res: 8, spd: 4 }, value: 360,
  },

  // Consumables
  health_potion: {
    id: 'health_potion', name: 'Health Potion', type: 'consumable', rarity: 'common',
    use: { healHp: 80 }, value: 30,
    reactionTo: [{ kind: 'attacked' }, { kind: 'status-applied' }],
  },
  greater_health_potion: {
    id: 'greater_health_potion', name: 'Greater Health Potion', type: 'consumable',
    rarity: 'rare', use: { healHp: 200 }, value: 90,
    reactionTo: [{ kind: 'attacked' }, { kind: 'status-applied' }],
  },
  mana_potion: {
    id: 'mana_potion', name: 'Mana Potion', type: 'consumable', rarity: 'common',
    use: { healMp: 30 }, value: 35,
  },
  greater_mana_potion: {
    id: 'greater_mana_potion', name: 'Greater Mana Potion', type: 'consumable',
    rarity: 'rare', use: { healMp: 80 }, value: 100,
  },

  // Stat-shots (Phase 4.5.1, I1): permanent +N to a single base stat. One per stat.
  // Priced dirt-cheap on purpose: they stand in for a level-up path during the
  // balance-testing phase (economy tuning happens in Phase 5). Balancing these
  // now would impede testing.
  shot_hp_5: {
    id: 'shot_hp_5', name: 'Essence of Vitality', type: 'stat-shot', rarity: 'common',
    boostStat: { stat: 'hp', amount: 5 }, value: 10,
  },
  shot_atk_1: {
    id: 'shot_atk_1', name: 'Vial of Strength', type: 'stat-shot', rarity: 'common',
    boostStat: { stat: 'atk', amount: 1 }, value: 10,
  },
  shot_def_1: {
    id: 'shot_def_1', name: 'Vial of Fortitude', type: 'stat-shot', rarity: 'common',
    boostStat: { stat: 'def', amount: 1 }, value: 10,
  },
  shot_mag_1: {
    id: 'shot_mag_1', name: 'Vial of Insight', type: 'stat-shot', rarity: 'common',
    boostStat: { stat: 'mag', amount: 1 }, value: 10,
  },
  shot_res_1: {
    id: 'shot_res_1', name: 'Vial of Warding', type: 'stat-shot', rarity: 'common',
    boostStat: { stat: 'res', amount: 1 }, value: 10,
  },
  shot_spd_1: {
    id: 'shot_spd_1', name: 'Vial of Swiftness', type: 'stat-shot', rarity: 'common',
    boostStat: { stat: 'spd', amount: 1 }, value: 10,
  },

  // Demo gear that grants a skill while equipped (Phase 4.5.1, I6).
  flame_staff: {
    id: 'flame_staff', name: 'Staff of Embers', type: 'weapon', rarity: 'rare',
    statBonus: { mag: 12, res: 4 }, value: 450,
    grantsSkillWhenEquipped: 'fireball',
  },

  // Skill tomes & scrolls (auto-generated from SKILLS, see ./skill-items)
  ...SKILL_SCROLLS,
  ...SKILL_TOMES,
}

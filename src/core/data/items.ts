import type { ItemDef } from '../types'

/**
 * Item definitions (gear templates, consumables, skill tomes).
 * Durability is per-instance (see `docs/durability.md`), not per-definition.
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
  },
  greater_health_potion: {
    id: 'greater_health_potion', name: 'Greater Health Potion', type: 'consumable',
    rarity: 'rare', use: { healHp: 200 }, value: 90,
  },

  // Skill tomes
  tome_heal: {
    id: 'tome_heal', name: 'Tome: Heal', type: 'tome', rarity: 'rare',
    skill: 'heal', value: 400,
  },
  tome_fireball: {
    id: 'tome_fireball', name: 'Tome: Fireball', type: 'tome', rarity: 'rare',
    skill: 'fireball', value: 420,
  },
}

/**
 * Town/City definitions — each race's home city with unique vibe that shapes
 * run generation, shop stock, and recruitment.
 */

export interface TownDef {
  id: string
  name: string
  race: 'human' | 'elf' | 'dragonborn' | 'lizardfolk'
  description: string
  /** Visual theme key for UI (background, accent colors, music cue) */
  themeKey: string

  // --- Enemy composition ---
  /** Enemy IDs drawn for standard battle nodes */
  standardPool: string[]
  /** Enemy IDs drawn for elite battle nodes */
  elitePool: string[]
  /** Boss enemy ID (single) */
  bossId: string
  /** Optional: weight overrides for pools (default = uniform) */
  poolWeights?: Record<string, number>

  // --- Shop / Item bias ---
  /** Item IDs always in stock (potions, stat-shots, town specialties) */
  alwaysStock: string[]
  /** Tags that increase weight in rotating gear pool */
  gearTagWeights: Record<string, number>
  /** Tags that increase weight in rotating skill-item pool */
  skillItemTagWeights: Record<string, number>

  // --- Recruitment bias ---
  /** Class IDs available for recruitment (subset of unlocked) */
  recruitClassPool: string[]
  /** Weight per class (default 1) */
  recruitClassWeights?: Record<string, number>
  /** Level range for recruits (default 1) */
  recruitLevelRange?: [number, number]

  // --- Run generation modifiers ---
  /** Multiplier applied to baseGold for runs from this town */
  goldMultiplier: number
  /** Multiplier applied to dropChance */
  dropChanceMultiplier: number
  /** Difficulty step multiplier (per node) */
  difficultyStepMultiplier: number
  /** Rest cadence override (0 = use global) */
  restCadenceOverride?: number
}

export const TOWNS: Record<string, TownDef> = {
  aldwyn: {
    id: 'aldwyn',
    name: 'Aldwyn',
    race: 'human',
    description: 'A bustling crossroads city where mercenaries, merchants, and adventurers of every stripe rub shoulders. Balanced opportunities for all.',
    themeKey: 'aldwyn',
    standardPool: ['slime', 'goblin', 'fire_elemental', 'frost_wraith'],
    elitePool: ['shadow_assassin', 'earth_golem', 'holy_guardian'],
    bossId: 'goblin_king',
    alwaysStock: ['health_potion', 'mana_potion', 'shot_hp_5', 'shot_atk_1', 'shot_def_1'],
    gearTagWeights: { versatile: 1.5, balanced: 1.2 },
    skillItemTagWeights: { utility: 1.3 },
    recruitClassPool: ['knight', 'berserker', 'rogue', 'ranger', 'mage', 'healer', 'bard'],
    recruitClassWeights: { knight: 1.2, rogue: 1.2, bard: 1.1 },
    recruitLevelRange: [1, 1],
    goldMultiplier: 1.0,
    dropChanceMultiplier: 1.0,
    difficultyStepMultiplier: 1.0,
  },
  sylvaris: {
    id: 'sylvaris',
    name: 'Sylvaris',
    race: 'elf',
    description: 'An ancient city woven into the boughs of the World Tree. Magic flows through its streets like sap; precision and grace are valued above brute force.',
    themeKey: 'sylvaris',
    standardPool: ['frost_wraith', 'fire_elemental', 'slime', 'goblin'],
    elitePool: ['holy_guardian', 'shadow_assassin', 'earth_golem'],
    bossId: 'goblin_king',
    alwaysStock: ['health_potion', 'mana_potion', 'greater_mana_potion', 'shot_mag_1', 'shot_res_1', 'shot_spd_1'],
    gearTagWeights: { frost: 2, holy: 1.8, staff: 2, bow: 1.8, light: 1.3 },
    skillItemTagWeights: { frost: 2, holy: 1.8, buff: 1.5, heal: 1.3 },
    recruitClassPool: ['mage', 'ranger', 'bard', 'healer'],
    recruitClassWeights: { mage: 1.3, ranger: 1.2, bard: 1.2 },
    recruitLevelRange: [1, 1],
    goldMultiplier: 1.1,
    dropChanceMultiplier: 1.15,
    difficultyStepMultiplier: 0.95,
  },
  drakkenhold: {
    id: 'drakkenhold',
    name: 'Drakkenhold',
    race: 'dragonborn',
    description: 'A fortress-city carved into a volcanic mountain. The clang of hammers and the roar of forges never cease. Strength and honor are the only currencies.',
    themeKey: 'drakkenhold',
    standardPool: ['fire_elemental', 'goblin', 'slime', 'frost_wraith'],
    elitePool: ['earth_golem', 'fire_elemental', 'holy_guardian'],
    bossId: 'goblin_king',
    alwaysStock: ['health_potion', 'greater_health_potion', 'shot_hp_5', 'shot_atk_1', 'shot_def_1'],
    gearTagWeights: { fire: 2, earth: 1.5, heavy: 2, plate: 1.8, twohanded: 1.5 },
    skillItemTagWeights: { fire: 2, earth: 1.5, damage: 1.3, buff: 1.2 },
    recruitClassPool: ['knight', 'berserker', 'mage'],
    recruitClassWeights: { knight: 1.3, berserker: 1.4, mage: 1.1 },
    recruitLevelRange: [1, 1],
    goldMultiplier: 0.9,
    dropChanceMultiplier: 0.9,
    difficultyStepMultiplier: 1.15,
  },
  xalith: {
    id: 'xalith',
    name: "Xal'ith",
    race: 'lizardfolk',
    description: 'A sprawling settlement half-sunk in the great marsh. Its people move like water — unseen, patient, deadly. Survival is not a virtue here; it is the baseline.',
    themeKey: 'xalith',
    standardPool: ['slime', 'frost_wraith', 'goblin', 'fire_elemental'],
    elitePool: ['shadow_assassin', 'frost_wraith', 'earth_golem'],
    bossId: 'goblin_king',
    alwaysStock: ['health_potion', 'mana_potion', 'shot_hp_5', 'shot_spd_1', 'shot_res_1'],
    gearTagWeights: { poison: 2, shadow: 1.8, water: 1.5, frost: 1.3, light: 1.5, dagger: 2, spear: 1.5 },
    skillItemTagWeights: { poison: 2, shadow: 1.8, debuff: 1.5, damage: 1.2 },
    recruitClassPool: ['rogue', 'ranger', 'healer'],
    recruitClassWeights: { rogue: 1.4, ranger: 1.3, healer: 1.1 },
    recruitLevelRange: [1, 1],
    goldMultiplier: 1.05,
    dropChanceMultiplier: 1.1,
    difficultyStepMultiplier: 1.0,
  },
}

export const TOWN_IDS = Object.keys(TOWNS) as Array<keyof typeof TOWNS>

export function getTown(id: string): TownDef {
  const town = TOWNS[id]
  if (!town) throw new Error(`Unknown town: ${id}`)
  return town
}

export function getDefaultTown(): TownDef {
  return TOWNS.aldwyn
}
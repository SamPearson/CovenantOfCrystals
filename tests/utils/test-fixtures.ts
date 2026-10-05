/**
 * Test Fixtures — Reusable profiles, characters, and battle setups for automated testing.
 * Replaces the manual "acquire every skill" setup from the test plan.
 */
import type {
  Profile,
  Character,
  CharacterClass,
  ItemInstance,
  GearInstance,
  ScriptRef,
  AutoBattleConfig,
} from '../../src/core/types';
import { CLASSES } from '../../src/core/data/classes';
import { SKILLS } from '../../src/core/data/skills';
import { ITEMS } from '../../src/core/data/items';
import { BUILT_IN_DPS, BUILT_IN_HEALER } from '../../src/core/data/scripts';

/** Create a character with sensible defaults for testing. */
export function createTestCharacter(overrides: Partial<Character> = {}): Character {
  const classId = overrides.classId ?? 'knight';
  const cls = CLASSES.find((c) => c.id === classId);
  if (!cls) throw new Error(`Class ${classId} not found`);
  const level = overrides.level ?? 10;

  // Default learned skills = class learnSet up to level
  const learnset = cls.learnSet.filter((l) => l.level <= level).map((l) => l.skillId);
  const learnedSkills = overrides.learnedSkills ?? learnset;
  const loadout = overrides.loadout ?? learnedSkills.slice(0, 4);

  const baseStats = cls.baseStats;
  const growth = cls.growth;
  const stats = {
    hp: Math.floor(baseStats.hp + growth.hp * (level - 1)),
    mp: Math.floor(baseStats.mp + growth.mp * (level - 1)),
    atk: Math.floor(baseStats.atk + growth.atk * (level - 1)),
    def: Math.floor(baseStats.def + growth.def * (level - 1)),
    mag: Math.floor(baseStats.mag + growth.mag * (level - 1)),
    res: Math.floor(baseStats.res + growth.res * (level - 1)),
    spd: Math.floor(baseStats.spd + growth.spd * (level - 1)),
  };

  return {
    id: overrides.id ?? `c_${classId}_${Date.now()}`,
    classId,
    name: overrides.name ?? `Test${cls.name}`,
    level,
    xp: 0,
    baseStats: stats,
    learnedSkills,
    loadout,
    gear: overrides.gear ?? { weapon: null, armor: null, accessory: null },
    durability: overrides.durability ?? { kind: 'permanent' },
    scriptId: overrides.scriptId ?? (cls.role === 'healer' ? 'builtin.healer' : 'builtin.dps'),
    scriptMode: overrides.scriptMode ?? 'auto',
    ...overrides,
  };
}

/** Create a permanent gear instance for testing. */
export function createTestGear(itemId: string, slot: 'weapon' | 'armor' | 'accessory'): GearInstance {
  return {
    id: `g_${itemId}_${Date.now()}`,
    itemId,
    durability: { kind: 'permanent' },
  };
}

/** Create a consumable item instance. */
export function createTestItem(itemId: string, quantity = 1): ItemInstance {
  return { id: `i_${itemId}_${Date.now()}`, itemId, quantity };
}

/** Create an autobattle config optimized for fast test execution. */
export const TEST_AUTOBATTLE: AutoBattleConfig = {
  speed: 4,
  skipAnimations: true,
  resultDelayMs: 0,
  stops: { boss: false, elite: false, permadeath: false, rest: false },
};

/** Built-in script references for testing. */
export const TEST_SCRIPTS: ScriptRef[] = [
  { id: 'builtin.dps', name: 'DPS', builtIn: true },
  { id: 'builtin.healer', name: 'Healer', builtIn: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST PROFILES
// ═══════════════════════════════════════════════════════════════════════════════

/** Full unlock profile — all classes, max gold, level 10, all skills learned. */
export const PROFILE_FULL_UNLOCK: Profile = {
  profileId: 'test-full-unlock',
  displayName: 'Test: Full Unlock',
  gold: 999999,
  unlockedClasses: ['knight', 'berserker', 'rogue', 'ranger', 'mage', 'healer', 'bard'],
  characters: {
    c_knight: createTestCharacter({
      id: 'c_knight',
      classId: 'knight',
      name: 'TestKnight',
      learnedSkills: ['slashing_strike', 'shield_bash', 'iron_guard', 'fortress'],
      loadout: ['slashing_strike', 'shield_bash', 'iron_guard', 'fortress'],
      gear: { weapon: createTestGear('warhammer', 'weapon'), armor: null, accessory: null },
      scriptId: 'builtin.dps',
    }),
    c_berserker: createTestCharacter({
      id: 'c_berserker',
      classId: 'berserker',
      name: 'TestZerker',
      learnedSkills: ['flame_slash', 'berserk_strike', 'battle_fury', 'reckless'],
      loadout: ['flame_slash', 'berserk_strike', 'battle_fury', 'reckless'],
      gear: { weapon: createTestGear('flame_staff', 'weapon'), armor: null, accessory: null },
      scriptId: 'builtin.dps',
    }),
    c_rogue: createTestCharacter({
      id: 'c_rogue',
      classId: 'rogue',
      name: 'TestRogue',
      learnedSkills: ['backstab', 'poison_blade', 'shadow_bolt', 'thorns'],
      loadout: ['backstab', 'poison_blade', 'shadow_bolt', 'thorns'],
      scriptId: 'builtin.dps',
    }),
    c_ranger: createTestCharacter({
      id: 'c_ranger',
      classId: 'ranger',
      name: 'TestRanger',
      learnedSkills: ['rapid_shot', 'frost_arrow', 'tri_shot'],
      loadout: ['rapid_shot', 'frost_arrow', 'tri_shot'],
      scriptId: 'builtin.dps',
    }),
    c_mage: createTestCharacter({
      id: 'c_mage',
      classId: 'mage',
      name: 'TestMage',
      learnedSkills: ['fireball', 'frost_bite', 'flame_wave', 'arcane_bolt'],
      loadout: ['fireball', 'frost_bite', 'flame_wave', 'arcane_bolt'],
      scriptId: 'builtin.dps',
    }),
    c_healer: createTestCharacter({
      id: 'c_healer',
      classId: 'healer',
      name: 'TestHealer',
      learnedSkills: ['heal', 'cleanse', 'holy_light', 'greater_heal'],
      loadout: ['heal', 'cleanse', 'holy_light', 'greater_heal'],
      scriptId: 'builtin.healer',
    }),
    c_bard: createTestCharacter({
      id: 'c_bard',
      classId: 'bard',
      name: 'TestBard',
      learnedSkills: ['battle_anthem', 'ice_song', 'soothing_song', 'slow_rhythm'],
      loadout: ['battle_anthem', 'ice_song', 'soothing_song', 'slow_rhythm'],
      scriptId: 'builtin.healer',
    }),
  },
  party: ['c_knight', 'c_berserker', 'c_mage', 'c_healer'],
  boxes: [{
    id: 'b1',
    name: 'Box 1',
    slots: ['c_knight', 'c_berserker', 'c_mage', 'c_healer', 'c_rogue', 'c_bard', 'c_ranger', null, null, null,
      null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null],
  }],
  inventory: { items: [], gear: [] },
  autobattle: TEST_AUTOBATTLE,
  scriptLibrary: TEST_SCRIPTS,
  activeRun: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/** Minimal profile — single knight, level 1, basic skills only. */
export const PROFILE_MINIMAL: Profile = {
  profileId: 'test-minimal',
  displayName: 'Test: Minimal',
  gold: 1000,
  unlockedClasses: ['knight'],
  characters: {
    c_knight: createTestCharacter({
      id: 'c_knight',
      classId: 'knight',
      name: 'TestKnight',
      level: 1,
      learnedSkills: ['slashing_strike'],
      loadout: ['slashing_strike'],
      scriptId: 'builtin.dps',
    }),
  },
  party: ['c_knight'],
  boxes: [{
    id: 'b1',
    name: 'Box 1',
    slots: ['c_knight', null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null],
  }],
  inventory: { items: [], gear: [] },
  autobattle: TEST_AUTOBATTLE,
  scriptLibrary: TEST_SCRIPTS,
  activeRun: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/** Healer-focused profile — dedicated healer + 3 DPS. */
export const PROFILE_HEALER_FOCUS: Profile = {
  profileId: 'test-healer-focus',
  displayName: 'Test: Healer Focus',
  gold: 50000,
  unlockedClasses: ['knight', 'mage', 'healer', 'bard'],
  characters: {
    c_knight: createTestCharacter({ id: 'c_knight', classId: 'knight', name: 'Tank', scriptId: 'builtin.dps' }),
    c_berserker: createTestCharacter({ id: 'c_berserker', classId: 'berserker', name: 'DPS1', scriptId: 'builtin.dps' }),
    c_mage: createTestCharacter({ id: 'c_mage', classId: 'mage', name: 'DPS2', scriptId: 'builtin.dps' }),
    c_healer: createTestCharacter({
      id: 'c_healer',
      classId: 'healer',
      name: 'Healer',
      learnedSkills: ['heal', 'greater_heal', 'cleanse', 'holy_light'],
      loadout: ['heal', 'greater_heal', 'cleanse', 'holy_light'],
      scriptId: 'builtin.healer',
    }),
  },
  party: ['c_knight', 'c_berserker', 'c_mage', 'c_healer'],
  boxes: [{
    id: 'b1',
    name: 'Box 1',
    slots: ['c_knight', 'c_berserker', 'c_mage', 'c_healer', null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null],
  }],
  inventory: { items: [], gear: [] },
  autobattle: TEST_AUTOBATTLE,
  scriptLibrary: TEST_SCRIPTS,
  activeRun: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/** Reaction-heavy profile — characters with thorns, steal, guardian's vow. */
export const PROFILE_REACTION_HEAVY: Profile = {
  profileId: 'test-reaction-heavy',
  displayName: 'Test: Reaction Heavy',
  gold: 50000,
  unlockedClasses: ['knight', 'rogue', 'healer'],
  characters: {
    c_knight: createTestCharacter({
      id: 'c_knight',
      classId: 'knight',
      name: 'ThornsKnight',
      learnedSkills: ['slashing_strike', 'thorns', 'iron_guard'],
      loadout: ['slashing_strike', 'thorns', 'iron_guard'],
      scriptId: 'builtin.dps',
    }),
    c_rogue: createTestCharacter({
      id: 'c_rogue',
      classId: 'rogue',
      name: 'StealRogue',
      learnedSkills: ['backstab', 'steal', 'poison_blade'],
      loadout: ['backstab', 'steal', 'poison_blade'],
      scriptId: 'builtin.dps',
    }),
    c_healer: createTestCharacter({
      id: 'c_healer',
      classId: 'healer',
      name: 'GuardianHealer',
      learnedSkills: ['heal', 'guardians_vow', 'cleanse'],
      loadout: ['heal', 'guardians_vow', 'cleanse', 'holy_light'],
      scriptId: 'builtin.healer',
    }),
  },
  party: ['c_knight', 'c_rogue', 'c_healer'],
  boxes: [{
    id: 'b1',
    name: 'Box 1',
    slots: ['c_knight', 'c_rogue', 'c_healer', null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null],
  }],
  inventory: { items: [], gear: [] },
  autobattle: TEST_AUTOBATTLE,
  scriptLibrary: TEST_SCRIPTS,
  activeRun: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/** Status effect test profile — pre-configured for poison/burn/regen testing. */
export const PROFILE_STATUS_TEST: Profile = {
  profileId: 'test-status',
  displayName: 'Test: Status Effects',
  gold: 50000,
  unlockedClasses: ['mage', 'rogue', 'knight', 'healer'],
  characters: {
    c_mage: createTestCharacter({
      id: 'c_mage',
      classId: 'mage',
      name: 'FireMage',
      learnedSkills: ['fireball', 'flame_wave'],
      loadout: ['fireball', 'flame_wave'],
      scriptId: 'builtin.dps',
    }),
    c_rogue: createTestCharacter({
      id: 'c_rogue',
      classId: 'rogue',
      name: 'PoisonRogue',
      learnedSkills: ['poison_blade', 'backstab'],
      loadout: ['poison_blade', 'backstab'],
      scriptId: 'builtin.dps',
    }),
    c_knight: createTestCharacter({
      id: 'c_knight',
      classId: 'knight',
      name: 'RegenKnight',
      learnedSkills: ['regen_aura', 'slashing_strike'],
      loadout: ['regen_aura', 'slashing_strike'],
      scriptId: 'builtin.dps',
    }),
    c_healer: createTestCharacter({
      id: 'c_healer',
      classId: 'healer',
      name: 'CleanseHealer',
      learnedSkills: ['heal', 'cleanse', 'greater_heal'],
      loadout: ['heal', 'cleanse', 'greater_heal', 'holy_light'],
      scriptId: 'builtin.healer',
    }),
  },
  party: ['c_mage', 'c_rogue', 'c_knight', 'c_healer'],
  boxes: [{
    id: 'b1',
    name: 'Box 1',
    slots: ['c_mage', 'c_rogue', 'c_knight', 'c_healer', null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null],
  }],
  inventory: {
    items: [
      createTestItem('health_potion', 5),
      createTestItem('mana_potion', 5),
      createTestItem('scroll_fireball', 3),
      createTestItem('scroll_poison_blade', 3),
    ],
    gear: [],
  },
  autobattle: TEST_AUTOBATTLE,
  scriptLibrary: TEST_SCRIPTS,
  activeRun: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/** Element coverage profile — one character per element for weakness/resist testing. */
export const PROFILE_ELEMENT_COVERAGE: Profile = {
  profileId: 'test-elements',
  displayName: 'Test: Element Coverage',
  gold: 50000,
  unlockedClasses: ['knight', 'berserker', 'rogue', 'ranger', 'mage', 'healer', 'bard'],
  characters: {
    c_knight: createTestCharacter({ id: 'c_knight', classId: 'knight', name: 'EarthKnight', scriptId: 'builtin.dps' }),     // earth
    c_berserker: createTestCharacter({ id: 'c_berserker', classId: 'berserker', name: 'FireZerker', scriptId: 'builtin.dps' }), // fire
    c_rogue: createTestCharacter({ id: 'c_rogue', classId: 'rogue', name: 'ShadowRogue', scriptId: 'builtin.dps' }),       // shadow
    c_ranger: createTestCharacter({ id: 'c_ranger', classId: 'ranger', name: 'WaterRanger', scriptId: 'builtin.dps' }),     // water
    c_mage: createTestCharacter({ id: 'c_mage', classId: 'mage', name: 'FrostMage', scriptId: 'builtin.dps' }),           // frost
    c_healer: createTestCharacter({ id: 'c_healer', classId: 'healer', name: 'HolyHealer', scriptId: 'builtin.healer' }), // holy
    c_bard: createTestCharacter({ id: 'c_bard', classId: 'bard', name: 'FrostBard', scriptId: 'builtin.healer' }),       // frost
  },
  party: ['c_knight', 'c_berserker', 'c_mage', 'c_healer'],
  boxes: [{
    id: 'b1',
    name: 'Box 1',
    slots: ['c_knight', 'c_berserker', 'c_rogue', 'c_ranger', 'c_mage', 'c_healer', 'c_bard', null, null, null,
      null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null],
  }],
  inventory: { items: [], gear: [] },
  autobattle: TEST_AUTOBATTLE,
  scriptLibrary: TEST_SCRIPTS,
  activeRun: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/** All profiles indexed by key for easy access. */
export const TEST_PROFILES = {
  fullUnlock: PROFILE_FULL_UNLOCK,
  minimal: PROFILE_MINIMAL,
  healerFocus: PROFILE_HEALER_FOCUS,
  reactionHeavy: PROFILE_REACTION_HEAVY,
  statusTest: PROFILE_STATUS_TEST,
  elementCoverage: PROFILE_ELEMENT_COVERAGE,
} as const;

export type TestProfileKey = keyof typeof TEST_PROFILES;

/** Get a test profile by key (with deep clone to prevent test pollution). */
export function getTestProfile(key: TestProfileKey): Profile {
  return JSON.parse(JSON.stringify(TEST_PROFILES[key]));
}

/** All character IDs from the full unlock profile for iteration. */
export const FULL_UNLOCK_CHARACTER_IDS = Object.keys(PROFILE_FULL_UNLOCK.characters);

/** All skill IDs from the full unlock profile (deduplicated). */
export const FULL_UNLOCK_SKILL_IDS = Array.from(
  new Set(Object.values(PROFILE_FULL_UNLOCK.characters).flatMap((c) => c.learnedSkills))
);
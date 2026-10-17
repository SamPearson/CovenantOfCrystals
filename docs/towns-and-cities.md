# Towns & Cities System — Design & Implementation

**Status**: Planned (Next Sprint)  
**Related**: `docs/runs-and-gauntlet.md`, `docs/party-and-equipment.md`, `docs/data-model.md`

---

## 1. Overview

Each race in Covenant of Crystals — **Human**, **Elf**, **Dragonborn**, **Lizardfolk** — has a home city. When the player launches a run, they choose a city. That choice determines the "vibe" of the run:

| City | Race | Vibe / Theme | Enemy Flavor | Item/Weapon Bias | Recruitment Pool |
|------|------|--------------|--------------|------------------|------------------|
| **Aldwyn** | Human | Mercantile, adaptable, balanced | Mixed humanoids, beasts, mercenaries | Balanced variety, emphasis on versatility gear | All classes available, slight bias toward Knight/Rogue/Bard |
| **Sylvaris** | Elven | Arcane, nature, precision | Fey, elementals, plant/beast hybrids | Staves, bows, frost/holy gear, scrolls/tomes | Mage, Ranger, Bard, Healer |
| **Drakkenhold** | Dragonborn | Martial, fire, honor-bound | Draconic, fire elementals, heavy infantry | Heavy weapons, fire/earth gear, plate armor | Knight, Berserker, Mage (fire) |
| **Xal'ith** | Lizardfolk | Primal, swamp, survivalist | Poison, water/frost beasts, ambushers | Daggers, spears, poison/shadow gear, light armor | Rogue, Ranger, Healer (nature) |

> **Future-proofing**: The system is designed so additional cities (hand-authored or procedurally generated) can be added later without refactoring the run-generation pipeline.

---

## 2. Data Model

### 2.1 `TownDef` (New)

```ts
// src/core/data/towns.ts
import type { Element, Role, ItemType, Rarity } from '../types'

export interface TownDef {
  id: string                    // 'aldwyn' | 'sylvaris' | 'drakkenhold' | 'xalith'
  name: string                  // Display name
  race: 'human' | 'elf' | 'dragonborn' | 'lizardfolk'
  description: string           // Lore blurb for UI
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
  gearTagWeights: Record<string, number>   // e.g. { 'fire': 2, 'heavy': 1.5 }
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
    bossId: 'goblin_king', // TODO: add elven boss (e.g. 'archdruid', 'frost_lord')
    alwaysStock: ['health_potion', 'mana_potion', 'greater_mana_potion', 'shot_mag_1', 'shot_res_1', 'shot_spd_1'],
    gearTagWeights: { frost: 2, holy: 1.8, staff: 2, bow: 1.8, light: 1.3 },
    skillItemTagWeights: { frost: 2, holy: 1.8, buff: 1.5, heal: 1.3 },
    recruitClassPool: ['mage', 'ranger', 'bard', 'healer'],
    recruitClassWeights: { mage: 1.3, ranger: 1.2, bard: 1.2 },
    recruitLevelRange: [1, 1],
    goldMultiplier: 1.1,
    dropChanceMultiplier: 1.15,
    difficultyStepMultiplier: 0.95, // slightly gentler scaling
  },
  drakkenhold: {
    id: 'drakkenhold',
    name: "Drakkenhold",
    race: 'dragonborn',
    description: 'A fortress-city carved into a volcanic mountain. The clang of hammers and the roar of forges never cease. Strength and honor are the only currencies.',
    themeKey: 'drakkenhold',
    standardPool: ['fire_elemental', 'goblin', 'slime', 'frost_wraith'],
    elitePool: ['earth_golem', 'fire_elemental', 'holy_guardian'],
    bossId: 'goblin_king', // TODO: add dragonborn boss (e.g. 'drake_lord', 'flame_tyrant')
    alwaysStock: ['health_potion', 'greater_health_potion', 'shot_hp_5', 'shot_atk_1', 'shot_def_1'],
    gearTagWeights: { fire: 2, earth: 1.5, heavy: 2, plate: 1.8, twohanded: 1.5 },
    skillItemTagWeights: { fire: 2, earth: 1.5, damage: 1.3, buff: 1.2 },
    recruitClassPool: ['knight', 'berserker', 'mage'],
    recruitClassWeights: { knight: 1.3, berserker: 1.4, mage: 1.1 }, // mage = fire spec
    recruitLevelRange: [1, 1],
    goldMultiplier: 0.9,
    dropChanceMultiplier: 0.9,
    difficultyStepMultiplier: 1.15, // harsher scaling
  },
  xalith: {
    id: 'xalith',
    name: "Xal'ith",
    race: 'lizardfolk',
    description: 'A sprawling settlement half-sunk in the great marsh. Its people move like water — unseen, patient, deadly. Survival is not a virtue here; it is the baseline.',
    themeKey: 'xalith',
    standardPool: ['slime', 'frost_wraith', 'goblin', 'fire_elemental'],
    elitePool: ['shadow_assassin', 'frost_wraith', 'earth_golem'],
    bossId: 'goblin_king', // TODO: add lizardfolk boss (e.g. 'marsh_matriarch', 'venom_lord')
    alwaysStock: ['health_potion', 'mana_potion', 'shot_hp_5', 'shot_spd_1', 'shot_res_1'],
    gearTagWeights: { poison: 2, shadow: 1.8, water: 1.5, frost: 1.3, light: 1.5, dagger: 2, spear: 1.5 },
    skillItemTagWeights: { poison: 2, shadow: 1.8, debuff: 1.5, damage: 1.2 },
    recruitClassPool: ['rogue', 'ranger', 'healer'],
    recruitClassWeights: { rogue: 1.4, ranger: 1.3, healer: 1.1 }, // healer = nature spec
    recruitLevelRange: [1, 1],
    goldMultiplier: 1.05,
    dropChanceMultiplier: 1.1,
    difficultyStepMultiplier: 1.0,
  },
}
```

### 2.2 Item Tags (Extend `ItemDef`)

Add optional `tags: string[]` to `ItemDef` (in `src/core/types.ts`) for pool weighting:

```ts
export interface ItemDef {
  // ...existing fields
  /** Free-form tags for town pool weighting and filters */
  tags?: string[]
}
```

Example tagging (in `items.ts`):
```ts
iron_sword: { ..., tags: ['versatile', 'balanced', 'slashing'] },
warhammer: { ..., tags: ['heavy', 'twohanded', 'blunt', 'earth'] },
mage_staff: { ..., tags: ['staff', 'magical', 'fire'] },
arcane_staff: { ..., tags: ['staff', 'magical', 'arcane'] },
hunter_bow: { ..., tags: ['bow', 'ranged', 'water', 'light'] },
shadow_dagger: { ..., tags: ['dagger', 'light', 'shadow', 'poison'] },
plate_armor: { ..., tags: ['plate', 'heavy', 'earth'] },
ranger_cloak: { ..., tags: ['light', 'water', 'frost'] },
// etc.
```

### 2.3 Skill Item Tags (Extend `SkillDef`)

Already has `tags: string[]` — used for skill-item pool weighting.

### 2.4 Profile Extension (Town Selection)

```ts
// In PlayerProfile (src/core/types.ts)
export interface PlayerProfile {
  // ...existing fields
  /** Currently selected home town (defaults to 'aldwyn') */
  homeTown: string
  /** Whether the town selection screen has been seen (tutorial) */
  hasSeenTownSelect: boolean
}
```

---

## 3. Integration Points

### 3.1 Run Generation (`src/core/runs/run-gen.ts`)

**Current**: `generateRun(profileId, partyIds, length, seed)` uses global `STANDARD_POOL`, `ELITE_POOL`, `BOSS_ID`, and `BALANCE.run`.

**New**: Accept `townId` parameter; resolve `TownDef` and use its pools/multipliers.

```ts
// Signature change
export function generateRun(
  profileId: string,
  partyIds: string[],
  length: number,
  seed: number,
  townId: string = 'aldwyn'  // default for backward compat
): ActiveRun

// Inside buildSquad:
const town = TOWNS[townId] ?? TOWNS.aldwyn
const pool = type === 'elite' ? town.elitePool : town.standardPool
const bossId = town.bossId
// Apply multipliers from town:
const mult = type === 'elite' 
  ? BALANCE.run.eliteMult * town.difficultyStepMultiplier 
  : town.difficultyStepMultiplier
// ...etc for gold, dropChance, restCadence
```

### 3.2 Shop Stock (`src/core/shop/shop.ts`)

**Current**: `generateShopStock(rng)` draws from global `rotatingGearPool()` / `rotatingSkillPool()` with uniform shuffle.

**New**: Weighted shuffle using `town.gearTagWeights` / `town.skillItemTagWeights` and include `town.alwaysStock`.

```ts
export function generateShopStock(rng: Rng, townId: string = 'aldwyn'): ShopStock {
  const town = TOWNS[townId] ?? TOWNS.aldwyn
  
  // Weighted sampling for gear
  const gearPool = rotatingGearPool()
  const weightedGear = weightedShuffle(rng, gearPool, (item) => 
    computeTagWeight(item.tags ?? [], town.gearTagWeights)
  )
  const gear = weightedGear.slice(0, BALANCE.economy.rotatingGear)
  
  // Weighted sampling for skill items
  const skillPool = rotatingSkillPool()
  const weightedSkills = weightedShuffle(rng, skillPool, (item) => 
    computeTagWeight(item.tags ?? [], town.skillItemTagWeights)
  )
  const skills = weightedSkills.slice(0, BALANCE.economy.rotatingSkillItems)
  
  return {
    always: [...town.alwaysStock],
    rotating: { gear: gear.map(i => i.id), skills: skills.map(i => i.id) }
  }
}

function computeTagWeight(itemTags: string[], weightMap: Record<string, number>): number {
  let weight = 1
  for (const tag of itemTags) {
    if (weightMap[tag]) weight *= weightMap[tag]
  }
  return weight
}
```

### 3.3 Recruitment (`src/core/shop/recruitment.ts`)

**Current**: `generateRecruitOffers(rng, unlockedClasses, count)` picks uniformly from `unlockedClasses`.

**New**: Filter by `town.recruitClassPool`, apply `town.recruitClassWeights`, respect `town.recruitLevelRange`.

```ts
export function generateRecruitOffers(
  rng: Rng,
  unlockedClasses: string[],
  count: number,
  townId: string = 'aldwyn'
): RecruitOffer[] {
  const town = TOWNS[townId] ?? TOWNS.aldwyn
  const available = unlockedClasses.filter(c => town.recruitClassPool.includes(c))
  if (available.length === 0) return []
  
  const offers: RecruitOffer[] = []
  for (let i = 0; i < count; i++) {
    // Weighted pick
    const classId = weightedPick(rng, available, c => town.recruitClassWeights?.[c] ?? 1)
    const level = intBetween(rng, town.recruitLevelRange?.[0] ?? 1, town.recruitLevelRange?.[1] ?? 1)
    const character = createCharacter({ classId, level, rng })
    offers.push({ id: uuid(), character, price: BALANCE.economy.recruitPrice })
  }
  return offers
}
```

### 3.4 Store / Profile (`src/core/store.ts`)

- Add `homeTown` to profile on creation (default `'aldwyn'`)
- Expose `setHomeTown(profile, townId)` mutation
- Pass `townId` to `generateRun`, `refreshShopStock`, `refreshRecruitment`

### 3.5 UI: Town Selection Screen

New scene/panel: `TownSelectScene` or `TownSelectPanel` (meta layer, between runs).

**Flow**:
1. After run ends (or on fresh profile), show town select before shop/recruitment
2. Display 4 city cards: name, race, description, theme preview, key bonuses
3. On select: persist `profile.homeTown`, refresh shop/recruitment for that town
4. Option to change town later (costs gold? cooldown? — design decision)

**Card UI data** (derived from `TownDef`):
- Primary element(s) → icon/color
- Favored classes → class icons
- Signature enemies → enemy portraits
- Shop specialties → item type icons
- Difficulty hint → "Balanced", "Arcane Focus", "Brutal", "Subtle"

---

## 4. Implementation Plan (Phased)

| Phase | Scope | Files Touched |
|-------|-------|---------------|
| **1. Data & Types** | Add `TownDef`, `TOWNS`, item tags, profile `homeTown` | `src/core/data/towns.ts` (new), `src/core/types.ts`, `src/core/data/items.ts`, `src/core/data/index.ts` |
| **2. Core Logic** | Weighted pools, town-aware `generateRun`, `generateShopStock`, `generateRecruitOffers` | `src/core/runs/run-gen.ts`, `src/core/shop/shop.ts`, `src/core/shop/recruitment.ts`, `src/core/rng/rng.ts` (add `weightedShuffle`, `weightedPick`) |
| **3. Store Integration** | Profile `homeTown`, mutations, pass townId through | `src/core/store.ts`, `src/core/starter.ts` (default town) |
| **4. UI — Town Select** | New panel/scene, town cards, selection persistence | `src/game/ui/panels/town-select-panel.ts` (new), `src/game/scenes/MetaScene.ts` (or new `TownSelectScene`) |
| **5. UI — Theme** | Visual theming per town (backgrounds, accents, music) | `src/game/ui/theme.ts`, `src/game/ui/textures.ts`, new assets |
| **6. Content** | Unique bosses per town, additional enemies, tagged items | `src/core/data/enemies.ts`, `src/core/data/items.ts`, `src/core/data/skills.ts` |
| **7. Balance Pass** | Tune multipliers, weights, pool composition | `src/core/data/balance.ts`, `src/core/data/towns.ts` |

---

## 5. Balance Considerations

1. **No "Best" Town**: Each town should have trade-offs. E.g., Drakkenhold = harder scaling but better heavy gear; Xal'ith = more gold/drops but niche recruits.
2. **Progression Unlocks**: All towns available from start? Or unlock via meta progression? → **Start with all unlocked**; lock behind meta milestones later if needed.
3. **Town Switching**: Allow switching between runs? → **Yes, free switch at any meta screen**; optional gold cost for "travel" flavor later.
4. **Run Length Interaction**: Town multipliers compound with `bossMultByLength`. Test 3/5/10 lengths per town.
5. **Enemy Variety**: Current enemy roster is small. Each town reuses same enemies with different weights. **Priority: add 1–2 signature enemies per town** (Phase 5 content).

---

## 6. Future Extensions (Post-MVP)

- **Procedural Towns**: Generate `TownDef` from seed (race + biome + trait tags).
- **Town Reputation**: Completing runs from a town unlocks better stock/recruits/quests.
- **Town Events**: Unique narrative events per town (shop discounts, special recruits, lore).
- **Town Upgrades**: Spend meta-currency to improve a town's bonuses (permanent).
- **Inter-Town Trade**: Buy/sell items at different prices per town.

---

## 7. Testing Checklist

- [ ] All 4 towns generate valid runs (3, 5, 10 length) with correct enemy pools
- [ ] Shop stock reflects town tags (weighted sampling works, alwaysStock present)
- [ ] Recruitment offers respect town class pool, weights, level range
- [ ] Gold/drop/difficulty multipliers apply correctly
- [ ] Town selection UI persists choice, refreshes dependent panels
- [ ] Save/load preserves `homeTown`
- [ ] No regression: default town (`aldwyn`) behaves identically to pre-town system
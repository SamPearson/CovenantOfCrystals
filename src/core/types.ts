/**
 * Core entity types — the vocabulary from `docs/data-model.md`.
 * These are the single source of truth for what a Character / Item / etc. is.
 */

export type StatKey = 'hp' | 'atk' | 'def' | 'mag' | 'res' | 'spd'

export interface StatBlock {
  hp: number
  atk: number
  def: number
  mag: number
  res: number
  spd: number
}

/** The durability template: permanent, or expires after N runs. */
export type Durability =
  | { kind: 'permanent' }
  | { kind: 'expires'; runsRemaining: number }

export type Role = 'tank' | 'melee' | 'ranged' | 'mage' | 'healer' | 'support'

export type Element =
  | 'fire'
  | 'water'
  | 'frost'
  | 'earth'
  | 'holy'
  | 'shadow'
  | 'none'

export type SkillKind = 'damage' | 'heal' | 'buff' | 'debuff' | 'utility'
export type SkillTargets = 'single' | 'all-allies' | 'all-enemies' | 'self'
export type ItemType = 'weapon' | 'armor' | 'consumable' | 'tome' | 'misc'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

/**
 * `shield` / `taunt` / `stun` are types-stub only — designed but out of the
 * v1 engine (`docs/combat.md` §11). The active set is handled by
 * `src/core/combat/status.ts`.
 */
export interface StatusEffect {
  kind:
    | 'statBuff'
    | 'statDebuff'
    | 'burn'
    | 'poison'
    | 'regen'
    | 'sleep'
    | 'blind'
    | 'freeze'
    | 'shield'
    | 'taunt'
    | 'stun'
  stat?: StatKey
  power?: number
  duration?: number
}

/** Static definition of a class archetype. */
export interface ClassDef {
  id: string
  name: string
  role: Role
  element: Element
  baseStats: StatBlock
  growth: StatBlock
  learnSet: { skillId: string; level: number }[]
  loadoutSize: number
  passive?: string
}

/** Static definition of a skill. */
export interface SkillDef {
  id: string
  name: string
  kind: SkillKind
  element: Element
  power: number
  scaling: 'atk' | 'mag' | 'hp'
  targets: SkillTargets
  cost: number
  cooldown?: number
  effect?: StatusEffect
  /** Action weight on the CTB queue — higher = slower re-insert (`docs/combat.md` §2). */
  delay?: number
}

/** Static definition of an item (gear template, consumable, or tome). */
export interface ItemDef {
  id: string
  name: string
  type: ItemType
  rarity: Rarity
  statBonus?: Partial<StatBlock>
  skill?: string
  use?: { healHp?: number; healMp?: number }
  value: number
}

/**
 * Behavior profiles for enemies (and Phase 4 autobattle presets). Each maps to
 * a priority script in `src/core/data/ai.ts` (`docs/combat.md` §8).
 */
export type AiProfileId = 'minion' | 'tanky' | 'glass' | 'boss'

/** Static definition of an enemy. */
export interface EnemyDef {
  id: string
  name: string
  element: Element
  level: number
  stats: StatBlock
  skills: string[]
  ai: AiProfileId
  isBoss?: boolean
}

/** A unique owned gear instance (carries its own durability). */
export interface GearInstance {
  id: string
  itemId: string
  durability: Durability
}

export interface Character {
  id: string
  classId: string
  name: string
  level: number
  xp: number
  gear: { weapon?: GearInstance; armor?: GearInstance }
  learnedSkills: string[]
  loadout: string[]
  durability: Durability
  earned: { runs: number; wins: number }
}

export interface Inventory {
  items: { itemId: string; count: number }[]
  gear: GearInstance[]
}

export interface Box {
  id: string
  name: string
  slots: (string | null)[]
}

export interface PlayerProfile {
  profileId: string
  displayName: string
  gold: number
  unlockedClasses: string[]
  characters: Record<string, Character>
  boxes: Box[]
  inventory: Inventory
  party: string[]
  stats: { totalRuns: number; wins: number; losses: number }
  createdAt: number
}

export interface SaveFile {
  schemaVersion: number
  savedAt: number
  profile: PlayerProfile
}

// Locked design constants (docs/roadmap.md).
export const BOX_COUNT = 10
export const BOX_SIZE = 30
export const PARTY_SIZE = 4

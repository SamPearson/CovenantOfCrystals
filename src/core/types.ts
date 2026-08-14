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
export type ItemType = 'weapon' | 'armor' | 'consumable' | 'tome' | 'scroll' | 'misc'
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
  /** Tomes: skillId permanently granted when consumed in the meta layer. */
  skill?: string
  /** Scrolls: skillId cast when used in battle — no MP cost, no cooldown. */
  castSkill?: string
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
  /** XP awarded to each survivor when the squad is defeated. */
  xp: number
  /** Base gold reward (scaled by node type in run-gen). */
  gold: number
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
  /** Between-runs shop stock (`docs/phase-3-run-loop-plan.md` §5). */
  shop: ShopStock
  /** Recruitment offers (`docs/phase-3-run-loop-plan.md` §5). */
  recruitment: RecruitOffer[]
}

/**
 * A checkpointed run (`docs/data-model.md` §5, `phase-3-run-loop-plan.md` §6).
 * The map is pre-generated from the seed; battle resolution mutates node
 * state only — the run layer owns rewards and meta transitions.
 */
export interface ActiveRun {
  seed: number
  profileId: string
  /** Snapshot of characterIds (geared as snapshot). */
  party: string[]
  /** 3 | 5 | 10 (starter subset, decision S11). */
  length: number
  /** Pre-generated run map. */
  nodes: RunNode[]
  currentNodeIndex: number
  goldEarned: number
  /** itemIds banked; converted to inventory at run resolution (S8). */
  drops: string[]
  status: RunStatus
}

export type RunStatus = 'active' | 'won' | 'lost' | 'abandoned'

export type RunNodeType = 'battle' | 'elite' | 'rest' | 'boss'
// 'shop' | 'event' stay in data-model.md as v1 candidates — not generated in P3 (S1).

export interface RunNode {
  type: RunNodeType
  /** Step index — drives difficulty scaling (`docs/roadmap.md` locked #18). */
  index: number
  /** Branching options for this step (2–3 visible choices, decision S9). */
  choices?: { type: RunNodeType; label: string }[]
  /** Resolved squad for battle/elite/boss nodes (seeded at creation). */
  enemySquad?: EnemyDef[]
  /** Pre-rolled reward stub — actual gold rolled at battle end. */
  gold?: number
}

export interface RunResult {
  status: 'won' | 'lost' | 'abandoned'
  survivors: string[]
  koIds: string[]
  goldBanked: number
  itemsBanked: string[]
  /** Permanent GearInstance ids (P3 gear is all-permanent, decision S5). */
  gearBanked: string[]
  xpGained: Record<string, number>
}

/**
 * The seeded reward outcome of a won battle (`phase-3-run-loop-plan.md` §5, M3).
 * Gold/drops are rolled with the battle's seeded RNG; `xp` is awarded per
 * surviving party member (no leveling, decision S7) and accumulates onto the
 * character so it survives the run.
 */
export interface RewardRoll {
  gold: number
  /** itemIds banked to inventory at run resolution (S8). */
  drops: string[]
  /** survivorId → xp awarded (sum of defeated squad xp). */
  xp: Record<string, number>
}

export interface ShopStock {
  /** Potion itemIds always on sale (S10). */
  always: string[]
  /** Rotating itemIds — 4 gear + 3 skill items per refresh (S10). */
  rotating: { gear: string[]; skills: string[] }
}

export interface RecruitOffer {
  id: string
  character: Character
  /** Flat gold price (S6). */
  price: number
}

export interface SaveFile {
  schemaVersion: number
  savedAt: number
  profile: PlayerProfile
  /** Checkpointed run, if any. */
  activeRun?: ActiveRun
}

// Locked design constants (docs/roadmap.md).
export const BOX_COUNT = 10
export const BOX_SIZE = 30
export const PARTY_SIZE = 4

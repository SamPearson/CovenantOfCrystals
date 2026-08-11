# Data Model

TypeScript sketches of the core entities. These are **design artifacts**, not
final code — they lock in vocabulary and structure so the wiki and the code
stay in sync. Balance numbers belong in data files, not here.

---

## 1. Identity, stats & durability

```ts
type StatKey = 'hp' | 'atk' | 'def' | 'mag' | 'res' | 'spd';

interface StatBlock {
  hp: number;  atk: number;  def: number;
  mag: number;  res: number;  spd: number;
}

// The durability template: permanent, or expires after N runs.
type Durability =
  | { kind: 'permanent' }
  | { kind: 'expires'; runsRemaining: number };
```

See `durability.md` for semantics (use-based counting, ticks at run
resolution).

---

## 2. Character

```ts
interface Character {
  id: string;                 // unique instance id (uuid)
  classId: string;            // → ClassDef
  name: string;               // auto-generated, player-editable
  level: number;
  xp: number;                 // xp-to-next derived from a curve by level
  base: StatBlock;            // from class + level curve
  gear: {
    weapon?: string;          // itemId → ItemDef (type: 'weapon')
    armor?: string;           // itemId → ItemDef (type: 'armor')
  };                          // no accessory slot in v1 (locked)
  learnedSkills: string[];    // skillIds
  loadout: string[];          // equipped skillIds (e.g., max 4)
  durability: Durability;     // permanent, or expires after N runs
  earned: {
    runs: number;
    wins: number;
    drops?: string[];         // items collected but not yet banked (mid-run)
  };
}
```

---

## 3. Class, skill, item definitions (data-driven)

```ts
interface ClassDef {
  id: string;
  name: string;
  role: 'tank' | 'melee' | 'ranged' | 'mage' | 'healer' | 'support';
  baseStats: StatBlock;       // level-1 stats
  growth: StatBlock;          // per-level deltas (or a curve formula)
  learnSet: { skillId: string; level: number }[];
  loadoutSize: number;        // active skill slots (4 for now, tweakable)
  passive?: string;           // passive id, optional
}

type SkillKind = 'damage' | 'heal' | 'buff' | 'debuff' | 'utility';
type Element = 'fire' | 'water' | 'frost' | 'earth' | 'holy' | 'shadow' | 'none';

interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  element: Element;
  power: number;              // damage base (0 for non-damage)
  scaling: StatKey;           // atk or mag (or 'hp%' for heal scaling)
  targets: 'single' | 'all-allies' | 'all-enemies' | 'self';
  cost: number;               // mp cost
  cooldown?: number;          // turns before reuse, optional
  effect?: StatusEffect[];    // applied on hit
}

type ItemType = 'weapon' | 'armor' | 'consumable' | 'tome' | 'misc';

interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  statBonus?: Partial<StatBlock>;
  skill?: string;             // for tomes: skillId granted
  use?: { healHp?: number; healMp?: number };
  value: number;              // base gold value
}
```

**No revive skills/items** (`combat.md` §4) — `SkillKind` and `ItemDef.use`
have no revive fields.

---

## 4. Storage & meta

```ts
interface Box {
  id: string;
  name: string;
  slots: (string | null)[];   // characterIds
}

// Stackable consumables vs. unique gear instances (each carries durability).
interface Inventory {
  items: { itemId: string; count: number }[];   // consumables / stackables
  gear: InventoryGear[];                        // unique instances
}

interface InventoryGear {
  id: string;                 // instance id (uuid)
  itemId: string;             // → ItemDef
  durability: Durability;
}

interface PlayerProfile {
  profileId: string;
  displayName: string;
  gold: number;
  unlockedClasses: string[];
  boxes: Box[];
  inventory: Inventory;
  party: string[];            // characterIds committed to the next run
  stats?: { totalRuns: number; wins: number; losses: number };
  createdAt: number;
}
```

---

## 5. Run & battle state

```ts
interface ActiveRun {
  seed: number;               // seeded RNG → reproducible run
  profileId: string;
  party: string[];            // snapshot of characterIds (geared as snapshot)
  nodes: RunNode[];           // pre-generated from seed
  currentNodeIndex: number;
  status: 'active' | 'won' | 'lost' | 'abandoned';
  goldEarned: number;
  drops: string[];            // itemIds collected, banked at run end
}

interface RunNode {
  type: 'battle' | 'elite' | 'boss' | 'rest' | 'shop' | 'event';
  enemySquad?: EnemyDef[];    // for battle nodes
  content?: unknown;          // shop stock / event choices
}

interface EnemyDef {
  id: string;
  name: string;
  level: number;
  stats: StatBlock;
  skills: string[];
  ai: string;                 // ai behavior profile id
  isBoss?: boolean;
}

interface BattleState {
  seed: number;
  actors: BattleActor[];      // player characters + enemies, resolved stat blocks
  turnOrder: string[];        // actorIds
  round: number;
  log: BattleLogEntry[];
  status: 'ongoing' | 'won' | 'lost' | 'fled';
  over: boolean;
}

interface BattleActor {
  sourceId: string;           // characterId or enemyId
  isEnemy: boolean;
  name: string;
  stats: StatBlock;
  hp: number;                 // current
  mp: number;                 // current
  statuses: ActiveStatus[];
  ko: boolean;                // no revives: ko at battle end = permadeath
}

interface ActiveStatus {
  kind: string;               // 'burn' | 'atkUp' | 'stun' | …
  duration: number;           // remaining turns
  power?: number;             // magnitude
}
```

---

## 6. Save file envelope

```ts
interface SaveFile {
  schemaVersion: number;      // migration chain keyed on this
  savedAt: number;
  profile: PlayerProfile;
  activeRun?: ActiveRun;      // checkpointed run, if any
}
```

---

## 7. Modeling notes

- **IDs are strings** everywhere; data defs use string IDs, instances use
  UUIDs.
- **No derived state is stored** — current HP/MP live only in `BattleState`;
  save files never persist mid-battle (see `autobattle-and-idle.md`).
- **Gear on a character is a snapshot** during a run; changes to the
  persistent inventory don't mutate a run in progress.
- **Durability ticks at run resolution**: `runsRemaining` decrements once per
  run the asset participates in; assets at 0 after the run are removed. Gear
  is not destroyed by a character's death (it returns to inventory) unless it
  was already due to expire that run — see `durability.md`.

---

## Open questions (remaining)

1. Are `drop` items banked immediately or held per-character mid-run? (Detail
   for the run-rewards flow, Phase 3.)

Decision log: `roadmap.md`.

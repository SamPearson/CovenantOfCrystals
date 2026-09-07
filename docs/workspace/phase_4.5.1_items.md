# Sprint 1 Plan — Items: Stat-Shots, Tomes & Gear-Granted Skills

> Working doc for the item-system build. Complements the design overview in
> `docs/specs/items.md`. Decisions land in the `roadmap.md` decision log
> (round 7).
>
> This sprint is the first of a three-part group (Items → Scripting → Classes)
> that turns the mid-game hand-wave "just create items that boost stats and
> grant skills" into a shipped, mechanically complete customization pipeline.

## 1. Goal

Ship the **item application system**: items become the primary way to modify a
character's shape between runs. Two new item types (**stat-shot**, **skill-tome**
as an out-of-battle application flow) land alongside a new equipment field
(**gear-granted skills**). All are wired to a new **Apply Item** UI in the
meta/home view; changes flow through the store, persist across save/load, and
show up in battle formulas immediately.

This sprint is the *application* layer. Sprint 2 (scripting) will consume the
richer skill pools this sprint produces; Sprint 3 (classes) will define the
starting shape items diverge from.

**Balance is explicitly out of scope.** No stat caps, no drop-rate tuning, no
pricing curves. The goal is mechanical completeness; Phase 5 tunes numbers.

## 2. Status

- **Planning.** No code landed yet. This document is the working build plan.
- Baseline: Phase 3 complete + Phase 4 M1–M2 done (autobattle presets, per-card
  toggle); the `ItemDef` shape already supports `castSkill` scrolls and
  `use.healHp/healMp` potions from Phase 3.

## 3. Design decisions (this planning session)

Settled in the three-sprint scoping conversation. These become `roadmap.md`
decision-log round 7.

| # | Question | Decision |
| --- | --- | --- |
| I1 | Item scope for this sprint? | **stat-shot** (permanent base-stat +N) + **skill-tome** (permanent skill grant) + **equipment gear-granted skills**. Scrolls, potions, active-use items already ship from Phase 3 — unchanged. |
| I2 | Temporary/run-duration skill items? | **Cut.** No shards this sprint. Tomes are permanent; scrolls are single-use. Simpler surface. |
| I3 | Stat-shot cap? | **No engine cap.** Balance concern — deferred to Phase 5. Character `baseStats` are integer-additive. |
| I4 | Stat-shot rounding / negatives? | Whole integers only; **no negatives** (no debuff shots this sprint). |
| I5 | Tome learning restriction? | **Open to any character** (matches locked decision #45). Any tome teaches any character. |
| I6 | Gear-granting skills: which slots? | **Weapon and armor** (the two existing gear slots). No accessory slot in v1 (locked #21). |
| I7 | Unequipping gear that granted a loadout skill? | **Silently drop from loadout.** No prompt. The loadout picker handles re-selection next time the player visits. |
| I8 | Application UI location? | **New "Apply" tab** in the meta view (peer of Boxes / Party / Equip / Inventory / Shop / Recruitment). Lists applicable consumables + character picker. |
| I9 | Application flow: party vs. boxes? | **Both.** Character picker shows party first, then all boxed characters. |
| I10 | Preview before confirmation? | **Yes.** Show "Knight-01 ATK: 12 → 13" or "Knight-01 will learn Fireball" before consuming. |
| I11 | Skill source display in loadout picker? | **Yes** — tag each skill with `native`, `learned`, or `gear` (foundation for the Sprint 2 scripting UI to filter on). |
| I12 | Selling stat-shots / tomes? | **Not this sprint.** Consumables stay un-sellable (matches decision #54). |
| I13 | Rename `ItemDef.skill` (Phase 3 tome field) → `grantsSkill`? | **Yes.** Read the old field for backwards compat during migration; write `grantsSkill` going forward. |

## 4. Scope

### In scope (this sprint)

- **New item types:** `stat-shot` (out-of-battle stat boost), `skill-tome`
  (out-of-battle skill grant — already partially exists as consumable `tome`,
  formalized here). Equipment gains an optional `grantsSkillWhenEquipped` field.
- **`src/core/items/`** — new pure module: `apply-stat-shot`, `apply-tome`,
  `skill-pool` (compute the character's effective skill pool from all sources),
  validation helpers. No Phaser.
- **Store actions:** `applyStatShot(characterId, itemId)`,
  `applyTome(characterId, itemId)`, and skill-pool recomputation on gear
  equip/unequip.
- **Meta UI:** new **Apply panel** (`src/game/ui/panels/apply-panel.ts`), plus
  character-detail card updates (stat display now shows post-boost values),
  loadout picker source tags, and gear-detail "grants: <skill>" line.
- **Battle read path:** `getSkillPool(character)` is the single source of truth
  for what skills a character has access to; loadout is validated to be a
  subset. Battle formulas already read `Character.baseStats` so the stat-shot
  path lights up automatically.
- **Save/load:** stat-shot and tome effects are already in
  `Character.baseStats` / `Character.learnedSkills`, so no schema bump needed
  for those. Gear-granted skills read from `ItemDef` at compute time (also no
  schema bump). Rename migration (`ItemDef.skill` → `grantsSkill`) is a data
  edit, not a save migration.
- **Data:** seed a handful of stat-shot and tome items in `core/data/items.ts`
  and `core/data/skill-items.ts` so the Apply UI and shop have something to
  show. Add one or two starter gear pieces with `grantsSkillWhenEquipped` for
  demo purposes (e.g., Flame Staff → Fireball).

### Out of scope (deferred)

- **Balance tuning** — Phase 5.
- **Stat caps, negative boosts, debuff shots** — future items.
- **Shards / run-duration skill grants** — cut.
- **Passive effects from items** (auras, always-on triggers) — Sprint 3 / later.
- **Multi-target item application** (apply to whole party at once) — future UI.
- **Undo an application** — no, applications are permanent.
- **Accessory slot** — locked out (#21).
- **Class restrictions on tomes** — locked out (#45).

## 5. Module layout

### `src/core/items/` (new — pure, unit-testable)

- **`apply.ts`** —
  - `applyStatShot(character, itemDef): { character, itemConsumed }` — validates
    the item is a `stat-shot`, mutates a copy of `character.baseStats`, returns
    updated character + a flag to decrement inventory.
  - `applyTome(character, itemDef): { character, itemConsumed, alreadyKnown }` —
    validates the item is a `tome`, adds to `learnedSkills` if not present,
    returns updated character + a flag to decrement inventory (still consumes
    even if already known? **decision: no — refuse to apply if known**, surface
    that in the UI). Returns `alreadyKnown: true` for the UI to show a message.
- **`skill-pool.ts`** —
  - `getSkillPool(character, equippedGear, itemDefs, skillDefs)` →
    `{ skillId: string; source: 'native' | 'learned' | 'gear' }[]`
  - `validateLoadout(character, pool)` → drops any loadout entries not in the
    current pool; returns the pruned loadout.
- **`index.ts`** — re-exports.
- **`apply.test.ts`**, **`skill-pool.test.ts`** — Vitest suites.

### `src/core/`

- **`types.ts`** — additions in §6.
- **`store.ts`** — new actions:
  - `applyStatShot(characterId, itemId)`
  - `applyTome(characterId, itemId)`
  - Extend the existing `equip` / `unequip` actions to re-validate the affected
    character's loadout against the new skill pool (drop stale entries).
- **`save.service.ts`** — no schema bump needed. Verify the load path
  round-trips modified `baseStats` and `learnedSkills` (already does).

### `src/core/data/`

- **`items.ts`** — seed items:
  - `shot_atk_1` (Vial of Strength, +1 ATK)
  - `shot_def_1` (Vial of Fortitude, +1 DEF)
  - `shot_hp_5` (Essence of Vitality, +5 HP)
  - one shot per stat at low tier for the demo surface
  - one demo weapon: `staff_flame` → `grantsSkillWhenEquipped: 'fire_1'`
- **`skill-items.ts`** — no code change; the existing `tomeFor(skillId)`
  generator already produces `type: 'tome'` items. The field rename
  (`skill` → `grantsSkill`) is a data edit here.

### `src/game/ui/panels/`

- **`apply-panel.ts`** (new) — the Apply tab.
  - Left column: list of applicable consumables (stat-shots + tomes) with
    counts.
  - Middle column: character picker (party first, then boxes).
  - Right column: preview + confirm button.
- Existing panels updated:
  - **`character-detail.ts`** — stats section now shows the current
    `baseStats` values (source of truth); optionally show a per-stat "+N from
    shots" breakdown as a tooltip.
  - **`equip-panel.ts`** — loadout picker gets source tags (`native` / `learned`
    / `gear`) next to each skill; skills granted by unequipped gear disappear
    from the pool as expected.
  - **`inventory-panel.ts`** — distinguish "battle consumables" from
    "applicable items" for clarity.

### `src/game/scenes/`

- **`MetaScene.ts`** — register the new Apply tab in the meta tab bar.
- **`BattleScene.ts`** — no changes required; it already reads `baseStats` for
  formulas and `loadout` for skill buttons.

## 6. Data-model & types surface changes
```
typescript
// types.ts

// ItemType expanded
type ItemType =
| 'weapon'
| 'armor'
| 'consumable'
| 'tome'
| 'scroll'
| 'stat-shot'   // NEW
| 'misc';

interface ItemDef {
// existing...
boostStat?: { stat: StatKey; amount: number };  // NEW: stat-shot payload
grantsSkill?: string;                            // RENAMED from `skill` — tomes
castSkill?: string;                              // scrolls (exists, Phase 3)
grantsSkillWhenEquipped?: string;               // NEW: gear-granted skill
use?: { healHp?: number; healMp?: number };    // active-use (exists)
}

// Character — no shape change; baseStats and learnedSkills already exist
// and are the persisted source of truth for applied effects.

// Skill pool result (not persisted; computed on read)
interface SkillPoolEntry {
skillId: string;
source: 'native' | 'learned' | 'gear';
}
```
Notes:
- **No `SaveFile` schema bump.** All new state lives in fields that already
  persist (`baseStats`, `learnedSkills`, `inventory.items`, gear instances).
  The `ItemDef` rename is a data-file edit, not a save concern.
- **Skill pool is derived**, not stored. Recomputed whenever the loadout picker
  opens or gear equipped changes. Validation prunes stale loadout entries.
- **Gear-granted skills** don't need per-instance data — they read from the
  `ItemDef` referenced by the equipped `GearInstance.itemId`.

## 7. Milestones & exit criteria

### M1 — Data-model & types surface
- `types.ts`: `ItemType` gains `'stat-shot'`; `ItemDef` gains `boostStat`,
  `grantsSkillWhenEquipped`; rename `skill` → `grantsSkill` across data files.
- `core/data/items.ts`: seed stat-shot items + one demo gear-granting weapon.
- Data-integrity tests: every stat-shot references a valid `StatKey`; every
  `grantsSkill`/`grantsSkillWhenEquipped` references a real skillId; the
  Phase 3 tome generator still produces valid items after the rename.
- Exit: `tsc --noEmit` clean; existing 408/408 tests still pass.

### M2 — Application core
- `core/items/apply.ts` + tests: `applyStatShot`, `applyTome` (with
  `alreadyKnown` guard).
- `core/items/skill-pool.ts` + tests: `getSkillPool`, `validateLoadout`.
- Store actions `applyStatShot`, `applyTome` wired to consume from
  `inventory.items` and mutate the target character.
- Equip/unequip actions revalidate the affected character's loadout.
- Exit: applying a shot changes `baseStats` and the change flows into
  `damage.ts` / `heal.ts` formulas; applying a tome adds to `learnedSkills`;
  equipping the flame staff surfaces `fire_1` in the pool for any class;
  unequipping drops it from the loadout silently.

### M3 — Meta UI: Apply panel
- `src/game/ui/panels/apply-panel.ts`: item list + character picker + preview +
  confirm.
- `MetaScene.ts`: register the Apply tab.
- Exit: player can apply a stat-shot or tome end-to-end from the meta view;
  UI refreshes; save persists across reload.

### M4 — Loadout picker & character-detail polish
- `equip-panel.ts`: source tags on skills; auto-refresh on gear change.
- `character-detail.ts`: show current stats (post-boost); optional tooltip
  breaks down per-stat modifications.
- `inventory-panel.ts`: category badges (equipment / battle / applicable).
- Exit: player can see at a glance which skills come from where and which stats
  have been modified. A Knight who applied 3 ATK shots and learned Fireball
  from a tome shows: base ATK reflects +3, Fireball is tagged `learned`, and
  putting Fireball in the loadout works in battle.

### Exit criteria (sprint-level)

- [ ] Stat-shot: application permanently modifies `Character.baseStats`; the
      new value drives battle formulas immediately; survives save/load.
- [ ] Tome: application permanently adds to `Character.learnedSkills`; skill
      appears in the loadout picker tagged `learned`; survives save/load.
- [ ] Gear-granting: equipping a weapon/armor with
      `grantsSkillWhenEquipped` adds the skill to the pool tagged `gear`;
      unequipping removes it and silently drops it from the loadout if present.
- [ ] Apply UI: complete flow (pick item → pick character → preview → confirm)
      from the meta view.
- [ ] Loadout picker shows skill source tags for every skill.
- [ ] Character-detail card reflects post-boost stats.
- [ ] Items are consumed correctly (inventory decrements); refusing to consume
      when a tome is already known.
- [ ] Full test suite green; `tsc --noEmit` clean.

## 8. Test matrix (Vitest)

| Area | Cases |
| --- | --- |
| `applyStatShot` | Valid shot mutates the right stat by the right amount; invalid item type rejected; invalid stat key rejected; consumed count = 1 |
| `applyTome` | Valid tome adds to learnedSkills; already-known → `alreadyKnown: true` + no consumption; invalid item type rejected |
| `getSkillPool` | Native + learned + gear all merged; sources tagged correctly; duplicates de-duplicated (native + tome of the same skill → 1 entry, source `native`); unequipped gear absent |
| `validateLoadout` | Stale entries pruned; valid entries kept; empty loadout allowed |
| Store actions | `applyStatShot` decrements inventory + updates character; `applyTome` handles already-known; `equip`/`unequip` triggers loadout revalidation |
| Battle integration | A character with applied stat-shots computes damage/defense with the new baseStats; loadout can contain a gear-granted skill and it fires correctly |
| Persistence | Applied stats + learned skills round-trip save/load; loadout pruning survives reload |
| Data integrity | Every seeded stat-shot has a valid stat + amount; every `grantsSkill` / `grantsSkillWhenEquipped` resolves to a real skillId |

## 9. Risks / notes

- **`ItemDef.skill` rename** — Phase 3 auto-generates tomes with a `skill`
  field. The rename is mechanical (find/replace + a codemod for the tome
  generator) but touches shop/inventory data. Do this first in M1 and run the
  full suite before moving on.
- **Loadout silent drop** — when unequipping gear that granted a loadout
  skill, we drop it without prompting. This can be a mild "why did my skill
  disappear?" moment. Mitigation: source tags in the picker make the cause
  obvious next visit; consider a Phase 6 toast/notification.
- **Skill pool computation cost** — recomputed on every loadout picker open
  and gear change. This is cheap (small arrays); no memoization needed.
- **No schema bump** — nice, but means old saves silently gain the new
  behavior. Test: load a Phase 3 save, apply a shot, save, reload → still
  works.
- **Stat-shot power creep** — with no cap, a player can dump 100 ATK shots on
  a character. That's fine (balance concern); Phase 5 introduces caps or
  diminishing returns if needed.
- **Sprint 2 dependency** — the scripting sprint will need a richer
  `SkillDef` (tags, type: passive/active/reactionary). Those additions are
  Sprint 2's problem; this sprint only touches items.

## 10. Landing this

Keep `docs/specs/items.md` current as decisions solidify; log any new
decisions in `roadmap.md` (round 7). When the sprint lands, Sprint 2
(scripting) consumes the enriched skill pool this sprint produces, and Sprint
3 (classes) will formalize what the "native" source tag means.
```



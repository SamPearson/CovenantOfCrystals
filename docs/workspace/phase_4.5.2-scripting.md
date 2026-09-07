# Sprint 2 Plan — Character Scripting & Automation Window

> Working doc for the character-scripting build. The full design spec lives in
> `docs/specs/character-scripting.md`; decisions land in the `roadmap.md`
> decision log (round 8).
>
> This is the second of the three-sprint group (Items → Scripting → Classes).
> It builds on Sprint 1's enriched skill pool (native + learned + gear-granted)
> and consumes the Phase 4 M1 interpreter as its execution seed. It is also
> the Phase 4 M6 "script DSL v2" milestone, promoted to its own sprint.

## 1. Goal

Ship the **character scripting system** end-to-end: a data-driven DSL that
defines how a character behaves in autobattle, a UI ("**Automation Window**")
that lets the player CRUD scripts without writing text, first-class support
for **passive** skills alongside active skills, a **reactions sheet** that
fires skills/items off battle events (in both AUTO and MANUAL), and
integration into the run/battle loop so scripted characters act autonomously.

This sprint replaces the two curated presets (`dps` / `healer`) from Phase 4
with a full **script library** that the player owns, edits, and assigns per
character. The presets become read-only "built-in" scripts in the library so
new players have a starting point.

**Balance is out of scope.** No CTB cost tuning, no script-power caps. The
`reactionTo` restriction field is shipped as a *mechanism* with example seeds;
the specific gates each skill/item permits are data, tuned in Phase 5.
Mechanical completeness only.

## 2. Status

**Complete — M1 through M7 landed; all sprint exit criteria met.**

- **M1 — DSL types + turn interpreter core: LANDED, green.**
  `src/core/scripting/{types, conditions, targets, skill-selector, interpreter}.ts`
  rewritten to the §6 surface; built-in `dps` / `healer` scripts rewritten in
  the full DSL; `validation.ts` updated for the `action` field, `fallback`,
  `reactions`, and metadata. `npm run build` clean; full suite
  **509/509 green** (35 files).
- **M2 — Passives, event bus, reactions: LANDED, green.**
  `SkillType = 'active' | 'passive'` (no `reactionary`); `SkillDef.reactionTo?`
  + `tags` real; `ItemDef.reactionTo?` added; `combat/reactionaries.ts` (the
  old prototype model) **deleted**. `combat/passives.ts` applies loadout
  passives (+ `all-allies` fan-out) at battle start; `combat/battle-events.ts`
  is the pure event/match module; `BattleState` gained `pendingEvents`,
  `reactionQueue`, and `reactionResolver?` (the event bus is dormant until the
  run layer installs a resolver — M6); `reactions.ts` evaluates the sheet
  (gate + conditions + event-relative ctx) and routes to inline (`delay: 0`)
  or scheduled (CTB-delay) execution; `battle.ts` emits all eight `EventKind`s
  and clears the bus inside `performAction`. Seeds: passives `fortress`,
  `reckless`, `toughness`, `regen_aura`; reaction actives `steal`,
  `guardians_vow`, `thorns`; potion `reactionTo`. See the progress log below.
- **M3 — Store, persistence, migration: LANDED, green.**
  `SCRIPT_LIBRARY_CAP = 50` enforced on `createScript` / `duplicateScript`; the
  library CRUD surface (`createScript`, `updateScript`, `deleteScript`,
  `duplicateScript`, `assignScript`) covered by tests incl. reload
  persistence, built-in guards, and cap enforcement. Save migration v2→v3
  (seed built-ins by id; map `autobattle` `dps`/`healer` → `scriptId`)
  re-verified. Full suite **542/542 green** (35 files).
- **M4 — Automation Window UI: LANDED, green.**
  `automation-panel.ts` (library column host: `AutomationPanel extends Panel`,
  owns selection + pager, wires library CRUD to the store), `script-library-panel.ts`
  (`renderLibrary`: header + capacity badge, New/Edit/Copy/Delete row, paged
  rows with selection + assigned-count badges), and `script-editor-panel.ts`
  (DOM overlay above the canvas, Theme-Studio style: script name input,
  numbered priority rule cards with expand/collapse + reorder, trigger
  conditions + operator, target rules, skill/item selectors with all eight
  filter kinds, nested blocks to depth 2, locked `∞` fallback, reaction rules
  whose action picker is filtered by the gate's `reactionTo`). Character-detail
  card's Phase 4 `Off/DPS/Healer` selector replaced with a library-backed
  cycle (`‹ / ›`) over Manual + every library script, wired to `assignScript`.
  MetaScene registers an **Automation** tab (tab bar rescaled 108→96px,
  116→104px step to fit 9 tabs at 960px) whose panel hosts the library and
  opens the editor overlay on New/Edit; the overlay is dismissed when the tab
  is left. `tsc --noEmit`, production build, and full suite **542/542 green**
  (35 files).
- Baseline: Phase 4 M1 shipped a minimal interpreter extension (`mp-pct`,
  `can-cast`, `and`, `any`) and the `dps` / `healer` presets. Phase 4 M2
  shipped the per-card AUTO/MANUAL toggle. This sprint completes the vision
  M6 sketched.
- Sprint 1 (items) is assumed complete: skill pools include native + learned
  + gear-granted skills; the Apply panel is live.

### Progress log

- **M1 (done):** scripting layer rewritten to §6; `CharacterScript.fallback?`
  added (round-9 log); built-ins in full DSL; interpreter equivalence vs the
  Phase 4 presets proven by test; `tsc` / suite green.
- **M2 (done):** passives + event bus + reactions wired and green; the old
  `reactionaries.ts` prototype removed; seeds landed. Reaction-bus tests
  (`battle-events.test.ts`), `reactions.test.ts`, passives + reaction
  determinism, and the delayed-reaction scheduling case all landed with the
  wiring; `combat/index.ts` re-exports the two new modules. TSC + full suite
  green through the M2 close.
- **M3 (done):** `SCRIPT_LIBRARY_CAP = 50` enforcement + library CRUD tests
  (`store.test.ts`, 12 new cases incl. reload persistence, built-in guards,
  cap-on-create and cap-on-duplicate); v2→v3 migration re-verified; suite +
  build green through the M3 close.
- **M4 (done):** Automation Window UI landed — `automation-panel.ts`,
  `script-library-panel.ts`, `script-editor-panel.ts` (DOM overlay, template_002
  style), Automation tab in MetaScene (tab bar rescaled to 9 tabs), and the
  character-detail card's preset selector replaced with a library-backed cycle
  (`assignScript`). `tsc --noEmit`, production build, and full suite
  **542/542 green** (35 files) through the M4 close.
- **M5 (done):** interpreter refactor (`chooseScriptedPick` + `ScriptPick`
  with `block/line/fromFallback`, single walk path; `chooseScriptedAction` is
  now a thin wrapper) + **dry-run module** `src/core/scripting/dry-run.ts`
  (`createDryRunBattle` = shared `createBattle` path; `applyDryRunMocks`;
  `dryRunChooseAction`; `dryRunCheckReactions`; `ruleCardIndex` DFS). Added
  `BattleActor.items?: string[]` to combat types. 11 dry-run tests landed.
  Then the **script-editor dry-run preview UI**: turn mock (class select,
  HP/MP sliders, turn counter, status togglers) with a "Run" button showing
  rule/target/action pick (or fall-through to ∞ fallback), plus an event mock
  (kind/source/target) with "Apply" showing which reactions fire and at what
  delay. Preview CSS (`.se-preview-*`) landed in style.css. Verified: `tsc
  --noEmit` clean, production build green, **553/553** (36 files) through the
  M5 close.
- **M6 (done):** `BattleScene.ts` AUTO path now runs library scripts —
  `resolveAutoScript(actorId)` (assigned script else `dps`/`healer` built-in)
  + `resolveReactionScript(actorId)`, `pump()` resolves with
  `chooseScriptedAction(script, buildScriptContext(...))`, and after
  `createBattle` the run sets `battle.reactionResolver` so library-sheet
  reactions fire in both AUTO and MANUAL. Tests: presecutor-equivalence
  (seeded scripted run == `dps`-preset run, actor hp/mp/ko + turn count),
  library-script same-action-as-preset, thorns reactions fire from the
  assigned library sheet in AUTO and in MANUAL. Verified: `tsc --noEmit`
  clean, production build green, **557/557** (36 files) through the M6 close.
  Item rules in library sheets still no-op in real battles (battle actors
  start with no items) — deferred to M7.
- **M7 (done):** battle item wiring — `resolveItem` in `battle.ts` now spends
  the used item from `BattleActor.items` (scrolls before cast, potions after
  the heal), shared by the turn-action and reaction paths (`executeReaction` →
  `resolveItem`). `BattleScene.create()` calls `seedBattleItems()` which loads
  each player actor with the profile's battle-usable consumables
  (`use || castSkill`), and `dispatch()` snapshots player item lists before
  `performAction` and diffs after — consuming spent items from the shared
  profile (`removeItem`) and all player actors in one pass, covering reaction
  item uses too. `health_potion`/`greater_health_potion` gained `reactionTo:
  [{ kind: 'attacked' }, { kind: 'status-applied' }]` (docs/specs/items.md
  claimed it since M2 but the data never carried it), making `source: 'items'`
  reaction rules reachable. Tests: turn-item consumption removes one from
  `actor.items`; reaction item use consumes it from `actor.items` while the
  heal resolves. Verified: `tsc --noEmit` clean, production build green,
  **559/559** (36 files) through the M7 close.

## 3. Design decisions (this planning session)

Settled in the three-sprint scoping conversation, the `character-scripting.md`
spec review, and the prototype-driven design pass against
`docs/script_window_template/template_002`. These become `roadmap.md`
decision-log round 8. Items marked **revised** supersede earlier plans.

| # | Question | Decision |
| --- | --- | --- |
| S1 | Script structure | **Script Line (rule)** = trigger + target + action selector. **Script Block** = a set of rules with an overall trigger. **Script** = root block + reactions sheet. Nesting allowed to **depth 3** (root + 2 nested layers). |
| S2 | Trigger shape | **1 to 3 condition clauses**, each a single `Condition` (carrying its own scope), combined with `AND` / `OR`. Missing trigger = always true. *Revised:* per-clause Priority and per-clause Target are gone — the rule has one target and its position in the block is its priority. |
| S3 | Target selector | **One target per rule**: a target kind + optional narrowing condition. |
| S4 | Skill selector | A list of filters (ANDed) applied to a **source pool** (loadout skills OR usable items). **Matching actions are chosen at random** among the full match set. *Revised:* was "first matching skill wins". |
| S5 | Skill selector can use items? | **Yes.** Selector `source` is `'skills'` or `'items'`. When `items`, the pool is the character's usable inventory items (potions, scrolls, active-use). |
| S6 | Skill selector filter vocabulary | `byId`, `byElement`, `byTag`, `byKind` (heal/damage/buff/debuff/utility), `byMpCost` (absolute or %), `byCooldownReady`, `byCastDelay` (CTB delay), `byPower`. Extensible. |
| S7 | Passive skills | **Always active.** Applied at battle start; effect persists until battle end. `SkillDef.type = 'passive'`. |
| S8 | Reactionary skills | **No reactionary skill type.** Reactions are **authored rules on the script's reactions sheet**, fired off the **battle event bus** (see S21–S23). *Revised:* replaces `SkillDef.type = 'reactionary'` + `reactTo`. |
| S9 | Reaction timing / CTB | A reaction rule may set its own **`delay`** (CTB cost) which overrides the selected action's `delay`; `0` = instant (resolve inline, no queue disturbance). Default = the action's `delay`. |
| S10 | Reaction source restriction | Reaction action pools are the **loadout skills** / **usable inventory items** — the same source pools as turn rules. No "learned-but-dormant" skills react. |
| S11 | Passive source restriction | **Must be in the loadout** to be active. |
| S12 | Script assignment | Per character: `Character.scriptId` references a `CharacterScript` in the profile's `scriptLibrary`. Optional; unset = Manual (unchanged from Phase 4). |
| S13 | Script library scope | **Per profile.** Scripts live on `PlayerProfile.scriptLibrary` and are usable by any character in that profile. |
| S14 | Built-in scripts | The Phase 4 `dps` and `healer` presets ship as **read-only** entries in the library (cannot be edited or deleted; can be duplicated to a new editable script). |
| S15 | Editing a library script | **Live** — a character using the edited script picks up changes on the next turn. The editor's "Save" button is a commit-on-exit affordance, not a separate assign step. |
| S16 | Script authoring UX | **Structured, not text.** The grimoire-style prototype (`template_002`) is the visual reference: library panel + numbered rule list + collapsible rule editor (condition rows joined by AND/OR chips, target card, action picker) + locked **∞ fallback**. No raw DSL editor in v1. |
| S17 | Script dry-run / preview | **Yes** — a "test this script" panel running turn rules against a mocked battle state, plus a reaction dry-run against a mocked event stream. Deterministic (seeded). |
| S18 | Fallback when no rule matches | **User-customizable, un-removable final rule** whose trigger is *always true*; only its target and action are configurable. Default: attack the enemy with the lowest health. *Revised:* was "Defend". |
| S19 | Script execution order | **Priority = position.** Rules run top-down (lowest number first); **first-true wins**; a winning rule that resolves empty falls through. Nested blocks: parent trigger must fire to enter; then evaluate children top-down. If nothing matches, the fallback runs. |
| S20 | Item-based script lines and consumption | Using an item via a script **consumes** it. No difference from manual item use. |
| S21 | Reaction restriction | **`SkillDef.reactionTo?: EventPattern[]`** and **`ItemDef.reactionTo?: EventPattern[]`** — the gates a skill/item is legal in; absent/empty = **never usable as a reaction**. Enforced at three layers: editor filters the action picker, the store rejects illegal saves, the interpreter re-validates at runtime. |
| S22 | Reaction event vocabulary | v1 kinds: `attacked`, `evaded`, `ally-kod`, `status-applied`, `status-removed`, `enemy-casts`, `turn-start`, `turn-end`. `EventPattern = { kind; source?: 'self'\|'ally'\|'enemy'; target?: 'self'\|'ally'\|'enemy' }`. Extensible. |
| S23 | Event-relative targeting | Condition scopes and target kinds gain `attacker`, `trigger-target`, `previous-trigger-target` (valid inside reactions). |
| S24 | Condition vocabulary additions | `stat-compare` (flat or % of base — "Enemy Defense < 30", "Self MP < 30%"), `weak-to` (element — "Weak to Fire"), `enemy-rank` ("is Elite OR Boss"), `has-status` (present flag). |
| S25 | Library capacity | **`SCRIPT_LIBRARY_CAP`** — a global, developer-configurable constant (default 50); the UI shows `N / 50 scripts`; `createScript` refuses at the cap. |
| S26 | Script metadata | `name`, optional `description`, optional `art` glyph. The editor shows an **ACTIVE** badge when the open script is the script assigned to the selected character. |
| S27 | Randomness & dry-run | Random match selection consumes the **seeded RNG**; dry-run remains deterministic given a seed. |

## 4. Scope

### In scope (this sprint)

- **DSL types** in `src/core/scripting/types.ts`: `Script`, `ScriptBlock`,
  `ScriptLine`, `Trigger`, `Condition` (extended vocabulary), `TargetRule`,
  `SkillSelector`, `SkillSelectorFilter`, plus the reaction surface:
  `EventKind`, `EventPattern`, `ReactionRule`.
- **Turn interpreter** in `src/core/scripting/interpreter.ts`:
  `chooseScriptedAction(script, battleState, actorId, rng)` — walks the rule
  tree (priority order, first-true wins, nested blocks, fallback), returns a
  `BattleAction` (or `null` → the script's fallback rule). Pure, deterministic.
- **Reaction wiring** in `src/core/combat/`:
  - `battle-events.ts` — the battle **event bus**: events emitted after
    damage, missed/evaded attacks, status application/removal, KO, enemy
    casts, and turn start/end, each carrying its `source`/`target` actors and
    any context the reactions need.
  - `reactions.ts` — `checkReactions(battle, event)` — for each living actor
    with an assigned script, evaluate the script's reaction rules **in sheet
    order**: gate matches the event, conditions hold, and the resolved action
    is legal for it (`reactionTo` re-validation). Queue matching actions at
    their `delay` (may be `0`).
- **`SkillDef` extension** in `core/types.ts`: `type: 'active' | 'passive'`,
  `reactionTo?: EventPattern[]`, `tags: string[]`. **`ItemDef`** gains
  `reactionTo?: EventPattern[]`.
- **Store actions** on `src/core/store.ts`: `createScript`, `updateScript`,
  `deleteScript`, `duplicateScript`, `assignScript(characterId, scriptId)`;
  `createScript` enforces `SCRIPT_LIBRARY_CAP`.
- **Persistence:** `PlayerProfile.scriptLibrary` added; `Character.scriptId`
  added. Save schema bumped v2 → **v3** with a default-filling migration
  (seed the two built-in `dps` / `healer` scripts on load if missing).
- **Automation Window UI** in `src/game/ui/panels/`:
  - `automation-panel.ts` — the top-level tab. Two sub-panels:
  - `script-library-panel.ts` — list scripts, create/duplicate/delete, mark
    built-ins as read-only, show `N / 50` capacity.
  - `script-editor-panel.ts` — build/edit a script against the
    `template_002` visual language: numbered rule list, collapsible rule
    editor (condition rows + AND/OR chips, target card, action picker),
    nested blocks (add/remove, disabled at depth 3), locked **∞ fallback**
    editor, a **Reactions** section (gate + conditions + target + action +
    delay), and a dry-run preview.
  - Character-detail card gets a "Script: <name>" selector (replaces the
    Phase 4 `Off/DPS/Healer` selector — library-driven now).
- **Battle integration:** the ticker + AUTO code path from Phase 4 M2 swaps
  from `choosePartyAction(preset)` to `chooseScriptedAction(script)`, and
  `checkReactions` hooks into the event bus. Manual mode short-circuits the
  *turn* interpreter only — reactions still fire.
- **Data seeds:**
  - `src/core/data/scripts.ts` (new) — the two built-in scripts (`dps`,
    `healer`) in the full DSL, including small reaction sheets, as executable
    examples in the library.
  - `src/core/data/skills.ts` — every skill gets `type` (default `'active'`)
    + `tags`; seed 2–3 passives (e.g. "Toughness" — +5 DEF; "Regen Aura") and
    2–3 reaction-capable skills demonstrating `reactionTo` (e.g. "Steal" →
    `evaded` vs self; "Guardian's Vow" → `attacked` by enemy on any ally).
  - `src/core/data/items.ts` — `reactionTo` on key consumables (e.g. Potion →
    `attacked` / `status-applied`).

### Out of scope (deferred)

- **Free-text DSL editor** (parser, syntax highlighting) — Phase 6+ stretch.
- **Script sharing / import-export between profiles** — later.
- **Nesting past depth 3** — locked by the spec.
- **New condition kinds beyond the vocabulary** — extensible via additive
  PRs; this sprint ships the initial vocabulary and no more.
- **Passive stacking rules** (two passives that modify the same stat) —
  defer to Phase 5 balance; for now, simple additive stacking.
- **`reactionTo` tuning** — per-skill/per-item gates are data; Phase 5
  balance owns the actual values.
- **Reaction precedence across characters** — reactions interleave by their
  queue times in sheet order; more nuanced rules later.
- **Class-specific scripts** — Sprint 3's problem (starting-script assignment
  by class).
- **Script version migration** — scripts are user-authored data; if the DSL
  gains fields later, migrations run at load-time.

## 5. Module layout

### `src/core/scripting/` (new — pure, seeded)

- **`types.ts`** — full DSL type surface (see §6).
- **`interpreter.ts`** —
  - `chooseScriptedAction(script, ctx, rng)` → `BattleAction | null`.
  - Walks the root block (rule priority order): evaluates each rule's trigger
    top-down → first true rule resolves target + action → returns the action;
    if a rule resolves empty (no valid target, no matching skill/item), falls
    through; nested blocks recurse when their trigger fires; nothing matched →
    the fallback rule's action.
  - Match selection: when filters match several actions, pick one at random
    via `rng` (seeded).
  - Deterministic: consumes `rng` only for `random-*` targets and tie-matched
    action selection.
- **`conditions.ts`** — evaluate `Condition` against a battle context,
  including the event-relative scopes when in a reaction context.
- **`targets.ts`** — resolve a `TargetRule` to a list of actor IDs, including
  the `attacker` / `trigger-target` / `previous-trigger-target` cases.
- **`skill-selector.ts`** — apply a `SkillSelector` to a character's loadout
  skills or usable items; return the match set (random pick upstream).
- **`dry-run.ts`** — `dryRunScript(script, mockedState)` → a description of
  what the turn rules pick and why; plus a reaction view that applies a mocked
  event stream and reports which reactions would fire. Shares the interpreter
  and `checkReactions` code paths.
- **`*.test.ts`** — Vitest suites.

### `src/core/combat/`

- **`passives.ts`** (new) — `applyPassivesAtBattleStart(battle)` — scan each
  actor's loadout for `type: 'passive'` skills and apply their effect (via
  the same status/effect machinery statuses use).
- **`battle-events.ts`** (new) — the battle event bus: emit typed events
  (`attacked`, `evaded`, `ally-kod`, `status-applied`, `status-removed`,
  `enemy-casts`, `turn-start`, `turn-end`) with `source`/`target` actor
  filters and context.
- **`reactions.ts`** (new) — `checkReactions(battle, event)` — scan every
  living actor with an assigned script; for each script's reaction rules in
  sheet order: gate matches → conditions hold (event context) → action legal
  (`reactionTo` re-validation) → queue at `delay` (may be 0). Multiple
  qualifying reactions queue in sheet order.
- **`battle.ts`** — hook `applyPassivesAtBattleStart` into `createBattle`;
  hook `checkReactions` into `battle-events` after each event. Replace
  `choosePartyAction(preset)` call sites with `chooseScriptedAction(script)`.

### `src/core/data/`

- **`skills.ts`** — every skill gets a `type` field (default `'active'`),
  `tags`, and `reactionTo` where the skill is reaction-capable. Seed 2–3
  passives ("Toughness" +5 DEF; "Regen Aura" party regen) and 2–3
  reaction-capable skills ("Steal", "Guardian's Vow", "Thorns").
- **`items.ts`** — `reactionTo` on key consumables (Potion, Antidote).
- **`scripts.ts`** (new) — the two built-in `dps` / `healer` scripts in the
  full DSL, including small reaction sheets. Read-only, seeded into the
  library on first load.

### `src/core/`

- **`types.ts`** — DSL types + `Character.scriptId` +
  `PlayerProfile.scriptLibrary` + `SCRIPT_LIBRARY_CAP`.
- **`store.ts`** — script CRUD actions + `assignScript`; `createScript`
  guard at the cap; built-ins refused for edit/delete.
- **`save.service.ts`** — schema v2 → v3 migration: seed
  `profile.scriptLibrary = [dpsBuiltIn, healerBuiltIn]` if missing; migrate
  any character with the old `autobattle: 'dps'|'healer'` preset field to
  `scriptId: <matching-built-in-id>`; leave `autobattle` in place for one
  release as a fallback, then remove.

### `src/game/scenes/`

- **`MetaScene.ts`** — register the Automation tab in the meta tab bar.
- **`BattleScene.ts`** — the AUTO code path uses
  `chooseScriptedAction(script)` instead of `choosePartyAction(preset)`. If no
  script is assigned but AUTO is on, fall back to `dps` built-in. Manual mode
  short-circuits turn actions only; `checkReactions` always runs.

### `src/game/ui/panels/`

- **`automation-panel.ts`** — top-level tab with two sub-panels.
- **`script-library-panel.ts`** — script list, create, duplicate, delete,
  built-in badges, capacity meter (`N / 50`).
- **`script-editor-panel.ts`** — the visual editor (visual reference:
  `template_002`):
  - Library-selected script header: name/description/art, ACTIVE badge.
  - **Turn rules** list: numbered `01..N` rule cards; expand/collapse; add,
    remove, reorder; each card edits trigger (condition rows + AND/OR chips),
    target, action.
  - **Nested blocks**: add/remove, disabled at depth 3.
  - **Fallback** editor: locked card (`∞`), target + action configurable.
  - **Reactions** section: reaction rule list; each rule edits gate
    (event picker filtered by `reactionTo` of the chosen action), conditions,
    target, action, delay. Action picker shows only legal skills/items.
  - **Dry-run** panel: turn mock (HP/MP sliders, status togglers, turn
    counter) + reaction event-stream mock; "run" shows the chosen actions.
- **`character-detail.ts`** — Script selector replaces the Phase 4 preset
  selector. Options = every script in the library. Also expose "Manual" (no
  script assigned).

## 6. Data-model & types surface changes

```typescript
// types.ts additions

type ScriptOperator = 'AND' | 'OR';

type ConditionScope =
  | 'self'
  | 'any-ally' | 'all-allies' | 'lowest-hp-ally' | 'highest-hp-ally'
  | 'any-enemy' | 'all-enemies' | 'lowest-hp-enemy' | 'highest-hp-enemy'
  // event-relative — valid inside reactions:
  | 'attacker' | 'trigger-target' | 'previous-trigger-target';

type CompareOp = '<' | '<=' | '=' | '!=' | '>=' | '>';

// The condition vocabulary this sprint ships.
type Condition =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'hp-pct'; scope: ConditionScope; op: CompareOp; value: number }
  | { kind: 'mp-pct'; scope: ConditionScope; op: CompareOp; value: number }
  | { kind: 'stat-compare'; scope: ConditionScope; stat: StatId; op: CompareOp; value: number; ofCurrent?: boolean }
  | { kind: 'has-status'; scope: ConditionScope; status: string; present: boolean }
  | { kind: 'weak-to'; scope: ConditionScope; element: Element }
  | { kind: 'enemy-rank'; scope: ConditionScope; ranks: EnemyRank[]; present: boolean }
  | { kind: 'ally-count'; op: CompareOp; value: number }
  | { kind: 'enemy-count'; op: CompareOp; value: number }
  | { kind: 'turn-count'; op: CompareOp; value: number }
  | { kind: 'turn-mod'; mod: number; equals: number }   // boss-style calendar
  | { kind: 'cooldown-ready'; skillId: string }
  | { kind: 'can-cast'; skillId?: string }              // MP >= cost
  | { kind: 'has-item'; itemId: string }
  | { kind: 'and'; conditions: Condition[] }
  | { kind: 'or'; conditions: Condition[] }
  | { kind: 'not'; condition: Condition };

interface Trigger {
  conditions: Condition[];   // 1..3
  operator: ScriptOperator;  // 'AND' when 1, either for 2+
}

type TargetRuleKind =
  | 'self'
  | 'lowest-hp-ally' | 'highest-hp-ally' | 'random-ally' | 'all-allies'
  | 'lowest-hp-enemy' | 'highest-hp-enemy' | 'random-enemy' | 'all-enemies'
  | 'highest-threat-enemy'
  // event-relative — valid inside reactions:
  | 'attacker' | 'trigger-target' | 'previous-trigger-target';

interface TargetRule {
  kind: TargetRuleKind;
  condition?: Condition;   // narrowing filter over the target(s)
}

type SkillSelectorFilter =
  | { kind: 'byId'; skillId: string }
  | { kind: 'byElement'; element: Element }
  | { kind: 'byKind'; skillKind: SkillKind }
  | { kind: 'byTag'; tag: string }
  | { kind: 'byMpCost'; op: CompareOp; value: number; ofCurrent?: boolean }
  | { kind: 'byCooldownReady'; ready: boolean }
  | { kind: 'byCastDelay'; op: CompareOp; value: number }
  | { kind: 'byPower'; op: CompareOp; value: number };

interface SkillSelector {
  source: 'skills' | 'items';   // pool = loadout skills OR usable inventory items
  filters: SkillSelectorFilter[];  // all must match (AND); one random match wins
}

interface ScriptLine {
  id: string;               // uuid
  name?: string;            // rule title (shown in the editor)
  trigger?: Trigger;        // omitted = always
  target: TargetRule;
  action: SkillSelector;    // may be an item action
}

interface ScriptBlock {
  id: string;               // uuid
  name?: string;
  depth: 0 | 1 | 2;         // enforced max nesting
  trigger?: Trigger;        // omitted = always (root block is effectively always)
  lines: ScriptLine[];      // order = priority (01..N)
  nested: ScriptBlock[];    // children depth = parent + 1
}

// --- Reactions ---

type EventKind =
  | 'attacked' | 'evaded' | 'ally-kod'
  | 'status-applied' | 'status-removed'
  | 'enemy-casts' | 'turn-start' | 'turn-end';

type ActorFilter = 'self' | 'ally' | 'enemy';

interface EventPattern {
  kind: EventKind;
  source?: ActorFilter;   // who caused the event (omitted = any)
  target?: ActorFilter;   // whom it happened to (omitted = any)
}

interface ReactionRule {
  id: string;               // uuid
  gate: EventPattern;       // required — the event this reacts to
  conditions?: Condition[]; // extra filters, event context available
  target: TargetRule;
  action: SkillSelector;
  delay?: number;           // CTB cost override; defaults to action delay; 0 = instant
}

interface CharacterScript {
  id: string;               // uuid
  name: string;             // user-editable
  description?: string;
  art?: string;             // glyph id, cosmetic
  builtIn?: boolean;        // dps / healer built-ins: true
  rootBlock: ScriptBlock;   // depth 0 — the turn rules
  reactions: ReactionRule[];  // the reactions sheet
  createdAt: number;
  updatedAt: number;
}

const SCRIPT_LIBRARY_CAP = 50;  // developer-configurable; creation refused at cap

interface Character {
  // existing...
  scriptId?: string;        // → CharacterScript in the profile library
  // The Phase 4 `autobattle: 'dps' | 'healer'` field is deprecated by the
  // v2→v3 migration; kept for one release as a read fallback.
}

interface PlayerProfile {
  // existing...
  scriptLibrary: CharacterScript[];  // seeded with dps + healer built-ins
}

// SkillDef / ItemDef changes

type SkillType = 'active' | 'passive';   // no 'reactionary' type

interface SkillDef {
  // existing: id, name, kind, element, power, scaling, targets, cost, cooldown,
  // effect[], delay (from Phase 2)
  type: SkillType;                          // NEW; default 'active'
  reactionTo?: EventPattern[];              // NEW; gates this skill may react in; empty/absent = never
  tags: string[];                           // NEW; e.g. ['heal', 'aoe', 'fire', 'buff']
}

interface ItemDef {
  // existing...
  reactionTo?: EventPattern[];              // NEW; gates this item may react in; empty/absent = never
}
```

Notes:
- **Save schema bump v2 → v3.** Migration seeds the two built-in scripts if
  missing and translates the old `autobattle` preset field to a `scriptId`
  pointing at the corresponding built-in.
- **Determinism:** the turn interpreter consumes `rng` only for `random-*`
  target rules and random match selection. Reaction evaluation is
  deterministic given battle events.
- **Depth enforcement:** validation refuses to save a script with any block
  deeper than depth 2 (root = 0, two nested layers allowed).
- **Capacity enforcement:** `createScript` refuses when
  `scriptLibrary.length >= SCRIPT_LIBRARY_CAP` (built-in seeds are counted).
- **`reactionTo` matching:** a rule's gate matches a skill/item's permission
  when the event kind agrees and any specified source/target filter in the
  permission agrees with the event's (omitted = wildcard). The editor, store,
  and interpreter all enforce this.

## 7. Milestones & exit criteria

### M1 — DSL types + turn interpreter core
- `core/scripting/types.ts`, `conditions.ts`, `targets.ts`,
  `skill-selector.ts`, `interpreter.ts` + tests.
- The built-in `dps` and `healer` scripts, expressed in the full DSL, chosen
  as the primary interpreter fixtures.
- Exit: `chooseScriptedAction(dpsScript, ctx)` and `(healerScript, ctx)`
  produce the same actions the Phase 4 M1 preset code produces in the same
  contexts (turn rules only at this milestone). Seeded, deterministic.
  `tsc --noEmit` clean; full suite green.
- **LANDED.** Interpreter equivalence vs the presets proven by test; the
  fallback landed as `CharacterScript.fallback?: ScriptLine` (see decision log
  round 9) with `validateScriptDepth` covering trigger arity (1–3) and block
  depth. `npm run build` + full suite green.

### M2 — Passives, event bus, reactions
- `SkillDef` gains `type`, `reactionTo`, `tags`; every existing skill gets
  `type: 'active'` + reasonable `tags`; `ItemDef` gains `reactionTo`.
- `core/combat/passives.ts`: apply at battle start via existing status effect
  machinery.
- `core/combat/battle-events.ts`: typed event bus emitting the v1 `EventKind`s
  with source/target.
- `core/combat/reactions.ts`: `checkReactions(battle, event)`; queue at
  `delay` (0 = inline).
- Seed 2–3 passive skills + 2–3 reaction-capable skills + item `reactionTo`
  as data examples.
- Exit: a character with "Toughness" in their loadout has +5 DEF for the whole
  battle; a thief with "Steal" (`reactionTo: evaded vs self`) steals only when
  an enemy's attack misses them; "Guardian's Vow" fires the action whenever an
  enemy attacks a party member; a reaction with `delay: 0` doesn't disturb the
  queue; reactions observed in both AUTO and MANUAL. Same seed → same battle.
- **LANDED (engine wiring + seeds + tests).** Passives apply at battle start via
  `applyPassivesAtBattleStart` (including `all-allies` fan-out for
  `regen_aura`); all eight `EventKind`s are emitted from `battle.ts`; the bus
  drains inside `performAction` (inline `delay: 0` or CTB-scheduled via the
  `reactionQueue`). Seeds: `fortress` / `reckless` / `toughness` /
  `regen_aura` passives and `steal` / `guardians_vow` / `thorns` reaction
  actives; potions carry `reactionTo`. Two deviations logged in round 9:
  passives are **percentage statBuff multipliers** (the status system has no
  flat bonuses, so "Toughness +5 DEF" ships as a ×1.2 statBuff), and the
  **Antidote item is deferred** (the engine has no cleanse `use`-effect yet).
  Reaction-bus tests landed with the wiring: `battle-events.test.ts`
  (`matchesPermission` / `hasPermission`), `reactions.test.ts` (sheet order,
  gates, event-relative conditions, `delay: 0` inline vs scheduled, `reactionTo`
  enforcement, KO'd reactors, enemy-side reactors), and battle-level integration
  (thorns fires inline when the resolver is installed; delayed reactions pump on
  a later turn; `reactionResolver` dormant when absent). `combat/index.ts`
  re-exports `passives`, `battle-events`, `reactions`. Suite + build green.

### M3 — Store, persistence, migration
- `store.ts`: `createScript`, `updateScript`, `deleteScript`,
  `duplicateScript`, `assignScript`; cap guard; built-in guards.
- `save.service.ts`: schema v2 → v3 migration; seed built-ins; migrate old
  `autobattle` preset field.
- `data/scripts.ts`: built-in `dps` + `healer` scripts.
- Exit: creating/editing/deleting scripts persists; assigning a script to a
  character survives reload; loading a v2 save auto-migrates without loss;
  built-in scripts cannot be edited or deleted (guards); `SCRIPT_LIBRARY_CAP`
  is enforced.
- **LANDED.** `store.ts` library block (already present from early work) now
  enforces `SCRIPT_LIBRARY_CAP = 50` on `createScript` and
  `duplicateScript`; `store.test.ts` gained a 13-case scripting-library suite
  (CRUD + reload persistence, built-in guards incl. update/delete, assign →
  delete clears the reference, duplicate → editable copy, unknown-script
  assign, cap on create, cap on duplicate, over-depth refusal via
  `validateScriptDepth`). v2→v3 migration re-verified in `save.service.ts`
  (seeds missing built-ins by id, maps `autobattle` preset → `scriptId`).
  Suite + build green.

### M4 — Automation Window UI
- `automation-panel.ts` + `script-library-panel.ts` + `script-editor-panel.ts`
  (visual reference: `template_002`).
- Character-detail card: replace preset selector with library-backed selector.
- MetaScene tab registration.
- Exit: the player can build a script from scratch in the UI without writing
  code — trigger clauses + operator, target rules, skill/item selectors,
  numbered priority order, nested blocks (to depth 3), the locked ∞ fallback,
  and reaction rules (gate filtered by `reactionTo`). Editing a library script
  updates any character using it on the next turn.

### M5 — Dry-run preview
- `core/scripting/dry-run.ts` + preview panels in the script editor: turn mock
  (HP/MP sliders, status togglers, turn counter) + reaction event-stream mock.
- Exit: hitting "Run" on a script shows what the turn rules pick (rule +
  target + action) or that it falls through to the fallback; applying a mocked
  event shows which reactions fire and at what delay.

### M6 — Battle integration ✅
- `BattleScene.ts` (Phase 4 AUTO path) swaps `choosePartyAction(preset)` for
  `chooseScriptedAction(script)`; if no script assigned, use the `dps`
  built-in. `checkReactions` wired into the event bus for both modes.
- Manual mode unchanged for turn actions; reactions still fire.
- Full test coverage of the AUTO path with library scripts.
- Exit: a run played on AUTO with library scripts resolves identically to a
  run played on AUTO with the equivalent Phase 4 preset; a run played with a
  player-authored script behaves per the script; toggling AUTO/MANUAL
  mid-battle still works; reactions fire in both modes; hidden-tab ticker
  (Phase 4 M5, if landed) still works.
- Deliverables: `BattleScene.ts` gained `resolveAutoScript(actorId)` and
  `resolveReactionScript(actorId)` (resolve the character's assigned library
  script, else the `dps`/`healer` built-in); the AUTO `pump()` branch resolves
  turns with `chooseScriptedAction(script, buildScriptContext(...))`, keeping
  `choosePartyAction` as the fallback when the interpreter yields no action;
  after `createBattle` the run sets
  `battle.reactionResolver = (c) => resolveReactionScript(c)` so reactions
  fire from library sheets in both AUTO and MANUAL. Tests (`battle.test.ts`):
  library-script AUTO resolves the same action as the matching preset;
  a seeded 6-turn scripted run matches the `dps`-preset run actor-for-actor
  (hp/mp/ko + turn count); thorns reactions fire from the assigned library
  sheet when the enemy attacks, in AUTO and in MANUAL. Item rules in library
  sheets still no-op in real battles (battle actors start with no items) —
  deferred to the M7 item wiring; `buildScriptContext` reads `items ?? []`
  without crashing.

### M7 — Battle item wiring (sprint exit) ✅
- Battle actors start each run with the character's equipped consumables in
  `BattleActor.items`; the AUTO/interpreter paths and reactions can then pick
  `source: 'items'` rules, and using a single-use item consumes it from the
  run's inventory mid-battle.
- Closes the last open sprint criterion ("Skill selectors can pull from
  skills OR items; single-use items are consumed on use").
- `buildScriptContext` already reads `items ?? []` without crashing, so this
  is additive to the run layer.
- Implementation: `resolveItem` spends the used item from the acting actor's
  `BattleActor.items` (shared by turn actions and reaction plans);
  `BattleScene` seeds player actors from the profile's battle-usable
  consumables and diffs item lists after each action to sync consumption back
  to the shared profile inventory. Health/greater-health potions carry
  `reactionTo: [{ kind: 'attacked' }, { kind: 'status-applied' }]` so
  `source: 'items'` reaction rules are legal (S21).

### Exit criteria (sprint-level)

- [x] Full DSL types shipped; turn interpreter is pure + deterministic
      (seeded).
- [x] Passive skills apply at battle start; passives only active when in the
      character's loadout.
- [x] Reactions sheet fires on the event bus in AUTO and MANUAL, in sheet
      order, with tunable CTB cost (including 0).
- [x] `reactionTo` restricts which skills/items may react to which gates,
      enforced by the editor, the store, and the interpreter.
- [x] Player can CRUD scripts in the Automation Window without writing code.
- [x] Nested script blocks work to depth 3; deeper nesting is refused.
- [x] Skill selectors can pull from skills OR items (single-use items are
      consumed on use).
- [x] Scripts assigned to characters drive AUTO turns; MANUAL turn control
      unchanged.
- [x] Dry-run preview shows the chosen actions for a mocked state + event
      stream.
- [x] Save schema v2 → v3 migration seeds built-in scripts and translates old
      preset assignments.
- [x] Full test suite green; `tsc --noEmit` clean.

## 8. Test matrix (Vitest)

| Area | Cases |
| --- | --- |
| Interpreter — trigger evaluation | 1/2/3 clauses; AND vs. OR; missing trigger = always |
| Interpreter — rule matching | Priority order (position); first-true wins; fall through when target/action resolve empty; random match selection is seeded & stable |
| Interpreter — nested blocks | Parent trigger fires → recurse; parent false → skip; depth 3 valid, depth 4 refused |
| Interpreter — fallback | Nothing matches → fallback action (configurable target/action); fallback cannot be removed/reordered |
| Conditions | Every kind: hp-pct, mp-pct, stat-compare (flat + %), has-status, weak-to, enemy-rank, ally-count, enemy-count, turn-count, turn-mod, cooldown-ready, can-cast, has-item, and/or/not; event-relative scopes in reaction context |
| Targets | Every kind incl. highest-threat-enemy and attacker / trigger-target / previous-trigger-target; with and without narrowing condition |
| Skill selector — skills source | byId, byElement, byKind, byTag, byMpCost (abs + %), byCooldownReady, byCastDelay, byPower; multi-filter AND; empty result → rule falls through |
| Skill selector — items source | Filters over usable inventory items; item consumed on selection; `reactionTo` gates item reactions (potions carry it) |
| Passives | Apply at battle start; persist to battle end; multiple stack additively; passives out of loadout inactive |
| Reactions | Fire on each EventKind; sheet order; `delay: 0` doesn't disturb queue; delays queue correctly; **`reactionTo` gates actions in every context** (editor list, store save, runtime); reactions fire in both AUTO and MANUAL; event-relative targeting resolves |
| Built-in scripts | dps + healer, expressed in full DSL, produce the Phase 4 M1 preset actions in equivalent contexts |
| Store | CRUD actions; built-ins refused for edit/delete; duplication produces an editable copy; `assignScript` handles missing scripts (revert to Manual); `SCRIPT_LIBRARY_CAP` enforced |
| Persistence | Library round-trips save/load; v2 → v3 migration seeds built-ins + translates `autobattle` field |
| Dry-run | Given mocked state + script, returns the same actions `chooseScriptedAction` would in real battle; reaction view matches `checkReactions` |
| Integration | Full battle on AUTO with a library script matches expected outcomes; MANUAL toggle still works; reactions fire in both; AUTO with no script → dps fallback |

## 9. Risks / notes

- **DSL surface size.** The condition + target + selector vocabulary is broad
  (and the reactions vocabulary adds `reactionTo`, event kinds, event-relative
  targeting). Guard: ship exactly what §6 lists; every addition after that is
  an intentional PR with tests.
- **UI complexity.** The Automation Window is the biggest single UI in the
  project. Mitigation: build the library panel first (small), then the turn
  editor (medium), then the reactions section (small), then the dry-run
  preview (small). Each is independently demonstrable. Consider a DOM overlay
  (like Theme Studio) if Phaser controls become the bottleneck — TBD in M4.
- **Reaction evaluation ordering.** Multiple characters may react to the same
  event; reactions insert into the CTB timeline by their `delay`. Keep
  evaluation in sheet order per character and event emission order across
  characters; `delay: 0` resolves inline before the next event. Test seeded
  determinism thoroughly.
- **`reactionTo` enforcement gaps.** The restriction is only as strong as its
  three enforcement layers. Guard: no code path resolves a reaction action
  without the interpreter re-validation; the editor and store guards are
  UI/data conveniences, the interpreter is the truth.
- **Passive stacking.** Two passives modifying the same stat stack additively
  this sprint. If that gets abusive, Phase 5 balance can introduce caps.
- **Migration risk.** v2 → v3 touches every profile with `Character.autobattle`
  set. Test the migration on save fixtures for: unset, `'dps'`, `'healer'`,
  invalid values. Fall back to Manual on unknowns.
- **Dry-run vs. real.** The dry-run must call the same interpreter and
  `checkReactions` paths as battle. Shared code path; distinct entry point. If
  they diverge, dry-run becomes a lie.
- **Item consumption during dry-run.** Dry-run **does not** consume real
  items — it operates on a snapshot. Guardrail: dry-run signals that the
  action *would* consume item X.
- **Class-agnostic.** Scripts are per-character, not per-class. Sprint 3 will
  add a `ClassDef.startingScript` field pointing to a built-in — that's a
  data-only addition, no interpreter change.

## 10. Landing this

Keep `docs/specs/character-scripting.md` current as the spec solidifies during
build; log new decisions in `roadmap.md` (round 8). When this sprint lands,
Sprint 3 (classes) will formalize class-driven starting-script assignment and
promote passives from an optional field to a first-class part of every class
definition. Beyond the three-sprint group, this scripting infrastructure is
what Phase 6's stretch "player-authored autobattle scripts" (deferred by
decision #24) has been waiting for — this sprint delivers it.
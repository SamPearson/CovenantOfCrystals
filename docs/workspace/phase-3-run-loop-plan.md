# Phase 3 Plan — Run Loop, Shops, Recruitment & Loot

> Working doc for the run-loop build. The complete rule set lives in
> `runs-and-gauntlet.md` (+ `metagame.md`, `durability.md`, `data-model.md`);
> decisions land in the `roadmap.md` decision log (round 5).
>
> Decisions for this phase were settled in a planning session on 2026-08-13
> (scope, shop shape, skill items, recruitment, XP, drop banking). See §3.

## 1. Goal

Ship the **run loop end-to-end** with a playable economy: a player builds a
party in the meta UI, starts a **seeded branching run** (3/5/10 battles), fights
battles that award **gold, XP, and gear/skill-item drops**, spends and sells in
a **between-runs shop tab** (potions + rotating stock of gear and skill items),
recruits **new party members to replace the fallen**, and resolves the run at
the boss with **permadeath, survivor payout, durability tick, and a result
screen** — all feeding persistent meta state.

This is the phase where the "fun systems" begin: gold needs a sink (shop),
drops need a use (equip/sell), and permadeath needs a recovery path
(recruitment). Leveling is **deliberately deferred to Phase 4** — this phase
rewards through gold, drops, and shopping rather than level-up curves.

## 2. Status

- **Complete.** All milestones M1–M9 have landed (commits M1–M7, with M8/M9
  verified and wrapped up on top: the standalone `ResultScene` now owns the
  run-end outcome summary). Full suite 373/373, `tsc --noEmit` clean.
- Two refinements vs. the plan as written:
  - **M8** — `buyItem` / `sellItem` / `recruit` are implemented in
    `core/shop/*` as guard helpers and called from the panels via the store's
    `mutate`, rather than as `store.ts` action wrappers. The schema bump +
    migration were **skipped** (still prototyping; saves are disposable).
  - **M9** — run-end payout to meta was pulled forward into M3/M6 (banked at
    resolution); what was missing was the standalone `ResultScene`, which is
    now in `src/game/scenes/ResultScene.ts`. `RunScene` hands off with
    `scene.start('ResultScene', { result })` — victory / wipe / abandon
    outcomes, gold/drops/XP summary, return to main view.
- The run-generator seams identified below are all now implemented:
  `core/runs/` and `core/shop/` exist; `startRun` and `SaveFile.activeRun`
  are live.

## 3. Design decisions (this planning session)

All settled with the user on 2026-08-13. These become `roadmap.md` decision-log
round 5.

| # | Question | Decision |
| --- | --- | --- |
| S1 | Shop placement & refresh | **One meta shop tab on the main view**, between runs. Always-stock potions + rotating stock of gear & skill items. Stock **regenerates each time a run completes**. No in-run shop nodes this phase. |
| S2 | Scroll/tome coverage | **Auto-generate** a Scroll and Tome of every player-facing skill from the `SKILLS` dataset (enemy-only skills excluded). Instant variety; the shop draws from the full pool. |
| S3 | Tome restriction | **Open to any character** — a tome permanently teaches the skill to whoever uses it. Build freedom; a class-ineffective skill is the player's call (matches the "wasted run" tuning philosophy). |
| S4 | Item usage in battle/run | Wire the **Item action in-battle** (potions, scrolls) **and** on the run map between battles. Rest nodes still heal. |
| S5 | Gear durability | **All shop/drop gear is permanent in P3.** Durability ticking still runs at run resolution (trivially a no-op); expiring assets + pricing arrive with Phase 5. |
| S6 | Recruitment shape | **2–3 random characters per refresh**: random class from unlocked, **level 1, permanent**, each a **flat gold price**. Refresh on run completion. |
| S7 | XP & leveling | **Survivors accumulate XP (visible on characters) but no level-ups** until Phase 4. Rewards this phase are gold + drops + shopping. |
| S8 | Drop banking | **Drops bank at run resolution** — accumulate on the `ActiveRun`, convert to persistent inventory at run end (partial payout on failure). |
| S9 | Run map structure | **Minimal branching map** — each step offers 2–3 visible next-node choices (battle / elite / rest), honoring locked #19. Branch *detail* (count, visibility) stays a Phase 5 concern. |
| S10 | Rotating stock size | Always potions (Health / Greater Health / **Mana / Greater Mana**) + **4 gear + 3 skill items** per refresh. |
| S11 | Run lengths offered | **Starter subset 3 / 5 / 10** at run start (1/15/20 arrive later with difficulty bands). |
| S12 | Selling | **Sell gear for gold** from the shop tab (unwanted drops become a second gold source). Consumables are not sellable in P3. |

> **Noted (not a decision yet):** `architecture.md` §6 Stage 2 suggests a mock
> API when "shops, recruitment, and seeded run generation" need dynamic data.
> Recommendation: keep all generation in **pure core modules** (seeded,
> unit-testable) and defer the mock-API facade until the real backend is near —
> the modules sit behind the same interface the mock will eventually wrap. Flag
> for the user before landing.

## 4. Scope

### In scope (this phase)

- `src/core/runs/` — seeded run generation, node resolution, rewards,
  permadeath/durability resolution, drop banking. Pure, Phaser-free, seeded.
- `src/core/shop/` — shop stock generation, sell pricing, recruitment offers.
  Pure, seeded.
- Seeded **branching run map** (lengths 3/5/10), enemy squad generation with
  **difficulty-by-numbers scaling** per node index, elite/boss variants,
  guaranteed rest cadence (every 5 non-boss battles), boss final node.
- Battle → rewards → next node → rest → boss → **run end** flow; `RunScene`.
- **Item action wired in-battle** (potions heal HP/MP; **scrolls cast a skill**
  — consumes 1 use, no MP/cooldown) and **on the run map** between battles.
- **Permadeath resolution** at battle end (KO'd → removed, gear returns to
  inventory) + **full-wipe run end** + **XP accumulation** (no leveling) +
  **durability tick** at run resolution (no-op in P3).
- **Shop tab** (meta): always-stock potions (incl. new mana potions), rotating
  4 gear + 3 skill items, **sell gear for gold**.
- **Recruitment tab** (meta): 2–3 random level-1 permanent characters, flat
  price, replaces permadeath losses.
- **Auto-generated skill items**: Scroll of X / Tome of X for every
  player-facing skill (`core/data/skill-items.ts`).
- Store actions + persistence: `startRun`, node resolution, `buyItem`,
  `sellItem`, `recruit`, `activeRun` checkpoint in the save.
- `ResultScene` — run-end rewards breakdown + payout to meta.
- Data-model/type surface changes (see §6).

### Out of scope (deferred)

- **Leveling / XP curves / level-ups** — Phase 4 (XP is accumulated + shown only).
- **Expiring gear/characters + durability pricing** — Phase 5 (P3 is all-permanent).
- **In-run shop/rest/event node features** — Phase 5. Rest nodes exist and
  restore HP/MP; shop is meta-only; event nodes aren't generated this phase.
- **Run lengths 1/15/20** — later, with difficulty bands.
- **Branch detail** (choices per step, visibility of contents) — Phase 5.
- **Autobattle presets** — Phase 4. Runs play manually this phase.
- **Mock API facade** — defer (see §3 note). Generation stays in pure core.
- **Full drop tables / loot pools** — Phase 5. P3 uses stub drop weights.
- **Consumable selling, box expansion costs, class unlocks** — Phase 5.
- **Passives on classes** (`ClassDef.passive`) — unchanged, not this phase.

## 5. Module layout

### `src/core/runs/` (new — pure, seeded)

- **`types.ts`** — `ActiveRun`, `RunNode`, `RunNodeType`, `RunResult`,
  `RunStatus`, `RewardRoll`, `ShopStock`, `RecruitOffer` (mirrors
  `data-model.md` §5; see §6).
- **`run-gen.ts`** — `generateRun(profileId, partyIds, length, seed)` → an
  `ActiveRun`: node list with branching choices per step, boss at the end,
  rest cadence, enemy squads (archetypes from `ENEMIES`, stats scaled by node
  index + elite/boss multipliers). Pure + deterministic given seed.
- **`enemy-scale.ts`** — `scaleEnemy(def, nodeIndex, length, mult)` →
  `EnemyDef`: difficulty-by-numbers curve. Balance numbers from `balance.ts`.
- **`rewards.ts`** — `rollBattleRewards(rng, nodeType, nodeIndex, survivors)` →
  gold + drops + xp (xp per survivor; gold/drops rolled with the seeded RNG).
  `bankRunRewards(run, profile)` → converts drops to inventory + gold to
  profile at run resolution (partial on failure). Pure.
- **`resolve.ts`** — `resolveBattleResult(run, battleResult)`: applies
  permadeath (KO'd removed, gear → inventory), survivor XP accumulation,
  node advance, rest-node heal/MP restore, durability tick, run-end states
  (victory / wipe / abandon) → `RunResult`. Pure.
- **`index.ts`** — re-exports.

### `src/core/shop/` (new — pure, seeded)

- **`shop.ts`** — `generateShopStock(rng)` → always potions + 4 gear + 3 skill
  items; `sellPrice(gearInstance, itemDef)`; `buyItem`/`sellItem` guards
  (pure helpers; mutation goes through the store).
- **`recruitment.ts`** — `generateRecruitOffers(rng, unlockedClasses, count)`
  → 2–3 level-1 permanent random-class characters with a flat price each.

### `src/core/data/`

- **`skill-items.ts`** (new) — `scrollFor(skillId): ItemDef`,
  `tomeFor(skillId): ItemDef` derived deterministically from `SKILLS`
  (rarity/pricing from a stub power curve). Also `PLAYER_SKILL_IDS` (all
  skills minus the enemy-only set).
- **`items.ts`** — add `mana_potion` / `greater_mana_potion`
  (`use.healMp`; flat per `combat.md` §5 item-heal decision).
- **`enemies.ts`** — `EnemyDef` gains `xp` and `gold` base values.
- **`balance.ts`** — new `run` + `economy` sections: difficulty step, elite /
  boss multipliers, rest cadence, per-battle base gold, gold variance, drop
  chance + weights, sell ratio, recruit price, scroll/tome price curve.

### `src/core/`

- **`store.ts`** — actions: `startRun(partyIds, length)`, `resolveNode(...)`,
  `buyItem(itemId)`, `sellItem(gearInstanceId)`, `recruit(offerId)`,
  `useItemOutOfBattle(characterId, itemId)`; refresh shop/recruitment on run
  resolution. (Per decision #28, plain in-memory store, no state lib.)
- **`types.ts`** — type surface changes (§6).
- **`save.service.ts`** — persist `activeRun` + `shop`/`recruitment` on the
  profile; bump schema version; migration no-op for old saves.

### `src/core/combat/`

- **`battle.ts`** — extend `resolveItem` to handle **scroll items**
  (`item.castSkill`): run the skill's resolution (targets, element, scaling,
  statuses) with **no MP cost and no cooldown**, consuming 1 use. (This is the
  "spells in item form" extension `combat.md` §11 explicitly reserves.)
- **`types.ts`** — widen `BattleAction`'s item form if needed for scroll
  resolution; `BattleResult` unchanged.

### `src/game/scenes/`

- **`RunScene.ts`** (new) — run map (branching choices per step), node
  navigation, between-battle item usage, rest node, boss transition, run-end
  handoff to `ResultScene`. Scenes render state only.
- **`ResultScene.ts`** (new) — run outcome, rewards breakdown, payout summary.
- **`BattleScene.ts`** — wire the Item action (potions + scrolls) into the
  manual controls.

### `src/game/ui/panels/`

- **`shop-panel.ts`** (new) — potions + rotating stock + sell list.
- **`recruitment-panel.ts`** (new) — recruit offers.
- Meta panels get entry tabs for Shop / Recruitment (main view).

## 6. Data-model & types surface changes

These land with the build (in lockstep), per `data-model.md` §5 + `types.ts`:

```ts
// types.ts additions / changes
type ItemType = 'weapon' | 'armor' | 'consumable' | 'tome' | 'scroll' | 'misc'

interface ItemDef {
  // ...existing...
  skill?: string       // tomes: skillId permanently granted (open to any class)
  castSkill?: string   // scrolls: skillId cast when used (in-battle, no MP/cost)
}

interface EnemyDef {
  // ...existing...
  xp: number           // xp awarded to each survivor
  gold: number         // base gold (scaled by node type in run-gen)
}

interface ActiveRun {
  seed: number
  profileId: string
  party: string[]            // snapshot of characterIds (geared as snapshot)
  length: number             // 3 | 5 | 10 (this phase)
  nodes: RunNode[]           // pre-generated from seed
  currentNodeIndex: number
  goldEarned: number
  drops: string[]            // itemIds banked at run resolution
  status: 'active' | 'won' | 'lost' | 'abandoned'
}

type RunNodeType = 'battle' | 'elite' | 'rest' | 'boss'
// 'shop' | 'event' remain in data-model.md as v1 candidates, not generated in P3

interface RunNode {
  type: RunNodeType
  index: number              // step index (drives difficulty scaling)
  choices?: { type: RunNodeType; label: string }[]  // branching options for this step
  enemySquad?: EnemyDef[]    // resolved at node creation (seeded)
  gold?: number              // pre-rolled reward stub (rolled at battle end instead)
}

interface RunResult {
  status: 'won' | 'lost' | 'abandoned'
  survivors: string[]
  koIds: string[]
  goldBanked: number
  itemsBanked: string[]
  gearBanked: string[]       // permanent GearInstance ids
  xpGained: Record<string, number>
}

interface ShopStock {
  always: string[]           // potion itemIds
  rotating: { gear: string[]; skills: string[] }  // itemIds (4 + 3)
}

interface RecruitOffer {
  id: string                 // uuid
  character: Character       // level 1, permanent
  price: number              // flat gold
}

interface PlayerProfile {
  // ...existing...
  shop: ShopStock
  recruitment: RecruitOffer[]
}

interface SaveFile {
  // ...existing...
  activeRun?: ActiveRun      // checkpointed run, if any
}
```

Notes:
- **Scrolls are stackable consumables** — they live in `Inventory.items`
  (`{ itemId, count }`) like potions; `castSkill` distinguishes them at use.
- **Tomes are consumed on use in the meta/run-map layer** and add the skill to
  `character.learnedSkills`; they are not battle actions.
- **Drops bank at run resolution** (S8): `ActiveRun.drops` accumulate
  `itemIds`; `bankRunRewards` converts them to inventory (permanent gear →
  `InventoryGear` instances; stackables → counts). Partial on failure/abandon
  per `runs-and-gauntlet.md` §5.
- **Enemy gold/XP scaling**: run-gen produces the final `EnemyDef`s (stats,
  xp, gold scaled by node index + elite/boss multiplier) before
  `createBattle`, so the engine stays pure and the run layer owns rewards.

## 7. Milestones & exit criteria

### M1 — Data-model & types surface ✅ prerequisite
- `types.ts`: `'scroll'` ItemType, `ItemDef.castSkill`, `EnemyDef.xp`/`gold`,
  `ActiveRun`, `RunNode`, `RunResult`, `ShopStock`, `RecruitOffer`,
  `PlayerProfile.shop`/`recruitment`, `SaveFile.activeRun`.
- `items.ts`: `mana_potion`, `greater_mana_potion`.
- `skill-items.ts`: `PLAYER_SKILL_IDS`, `scrollFor`, `tomeFor`.
- `balance.ts`: `run` + `economy` stub sections.
- Exit: `tsc --noEmit` clean; data-integrity tests (all player skills produce
  a scroll + tome; enemy-only skills excluded; item refs resolve).

### M2 — Run generation ✅
- `core/runs/run-gen.ts` + `enemy-scale.ts` + tests. Seeded node lists for
  lengths 3/5/10; branching choices per step; boss final; rest every 5
  non-boss battles; enemy stats/xp/gold scaled by node index (numbers-based
  difficulty, locked #18).
- Exit: same seed → identical run; length/nodes invariants; scaling monotonic
  across a run; rest cadence correct (3: none, 5: pre-boss, 10: after #5). ✅

### M3 — Rewards, permadeath & run resolution ✅
- `core/runs/rewards.ts` + `resolve.ts` + tests. Gold/drop rolls (seeded),
  xp per survivor (no leveling), permadeath (KO'd removed, gear → inventory),
  full-wipe run end, rest-node HP/MP restore, durability tick (no-op),
  drop banking at run resolution (full on victory, partial on failure/abandon).
- Exit: permadeath resolution matches `combat.md` §6; gear returns on death;
  banked rewards land correctly in all three end states. ✅

### M4 — Shop, skill items & recruitment ✅
- `core/shop/shop.ts` + `recruitment.ts` + tests. Always potions + 4 gear +
  3 skill items per refresh; scroll/tome prices from stub curve; sell pricing;
  2–3 level-1 permanent recruits at flat price; refresh on run completion.
- Exit: seeded stock reproducible; buys/sells/recruits update gold correctly;
  selling a permanent gear piece returns it to gold (consumables un-sellable). ✅

### M5 — Battle item & scroll wiring ✅
- `battle.ts` `resolveItem` handles `castSkill` (no MP/cost/cooldown, 1 use);
  `BattleScene` adds an Item action (potion target pick; scroll cast).
- Exit: potion heals HP/MP mid-battle; scroll casts its skill (scaling,
  element, statuses, AoE targets all correct); consumed uses decrement;
  battle log records item usage. ✅

### M6 — RunScene (run loop shell) ✅
- `RunScene`: run map with branching choices, node navigation, between-battle
  item usage (potions, tomes on the map), rest node heal/MP restore, battle
  handoff to `BattleScene`, boss node, run-end transition (`scene.start(
  'ResultScene', { result })`). Checkpoints saved post-battle and at rest
  (`autobattle-and-idle.md` §4).
- Exit: a full run is playable start-to-finish manually; progress survives
  reload at checkpoints. ✅

### M7 — Shop & recruitment tabs (meta UI) ✅
- `shop-panel.ts` + `recruitment-panel.ts` + main-view entry tabs. Buy/sell
  gear, buy potions, buy skill items, recruit characters into a box; gold
  balances and durability badges shown.
- Exit: end-to-end — earn gold in a run, spend it in the shop, recruit
  replacements for the fallen. ✅

### M8 — Store actions & persistence ✅ (with scope cuts)
- `store.ts` actions (`startRun`, `resolveNode`, `buyItem`, `sellItem`,
  `recruit`, `useItemOutOfBattle`) + shop/recruitment refresh on run
  resolution; `save.service.ts` persists `activeRun` + `shop`/`recruitment`.
- **Deviation:** `buyItem` / `sellItem` / `recruit` live in `core/shop/*` as
  guard helpers invoked through the store's `mutate` from the panels, rather
  than as `store.ts` action wrappers. Schema version stayed **1** — the bump +
  migration were skipped (prototyping, disposable saves, waived).
- Exit: save/load round-trips preserve run state, shop stock, recruitment
  offers, and gold; reload mid-run resumes at the checkpoint. ✅

### M9 — ResultScene & run-end payout ✅
- `ResultScene` (now `src/game/scenes/ResultScene.ts`): victory / wipe /
  abandon outcomes; gold, drops, XP summary; payout to meta (already banked
  server-side at resolution — folded into M3/M6); return to the main view
  (boxes/party → recruit → re-run).
- Exit: the full loop recruit → gear → run → reward is visible and repeatable. ✅

### Exit criteria (from roadmap.md)
- A full run can be played start-to-finish and meta progression is visible.
- Same seed → same run; formulas/rolls unit-tested (`npm run test` green,
  `tsc --noEmit` clean).
- Gold is earned, spendable (shop), and a sink exists (shop + recruitment);
  drops are equippable or sellable; permadeath losses are recoverable via
  recruitment. The "spark of fun" is demonstrable in the loop.

## 8. Test matrix (Vitest)

| Area | Cases |
| --- | --- |
| Run-gen | Same seed → identical run; lengths 3/5/10; boss always last; rest cadence; branching choices present; enemy scaling monotonic per node index |
| Enemy scaling | Stats/xp/gold scale with node index; elite > standard; boss peak; numbers from balance data |
| Rewards | Gold/drop rolls seeded + reproducible; xp awarded to survivors only; partial payout on failure/abandon |
| Permadeath | KO'd removed; gear returns to inventory; full wipe ends run; survivors keep XP/gear |
| Durability | Permanent gear survives run resolution untouched (tick is a no-op in P3) |
| Skill items | Every player skill has scroll+tome; enemy skills excluded; scroll casts skill correctly (targets/element/status); tome teaches + consumes |
| Battle items | Potion heal HP/MP in-battle; scroll no MP/cost/cooldown, consumes 1; on-map use of potions/tomes |
| Shop | Always potions present; 4 gear + 3 skill rotating; sell price math; gold updates on buy/sell |
| Recruitment | 2–3 offers; random unlocked class; level 1; permanent; flat price; refresh on run completion |
| Persistence | activeRun checkpoint round-trip; shop/recruitment saved; mid-run reload resumes at checkpoint |

## 9. Risks / notes

- **Balance is still fake** (stub numbers) — battles may feel swingy; gold/drop
  rates are placeholders until the Phase 5 data pass. The point now is the
  loop + the fun systems, not tuning.
- **Scope creep guard:** the temptation is to pull leveling, expiring gear, or
  in-run shop nodes forward. They stay deferred (§4) — P3 is already large.
- **Two gold streams:** run rewards + selling. Watch that selling doesn't make
  run gold irrelevant; stub sell ratio keeps the shop meaningful.
- **Scrolls reuse the skill resolver** — keep the no-cost/cast-once path in the
  engine, not a parallel system, so scrolls can't diverge from skill rules.
- **Checkpoints:** mid-battle saves stay locked (decision #9) — save after
  battle resolution and at rest only.
- **Mock API:** generation lives in pure core modules behind the same interface
  the future mock/real API wraps (decision #26) — nothing in scenes should
  reach for generation directly.

## 10. Landing this

Keep `runs-and-gauntlet.md`, `metagame.md`, `durability.md`, and `data-model.md`
current as builds resolve edge questions, and log every new decision in
`roadmap.md` (round 5). When the run loop lands, Phase 4 consumes the AI
interpreter for autobattle presets, and Phase 5 tunes the numbers this phase
introduced.

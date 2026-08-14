# Roadmap

Build phases, milestones, and the decisions that shape them. This is the
working document — update it as decisions land.

---

## Build phases

### Phase 0 — Scaffold ✓ (done)
- [x] Phaser 4 + Vite + TypeScript project (installed `phaser@4.2.1`, scaffolded
  manually per `architecture.md` instead of the interactive create-game-app)
- [x] `src/` layout: `main.ts`, `game/config.ts`, `game/scenes/BootScene.ts`,
  `core/` (rng), plus `tsconfig.json`, `vite.config.ts`, `index.html`
- [x] Vitest set up; first passing test — seeded RNG reproducibility
  (`src/core/rng/rng.test.ts`, 12 tests)
- **Exit criteria:** met — `npm run test` passes, `npm run build` typechecks +
  bundles, `npm run dev` serves the BootScene at `http://localhost:8080`.

### Phase 1 — Data layer & meta screens ✓ (done)
- [x] Data loaders + definitions (classes, skills, items, enemies) — stub data
- [x] Durability (`permanent` / `runsRemaining`) in the data model and UI
- [x] SaveManager (local profiles / mock API, versioned) + profile creation
- [x] Meta UI: boxes (10 × 30), party selection (4 max), equip screen, inventory
- [x] Core store with actions (addToBox, equip, startRun) — store + `addToBox`/`equip` done; `startRun` lands with the Phase 3 run loop
- **Exit criteria:** met — a character can be moved into a party and
  equipped; state survives reload (verified end-to-end in-browser).
  Docs: `metagame.md`, `party-and-equipment.md`, `durability.md`,
  `data-model.md`.

### Phase 2 — CTB combat engine prototype
- [x] CTB turn engine in `core/combat`: timeline + reinsert queue (SPD climb,
  action weight/delay, tie rules, `nextAt` mutation hook)
- [x] Damage/status formulas in `core/combat` (unit-tested): ratio-based
  damage, heal (MAG-scaling magic / flat items), element multipliers, crit /
  dodge / blind, status stacking + own-turn durations, DOT cadence
- [x] Enemy AI priority-script interpreter + `minion` / `tanky` / `glass` /
  `boss` profiles (same interpreter autobattle uses in Phase 4)
- [x] Battle orchestration + outcome contract (`battle.ts`: `createBattle`,
  `performAction`, `chooseEnemyAction` via the AI interpreter, end-checks,
  `getBattleResult` → `BattleResult`: status, koIds, survivors, xpAwarded,
  drops, log) for Phase 3 to consume
- [x] Minimal BattleScene: fixed scripted squad, manual control only
  (Attack / Skill / Defend)
- **Plan:** `workspace/phase-2-combat-plan.md`
- **Exit criteria:** manual battle vs. a stub enemy resolves to a win/loss
  (engine-side: won/lost/fled end-checks + full wipe ✓); formulas match the
  spec in `combat.md` (✓ — full suite green, `tsc --noEmit` clean); same
  seed → same battle (✓ — determinism test). ✓ — scripted BattleScene ships:
  manual control (Attack/Defend/skills), engine-driven enemy turns, CTB queue
  strip, HP/MP bars, status badges, damage floats, battle log, win/loss panel.
  Docs: `combat.md` (full CTB spec).

### Phase 3 — Run loop
- [ ] Seeded run generation (lengths 3/5/10 this phase — 1/15/20 later with
  difficulty bands; branching paths; difficulty-by-numbers curve)
- [ ] Rest nodes every 5 battles (recovery — exact features to tune in Phase 5)
- [ ] Battle → rewards → next node → boss → run end
- [ ] Permadeath resolution (immediate, no revives) + survivor XP/gear payout
- [ ] Durability tick-down at run resolution
- [ ] Result screen + rewards to meta (gold, drops, unlocks)
- [ ] Items wired in-battle (potions, scrolls) + usable on the run map between
  battles
- [ ] Meta shop tab (always potions + rotating 4 gear / 3 skill items, refresh
  per run) + sell gear for gold
- [ ] Recruitment tab (2–3 random level-1 permanent recruits, flat price,
  refresh per run)
- [ ] Auto-generated skill items: Scroll of X / Tome of X for every
  player-facing skill
- **Plan:** `workspace/phase-3-run-loop-plan.md` (milestones M1–M9)
- **Exit criteria:** a full run can be played start-to-finish and meta
  progression is visible; gold/drops are earned, spendable (shop) and have a
  sink (shop + recruitment); permadeath losses recoverable via recruitment.
  Docs: `runs-and-gauntlet.md`.

### Phase 4 — Autobattle & idle
- [ ] Per-character AI scripts (presets) using the same engine
- [ ] Speed controls (1×/2×/4×, skip animations, auto-advance)
- [ ] Checkpointing + leave/return flow (hidden tab keeps running)
- **Exit criteria:** a run can be left mid-way (tab hidden, still running) and
  resumed exactly where it was; autobattle wins/loses using the same rules as
  manual. Docs: `autobattle-and-idle.md`.

### Phase 5 — Economy & balance
- [ ] Balance constants data pass (damage curves, difficulty curve, drop
  tables, gold sinks)
- [ ] Recruitment NPC (pay for randomly generated characters, permanent or
  expiring) + pricing curve
- [ ] Durability pricing: expiring assets cheaper than permanent
- [ ] Shop, rest, event nodes
- [ ] Class unlock gating, box expansion costs
- **Exit criteria:** a clean loop from recruit → gear → run → reward is
  balanced enough to repeat without grinding or snowballing. Docs:
  `metagame.md`, `durability.md`, `runs-and-gauntlet.md`.

### Phase 6 — Polish & backend
- [ ] Art/audio pass, animations, battle log polish
- [ ] Real API backend replacing the mock (login + cloud save)
- [ ] Optional: player-authored autobattle script editor, run record stats,
  class-change system
- **Exit criteria:** playable vertical slice for others; real API live.

---

## Decision log

### Locked

| # | Question | Decision |
| --- | --- | --- |
| 1 | Real backend login vs. local profiles? | **Local profiles / mock API** for the demo; full API later (`architecture.md` §6) |
| 2 | Party size? | **4** |
| 3 | Permadeath resolution? | **Immediate** — KO'd at battle end is dead, no recovery (`combat.md` §6) |
| 4 | Does gear vanish with a permadead character? | **No** — returns to inventory unless already expiring that run (`durability.md` §4) |
| 5 | Full-wipe behavior? | **Run ends, party = 0 characters**, rebuild from boxes/recruitment (`combat.md` §6) |
| 6 | How are new characters recruited? | **NPC / recruitment menu, pay gold** between runs; random generation (`metagame.md` §2) |
| 7 | Elemental type chart in v1? | **Yes** — weakness/resistance chart (`party-and-equipment.md` §5) |
| 8 | Fixed-length vs. endless? | **Fixed-length**; endless is a later mode (`runs-and-gauntlet.md` §1) |
| 9 | Mid-battle saves? | **No** — between battles / checkpoints only (`autobattle-and-idle.md` §4) |
| 10 | Background-tab behavior? | **Keep running** (hidden tab continues autobattling) (`autobattle-and-idle.md` §4) |
| 11 | Character names? | **Auto-generated, player-editable** (`party-and-equipment.md` §1) |
| 12 | Durability template? | **New mechanic**: permanent vs. expiring assets (`durability.md`) |
| 13 | Revive items/skills? | **No revives exist** (`combat.md` §6) |

### Locked (round 2)

| # | Question | Decision |
| --- | --- | --- |
| 14 | Box capacity? | **10 boxes × 30 slots** (300) (`metagame.md` §2) |
| 15 | Bench/rotation mid-battle? | **None** — the active party fights every battle (`combat.md` §1) |
| 16 | MP regen? | **Rest nodes only** (`combat.md` §4) |
| 17 | Run lengths? | **1 / 3 / 5 / 10 / 15 / 20 battles**; rest every 5 (`runs-and-gauntlet.md` §1) |
| 18 | Difficulty scaling? | **Numbers-based** for MVP; smarter AI later (`runs-and-gauntlet.md` §4) |
| 19 | Node selection? | **Branching paths** (`runs-and-gauntlet.md` §4) |
| 20 | Run records/scores? | **Not in v1** |
| 21 | Accessory slot? | **Not in v1** (`party-and-equipment.md` §4) |
| 22 | Class-change system? | **No** — classes fixed and simple (`party-and-equipment.md` §2) |
| 23 | Skill loadout size? | **4**, as a data parameter (`ClassDef.loadoutSize`) (`party-and-equipment.md` §5) |
| 24 | Player-authored autobattle scripts? | **Not yet** — curated presets only (`autobattle-and-idle.md` §2) |
| 25 | Premium currency? | **No** — gold only (`metagame.md` §5) |
| 26 | Data source? | **Hardcoded JSON blobs → mock API → real API** (`architecture.md` §6) |
| 27 | How does `Character.gear` reference equipment? | **Unique gear instances** (`GearInstance`), matching inventory + per-instance durability (`data-model.md` §2) |
| 28 | State library? | **None yet** — plain in-memory store (`src/core/store.ts`) over `save.service.ts`; revisit if UI grows (`architecture.md` §6) |

### Locked (round 3)

| # | Question | Decision |
| --- | --- | --- |
| 29 | Player color themes? | **Yes** — create/edit/activate/save/load/delete custom **color profiles** (palette + rarity tints) in a DOM-overlay "Theme Studio" with native color pickers (`src/game/ui/theme-editor.ts`). Fonts/spacing/dimensions are fixed structural presets. |
| 30 | Where do theme profiles live? | **Separate from saves** — a global localStorage key (`covenant.of.crystals.themes`), versioned like saves; only user profiles are stored, built-in presets live in code and can't be deleted/edited (`src/core/themes.ts`). |

### Locked (round 4 — battle system design)

| # | Question | Decision |
| --- | --- | --- |
| 31 | Turn order model? | **Conditional Turn-Based (CTB)**: dynamic timeline queue with reinsertion. SPD sets climb rate; action weight/delay (explicit `SkillDef.delay`) sets how far you fall back. No fixed rounds; ties by stable rule (`combat.md` §2) |
| 32 | Damage formula? | **Ratio-based, unclamped**: `base × (ATK_eff/DEF_eff)` physical, `base × (MAG_eff/RES_eff)` magical, then element × defend × variance (0.9–1.1) × crit (~1.5×) (`combat.md` §5) |
| 33 | Healing formula? | **Magic heals scale with caster MAG** (`heal = basePower × (MAG/MAG_REF)`); **items heal flat**. RES is magic defense only — it does **not** boost outgoing healing (`combat.md` §5) |
| 34 | Status roster in v1? | **statBuff, statDebuff, burn, poison, regen, sleep, blind, freeze**. `shield`/`taunt`/`stun` stay in the types stub but are out of the Phase 2 engine (`combat.md` §5) |
| 35 | Buff/debuff stacking? | **Per-status stacks with a cap** (default 2×); each application adds its own duration (`combat.md` §5) |
| 36 | What is a "turn" of duration? | **The affected actor's own turns** — a 3-turn buff expires after that character takes 3 turns; cooldowns count the caster's own turns (`combat.md` §5) |
| 37 | DOT tick cadence? | **burn / regen tick at the start of the affected actor's own turn**; **poison ticks on a global interval** (every 3 resolved turns), independent of the victim (`combat.md` §5) |
| 38 | CC semantics? | **Sleep** wakes on taking damage (else N own turns); **freeze** skips N turns unconditionally; **blind** halves the affected actor's accuracy (`combat.md` §5) |
| 39 | Derived stats in scope? | **Crit + dodge** only. blind leans on an accuracy penalty; standalone accuracy/block stats are out of v1 (`combat.md` §5, §11) |
| 40 | Enemy AI format? | **Data-driven priority scripts** `(condition → action)`, first-true wins; profiles `minion`/`tanky`/`glass`/`boss`. Same interpreter drives autobattle in Phase 4 (`combat.md` §8) |
| 41 | Battle outcome surface? | The engine returns a **`BattleResult` outcome contract** (status, koIds, survivors, xpAwarded, drops, log); the run layer (Phase 3) applies permadeath/rewards (`combat.md` §7) |
| 42 | Phase 2 test battle scope? | **Attack / Skill / Defend + a fixed scripted squad; manual control only.** Items and escape are engine-ready but not wired in the scene (`combat.md` §4) |

### Locked (round 5 — Phase 3 run loop / fun systems)

| # | Question | Decision |
| --- | --- | --- |
| 43 | Shop placement & refresh? | **One meta shop tab on the main view**, between runs. Always-stock potions + rotating stock of gear & skill items. Stock **regenerates each time a run completes**. No in-run shop nodes this phase (`phase-3-run-loop-plan.md` §3) |
| 44 | Scroll/tome coverage? | **Auto-generate** a Scroll and Tome of every player-facing skill from the `SKILLS` dataset (enemy-only skills excluded); the shop draws from the full pool (`phase-3-run-loop-plan.md` §3) |
| 45 | Tome learning restriction? | **Open to any character** — a tome permanently teaches the skill to whoever uses it; a class-ineffective skill is the player's call (`phase-3-run-loop-plan.md` §3) |
| 46 | Item usage scope? | Wire the **Item action in-battle** (potions, scrolls) **and** on the run map between battles; rest nodes still heal (`phase-3-run-loop-plan.md` §3) |
| 47 | Gear durability in P3? | **All shop/drop gear is permanent in P3**; durability ticking still runs at run resolution (trivially a no-op); expiring assets + pricing arrive with Phase 5 (`phase-3-run-loop-plan.md` §3) |
| 48 | Recruitment shape? | **2–3 random characters per refresh**: random class from unlocked, **level 1, permanent**, each a **flat gold price**; refresh on run completion (`phase-3-run-loop-plan.md` §3) |
| 49 | XP & leveling in P3? | **Survivors accumulate XP (visible) but no level-ups** until Phase 4; rewards this phase are gold + drops + shopping (`phase-3-run-loop-plan.md` §3) |
| 50 | Drop banking? | **Drops bank at run resolution** — accumulate on the `ActiveRun`, convert to persistent inventory at run end; partial payout on failure/abandon (`phase-3-run-loop-plan.md` §3) |
| 51 | Run map structure? | **Minimal branching map** — each step offers 2–3 visible next-node choices (battle / elite / rest), honoring #19; branch *detail* stays a Phase 5 concern (`phase-3-run-loop-plan.md` §3) |
| 52 | Rotating stock size? | Always potions (Health / Greater Health / Mana / Greater Mana) + **4 gear + 3 skill items** per refresh (`phase-3-run-loop-plan.md` §3) |
| 53 | Run lengths offered? | **Starter subset 3 / 5 / 10** at run start (1/15/20 later with difficulty bands) (`phase-3-run-loop-plan.md` §3) |
| 54 | Selling? | **Sell gear for gold** from the shop tab (unwanted drops become a second gold source); consumables are not sellable in P3 (`phase-3-run-loop-plan.md` §3) |

### Still open

| # | Question | Where it lives |
| --- | --- | --- |
| 1 | Duplicates of the same class in a box (talent pool)? | `metagame.md` |
| 2 | Party composition synergies? | `metagame.md` |
| 3 | What exactly rest points offer? (Deliberately open — tuning lever) | `runs-and-gauntlet.md` |
| 4 | Autobattle summary-skip? | `autobattle-and-idle.md` |
| 5 | State library / Vitest / IndexedDB choices? | `architecture.md` |
| 6 | Mock API shape when shops/recruitment/seeded runs need dynamic data? | `architecture.md` §6 |

---

## Working title

No title yet. Candidates to evaluate later (nothing decided):
- _TBD — the roster-is-the-save framing should inspire the name._

---

## Importing the full design wiki

When the larger design wiki arrives (story/lore content):
1. Paste each relevant section into the matching doc's "Source material"
   area (add one if missing), keeping decisions marked.
2. Copy any decisions into the decision log above (status → Decided + note).
3. Update the doc status table in `docs/README.md`.

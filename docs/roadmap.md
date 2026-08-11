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

### Phase 1 — Data layer & meta screens
- [x] Data loaders + definitions (classes, skills, items, enemies) — stub data
- [x] Durability (`permanent` / `runsRemaining`) in the data model and UI
- [x] SaveManager (local profiles / mock API, versioned) + profile creation
- [ ] Meta UI: boxes (10 × 30), party selection (4 max), equip screen, inventory
- [x] Core store with actions (addToBox, equip, startRun) — store + `addToBox`/`equip` done; `startRun` lands with the Phase 3 run loop
- **Exit criteria:** a character can be moved into a party and equipped;
  state survives reload. Docs: `metagame.md`, `party-and-equipment.md`,
  `durability.md`, `data-model.md`.

### Phase 2 — Combat engine prototype
- [ ] Turn engine (speed order, actions, MP; MP regens at rest nodes only)
- [ ] Damage/status formulas in `core/combat` (unit-tested), incl. element
  weakness/resistance multipliers
- [ ] Enemy AI profiles
- [ ] Minimal BattleScene: a scripted test battle, manual control only
- **Exit criteria:** manual battle vs. a stub enemy resolves to a win/loss;
  formulas match the spec in `combat.md`.

### Phase 3 — Run loop
- [ ] Seeded run generation (fixed-length; lengths 1/3/5/10/15/20; branching
  paths; difficulty-by-numbers curve)
- [ ] Rest nodes every 5 battles (recovery — exact features to tune in Phase 5)
- [ ] Battle → rewards → next node → boss → run end
- [ ] Permadeath resolution (immediate, no revives) + survivor XP/gear payout
- [ ] Durability tick-down at run resolution
- [ ] Result screen + rewards to meta (gold, drops, unlocks)
- **Exit criteria:** a full run can be played start-to-finish and meta
  progression is visible. Docs: `runs-and-gauntlet.md`.

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
| 3 | Permadeath resolution? | **Immediate** — KO'd at battle end is dead, no recovery (`combat.md` §5) |
| 4 | Does gear vanish with a permadead character? | **No** — returns to inventory unless already expiring that run (`durability.md` §4) |
| 5 | Full-wipe behavior? | **Run ends, party = 0 characters**, rebuild from boxes/recruitment (`combat.md` §5) |
| 6 | How are new characters recruited? | **NPC / recruitment menu, pay gold** between runs; random generation (`metagame.md` §2) |
| 7 | Elemental type chart in v1? | **Yes** — weakness/resistance chart (`party-and-equipment.md` §5) |
| 8 | Fixed-length vs. endless? | **Fixed-length**; endless is a later mode (`runs-and-gauntlet.md` §1) |
| 9 | Mid-battle saves? | **No** — between battles / checkpoints only (`autobattle-and-idle.md` §4) |
| 10 | Background-tab behavior? | **Keep running** (hidden tab continues autobattling) (`autobattle-and-idle.md` §4) |
| 11 | Character names? | **Auto-generated, player-editable** (`party-and-equipment.md` §1) |
| 12 | Durability template? | **New mechanic**: permanent vs. expiring assets (`durability.md`) |
| 13 | Revive items/skills? | **No revives exist** (`combat.md` §4) |

### Locked (round 2)

| # | Question | Decision |
| --- | --- | --- |
| 14 | Box capacity? | **10 boxes × 30 slots** (300) (`metagame.md` §2) |
| 15 | Bench/rotation mid-battle? | **None** — the active party fights every battle (`combat.md` §1) |
| 16 | MP regen? | **Rest nodes only** (`combat.md` §2) |
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

### Still open

| # | Question | Where it lives |
| --- | --- | --- |
| 1 | Duplicates of the same class in a box (talent pool)? | `metagame.md` |
| 2 | Party composition synergies? | `metagame.md` |
| 3 | What exactly rest points offer? (Deliberately open — tuning lever) | `runs-and-gauntlet.md` |
| 4 | Autobattle summary-skip? | `autobattle-and-idle.md` |
| 5 | Drops banked immediately vs. held mid-run? | `data-model.md` |
| 6 | State library / Vitest / IndexedDB choices? | `architecture.md` |

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

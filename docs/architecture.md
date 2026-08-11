# Architecture

Technical direction for building the game: stack, project layout, state
management, persistence, and data-driven design.

---

## 1. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript** | Type safety across combat engine, item/equipment data, save systems |
| Framework | **Phaser 4** (v4.x, npm `phaser`) | HTML5 WebGL game engine; new renderer, familiar API |
| Bundler | **Vite** | Dev server w/ hot reload, fast prod builds |
| Runtime | Node 20+ (v24 available) | `npm create @phaserjs/game@latest` scaffolds the Phaser 4 + Vite template |
| Storage (v1) | **localStorage → IndexedDB** | Local-first saves; IndexedDB if save size grows |
| Data source (demo) | **hardcoded JSON blobs** → mock API → real API | Three-stage plan (see §6) |

**Key Phaser 4 note:** scenes still organize game state (Boot, Meta, Run,
Battle), but Phaser scenes should render *game state*; business logic and
data live in plain TS modules so they're testable without a canvas.

---

## 2. Suggested project layout

```
src/
├── main.ts                    # bootstrap: mount game in #game-container
├── game/
│   ├── config.ts              # Phaser.Game config (resolution, scale, scenes)
│   ├── scenes/
│   │   ├── BootScene.ts       # asset loading, save load
│   │   ├── MetaScene.ts       # login/profile, boxes, party, equip UI
│   │   ├── RunScene.ts        # run map / node navigation / checkpoints
│   │   ├── BattleScene.ts     # battle board, turn execution, animations
│   │   └── ResultScene.ts     # run end, rewards, payout
│   └── ui/                    # shared UI widgets (panels, buttons, lists)
├── core/                      # pure logic, no Phaser deps (unit-testable)
│   ├── combat/                # turn engine, damage, status, autobattle AI
│   ├── meta/                  # roster, boxes, party, inventory, currency
│   ├── runs/                  # run generation (seeded), node logic, rewards
│   ├── data/                  # definitions (see §5) + data-loaders
│   ├── save/                  # SaveManager: versioning, localStorage/IndexedDB
│   └── rng/                   # seeded PRNG (mulberry32 / xorshift)
├── assets/                    # sprites, portraits, sfx, music, data json
└── data/                      # character/class/item/skill/enemy balance data
```

---

## 3. State management

- **Single source of truth:** one `GameState` object graph
  (`PlayerProfile`, `Boxes`, `Inventory`, `ActiveRun`) held by a
  `GameStore` (plain TS + event emitter, or a lightweight store — no heavy
  framework needed inside Phaser).
- **Phaser scenes subscribe** to store changes for UI; scenes never own
  authoritative state.
- **Seeded RNG:** all run-generation randomness comes from a seed stored on
  the run, so any run is reproducible/replayable (`runs-and-gauntlet.md` §4).
- **Actions over direct mutation** (recommended): commands like
  `startRun(partyIds)`, `performAction(battle, actorId, action)`,
  `applyRewards(run)` — these are the unit-testable seams.

---

## 4. Persistence

- **SaveManager** interface with two goals: versioned schema + atomic writes.
  - v1: `localStorage` keyed per profile; migrate to IndexedDB when a save
    grows past a few hundred KB (roster + inventory will).
  - Every save carries a **schema version** + migration chain.
- **When to save:** per `autobattle-and-idle.md` §4 checkpoints (post-battle,
  rest nodes, meta screen changes, unload).
- **What's in a save:** profile, boxes, party, inventory, currency, unlocks,
  active run (if any) at its last checkpoint. Never store derived state.

---

## 5. Data-driven design

Characters, classes, skills, items, enemies, balance constants, and node
tables are **data** (TS modules or JSON in `src/data/`), loaded by data
loaders. Code never hardcodes numbers. This is what makes balance tuning and
new content additive without touching combat logic.

---

## 6. Data source / login / backend

**Decision (locked):** three stages — **hardcoded JSON blobs** now, a
**mock API** when dynamic generation is needed, then the **real API**.

1. **Stage 1 (now):** classes, items, skills, enemies, and the starting roster
   are hardcoded JSON/TS blobs. Maximum flexibility while the design is in
   flux — no service layer at all.
2. **Stage 2 (mock):** when recruitment, shops, and seeded run generation need
   "created on the fly" data, stand up a mock API that mimics the future
   endpoint shape (login, boxes, shop, recruitment) so the UI and data flow
   are built against the real contract early.
3. **Stage 3 (real):** swap the mock for the real backend (REST + JWT, cloud
   saves) behind the same interface.
- Demo accounts: local profiles via SaveManager (pick/create a profile name).
- All game logic must be agnostic to where data/saves live — pass an abstract
  data source + storage backend into the game.

---

## 7. Testing

- Core combat/meta/run logic: **unit tests** (Vitest) — no Phaser dependency.
- Damage formulas, seeded RNG reproducibility, autobattle AI behavior,
  permadeath resolution, and save/load round-trips are the highest-value tests.
- Phaser scenes stay thin enough that UI bugs are found by eye.

---

## Open questions (remaining)

1. Lightweight state library vs. hand-rolled store + emitter?
2. Vitest for unit tests acceptable? (Recommended.)
3. IndexedDB now, or localStorage → migrate when needed?

Decision log: `roadmap.md`.

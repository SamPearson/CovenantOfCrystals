# Phase 2 Plan — CTB Combat Engine Prototype

> Working doc for the combat-engine build. The complete rule set lives in
> `combat.md`; decisions land in the `roadmap.md` decision log (round 4).

## 1. Goal

Ship the **Conditional Turn-Based combat engine** with unit-tested formulas
and a **minimal scripted BattleScene**: a manual battle versus a stub enemy
squad resolves to a win/loss following the spec in `combat.md`.

The combat engine is the heart of the game — everything else (runs, autobattle,
balance) hangs off it. It must be **pure, deterministic (seeded), and
Phaser-free** so it can be unit-tested headlessly and shared by manual play,
autobattle, and the run loop.

## 2. Status

- Phase 1 (data layer + meta screens + theming) is done. `src/core/` has no
  `combat/` directory yet.
- Design questions for the battle system are **resolved** (round-4 decisions in
  `roadmap.md`); this round's answers are collected in `combat.md`.

## 3. Scope

### In scope (this phase)

- `src/core/combat/` — pure TS modules (see §4) + Vitest suites.
- CTB timeline: SPD climb, action weight/delay, reinsert queue, tie rules.
- Damage & healing formulas, element multipliers, crit/dodge/blind hit roll,
  variance, per-status stacking + cap, own-turn durations, DOT tick cadence,
  sleep/blind/freeze behavior, cleanse.
- Enemy AI priority-script interpreter + the `minion` / `tanky` / `glass` /
  `boss` profiles.
- `BattleState` / `BattleActor` / `BattleResult` types and battle resolution
  end-checks (won / lost / fled, full wipe).
- The **outcome contract** (`BattleResult`) — the run layer (Phase 3) consumes
  it; the engine never mutates meta state.
- Minimal `BattleScene`: a fixed scripted enemy squad, manual control,
  Attack / Skill / Defend only.
- Data-model surface changes (see §6).

### Out of scope (deferred)

- Items & escape inside the battle scene (engine supports the action forms;
  the test battle exposes only Attack/Skill/Defend).
- Autobattle presets (Phase 4) — but the AI interpreter from §4.d is the same
  interpreter autobattle will drive.
- Run loop, rewards payout, durability ticks, permadeath resolution —
  Phase 3, via `BattleResult`.
- Direct queue-pull spells (haste/slow/interrupt), guard-an-ally intercept,
  environmental timeline effects — designed hooks, not built.
- `shield` / `taunt` / `stun` statuses — types stub only, out of the engine.
- All balance constants (SPD_REF, caps, powers, variance, crit rates) — the
  Phase 5 data pass.

## 4. Module layout — `src/core/combat/`

All modules are pure (no Phaser, no store access). Seeded RNG passed in.

- **`src/core/combat/types.ts`** — `BattleActor`, `BattleState`,
  `BattleResult`, `BattleAction` (attack | skill | item | defend | escape),
  `BattleLogEntry`, `TurnOutcome`. The run layer's contract types.
- **`src/core/combat/timeline.ts`** — CTB queue. Functions:
  `timeToNextTurn(spd, actionDelay, spdRef)` → delay before reinsert;
  `insertActor(queue, actorId, nextAt)`, `pullForward(...)` /
  `pushBack(...)` (resolve `nextAt` core/inspect mutations; the queue
  manipulation hook for statuses/spells). Tie-breaking helper.
- **`src/core/combat/status.ts`** — status effects: `applyStatus`,
  `tickOwnTurn` (burn damage, regen heal), `tickGlobalInterval` (poison),
  `tickDuration` (own-turn decrement, expiration), stacking + cap, CC logic
  (sleep wake-on-damage, freeze skip-N, blind accuracy penalty), `cleanse`.
- **`src/core/combat/damage.ts`** — pure formulas from `combat.md` §5:
  `physicalDamage`, `magicalDamage`, `finalizeDamage` (element × defend ×
  variance × crit), `hitCheck(accuracy, dodge, rng)`, `healMagic` (MAG
  scaling), item heal (flat). No balance constants hardcoded — read from a
  balance-data object.
- **`src/core/combat/ai.ts`** — priority-script interpreter: `chooseAction(
  enemy, squadState, script, rng)` scans a `(condition → action)` list and
  returns the first match. The same facade autobattle presets will use.
- **`src/core/combat/battle.ts`** — orchestration: `createBattle(partyDefs,
  enemyDefs, seed)`, `performAction(battle, actorId, action, rng)`, end-checks
  (`getBattleResult`), full-wipe detection.
- **`src/core/combat/index.ts`** — re-exports.
- **`src/core/combat/*.test.ts`** — Vitest suites per module (see §8).

Suggested seeding: reuse `src/core/rng/rng.ts` (mulberry32) — pass an RNG
handle into `createBattle` / `performAction` so battles replay with the same
seed (already proven in Phase 0).

## 5. Turn flow (what `battle.ts` orchestrates)

Per `combat.md` §3, for each queue-slot actor `C`:

1. Own-turn statuses tick first (burn/regen) — a killing tick ends the turn.
2. CC check (sleep/freeze) → skip action, tick counters, light waiting delay.
3. Act (manual or AI): resolve hit roll (accuracy × (1 − dodge), blind halves
   accuracy), crit roll, damage/variance/element, MP, cooldowns, new statuses.
4. Duration tick for `C`; expired effects fall off.
5. Re-insert `C` at `nextAt = turnTime + actionDelay × (SPD_REF / SPD)`.
6. Advance global turn counter (poison interval fires every 3 resolved turns);
   check battle-end conditions.

## 6. Data-model & types surface changes

These are the minimal `src/core/types.ts` / `src/core/data/*` edits the engine
needs. Land with the engine build (they stay in lockstep).

- **`SkillDef.delay: number`** — new field: the action's weight on the queue
  (higher = slower). Balance data, not code.
- **Action delays:** basic Attack, Defend, and Item get delay constants in
  balance data (e.g., Attack ~fastest, Item ~slowest).
- **`StatusEffect.kind`** — add `'sleep' | 'blind' | 'freeze'`; keep
  `'shield' | 'taunt' | 'stun'` present in the union but unused by the engine
  (out of Phase 2 scope).
- **Heal skills:** `scaling: 'hp'` → `scaling: 'mag'` for `heal` /
  `greater_heal` / `soothing_song` in `src/core/data/skills.ts` (healing scales
  with caster MAG per `combat.md` §5). Item heals stay flat `use.healHp`.
  Heal `power` values become the base for `heal = basePower × (MAG/MAG_REF)`.
- **Enemy AI:** `ai: 'minion' | 'tanky' | 'glass' | 'boss'` already exists on
  `EnemyDef` — add the matching **priority-script datasets** (new
  `src/core/data/ai.ts` or inline per-enemy). Boss scripts may add calendar
  patterns (condition on turn count).
- **`BattleState` / `BattleActor`** replace the informal `BattleActor` sketch
  sketched in `data-model.md` (waiting-state only; no derived state stored;
  current HP/MP live only in a `BattleState`).
- **Balance constants:** `SPD_REF`, stat cap (2×), crit rate, dodge rate,
  variance (0.9–1.1), poison interval (3 turns), item/base-attack delays →
  a single balance-data object consumed by `damage.ts` / `timeline.ts`
  (placeholders now, tuned in Phase 5).

## 7. Milestones & exit criteria

### M1 — combat types + timeline ✅ done
- `types.ts`, `timeline.ts` + tests. Reinsert ordering, SPD/SPD_REF curve,
  tie rules, push/pull helpers confirm position math.

### M2 — damage, healing & status ✅ done
- `damage.ts`, `status.ts` + tests (both in `src/core/combat/`, 22 + 28 tests).
  Formulas match `combat.md` §5 exactly: element multipliers, unclamped ratio,
  variance bounds, crit/dodge/blind, heal scaling, stacking/cap, own-turn
  durations, DOT cadence, CC behavior.

### M3 — enemy AI scripts ✅ done
- `ai.ts` + priority-script datasets for `minion` / `tanky` / `glass` / `boss`.
  First-true-condition selection is deterministic and testable.
- `src/core/combat/ai.ts` (interpreter, 11 tests) + `src/core/data/ai.ts`
  (`AI_SCRIPTS`, `getAiScript`), 5 data-integrity tests. `EnemyDef.ai` is now
  typed `AiProfileId`.

### M4 — battle orchestration + outcome contract
- `battle.ts` + tests. `createBattle` → `performAction` loop → end-checks →
  `BattleResult` shape (status, koIds, survivors, xpAwarded, drops, log).
  Permadeath/full-wipe detected here, **applied** by the run layer later.

### M5 — minimal scripted BattleScene
- A `BattleScene` (manual control) with a **fixed scripted squad** — e.g., 2
  slimes + 1 goblin — against the player's party, Attack / Skill / Defend only.
  Battle resolves via `battle.ts`; result reflected in the scene (win/loss +
  log).
- Wire the queue strip, HP/MP bars, action buttons, damage numbers, and status
  icons to the live `BattleState` (scenes render state only, per
  `architecture.md`).

### Exit criteria (from roadmap.md)
- A manual battle vs. a stub enemy **resolves to a win or a loss**.
- Formulas match the spec in `combat.md` (verified by `npm run test`).
- Seeded determinism: the same seed + same inputs → the same battle.

## 8. Test matrix (Vitest)

| Area | Cases |
| --- | --- |
| Timeline | SPD differences change turn counts; delay pushes back; ties resolve by stable rule; reinsert math (SPD_REF) |
| Damage | Physical & magical ratio (unclamped); every element multiplier (fire→frost ×2, fire→water ×0.5, …); variance stays in [0.9, 1.1]; crit applies ~1.5× |
| Hit roll | hit = accuracy × (1 − dodge); blind halves accuracy; dodge from SPD/gear; miss deals 0 |
| Healing | Magic heal = base × (MAG/MAG_REF); item heal flat; RES does not increase healing |
| Status | apply/stack/cap; own-turn duration expiry; expire-after-N-own-turns |
| DOT | burn/regen tick on own turn; poison ticks every 3 resolved turns; killing tick ends turn with no action |
| CC | sleep wakes on damage / ends after N turns; freeze skips N turns unconditionally; blind accuracy penalty |
| AI | first-true-condition wins; profile sanity (boss calendar pattern) |
| Battle | won / lost / fled; full wipe; `BattleResult` shape; KO'd actor can't act |
| Determinism | Same seed → identical battle sequence |

## 9. Risks / notes

- **Balance is fake until Phase 5:** stub stats (ATK 8–20, DEF 6–16) mean a
  2.5× ratio swing is common; battles may feel swingy. That is accepted — the
  point now is the engine + formulas, not tuning.
- **CTB readability:** a live queue with delays is harder to read than static
  initiative. The queue strip (§10 of `combat.md`) plus the battle log are the
  mitigations; polish in Phase 6.
- **Open-space extension:** keep `nextAt` mutations and the AI facade `public`
  — Phase 4 autobattle and Phase 3 event nodes reuse them unchanged.

## 10. Landing this

Keep `combat.md` and the roadmap decision log current as builds resolve edge
questions. When the engine lands, Phase 3 consumes `BattleResult` for
rewards/permadeath and reuses the AI interpreter for autobattle.
# Phase 4 Plan — Autobattle, Speed Controls & Idle Play

> Working doc for the autobattle build. The complete rule set lives in
> `autobattle-and-idle.md` (+ `combat.md` §8, `roadmap.md`); decisions land in
> the `roadmap.md` decision log (round 6).
>
> Decisions for this phase were settled in a planning session on 2026-08-19
> (leveling deferral, headless ticker, preset scope, speed controls, auto-stop
> points, manual-intervention UX). See §3.

## 1. Goal

Ship **autobattle + idle play**: per-character AI scripts (v1 = two curated
presets) drive the party through battles under the **same rules engine** as
manual play; speed controls (1×/2×/4×, skip animations, never-trimmed battle
log) make watching faster; and a **real-time headless ticker** lets a run
"continuously occur" while the tab is hidden, resuming exactly where it was
left. **Leveling is deliberately deferred to Phase 5** (economy/balance pass).

This phase completes the roadmap's Phase 4 exit criteria: *"a run can be left
mid-way (tab hidden, still running) and resumed exactly where it was;
autobattle wins/loses using the same rules as manual."*

## 2. Status

- **Planning complete (2026-08-19).** All open questions settled with the
  user. No code landed yet. This document is the working build plan.
- Phase 3 baseline: full suite 373/373, `tsc --noEmit` clean, run loop
  (recruit → gear → run → reward) playable end-to-end.

## 3. Design decisions (this planning session)

All settled with the user on 2026-08-19. These become `roadmap.md` decision-log
round 6.

| # | Question | Decision |
| --- | --- | --- |
| A1 | Leveling / XP curves | **Deferred to Phase 5** (fits the economy/balance pass). P4 ships autobattle + idle only; XP continues to accumulate, never levels. |
| A2 | Hidden tab "keeps running" | **Real-time headless ticker.** Battles resolve continuously off wall-clock deltas (CTB `nextAt`/`turnTime`), *not* batched-and-resolved-on-return. The game continuously occurs; the scene just renders the ticker's state. |
| A3 | Preset scope (v1) | **Two curated presets only: DPS and Healer** (characters have basic loadouts). DPS = "use a damaging skill if you have the MP, else attack". Healer = "if any party member's HP < 60%, use the healing skill, else defend"; out of MP → defend. |
| A4 | Complex script DSL | **Own design milestone (M6, later)** — condition lists with boolean operators, target conditions with operators, richer actions (e.g. "if MP > 50% AND party HP < 50% use strongest group heal", "if enemy_type == boss AND enemy not poisoned use poison dagger"). M1 ships the *minimal* interpreter extension the two v1 presets need (MP + `and`). |
| A5 | Default script assignment | **Auto-assign by loadout** — a character who knows a healing skill gets Healer, else DPS. Player can override per character. |
| A6 | Healer fallback (no MP) | **Defend** (matches "otherwise defend"). |
| A7 | Battle log | **Never skips any actions.** Skip/4× accelerate rendering only; the log is the full audit trail at any speed. |
| A8 | Speed persistence | **Speed + skip settings persist per profile.** |
| A9 | Auto-advance stop points | **Configurable via dialog checkboxes:** boss battles, elite battles, individual character permadeath, rest points. **Party wipe and run-end (results screen) are always hard stops** — not configurable. |
| A10 | Manual intervention | **Each player card gets an auto toggle button + a whole-party toggle button.** Switching a character (or the party) back to Manual is always available, mid-battle. |
| A11 | Manual-mode hidden tab | **Waits at the next decision point** (per `autobattle-and-idle.md` §5) — no resolution without player input when autobattle is off. |
| A12 | Save schema | **Bump to v2** with a default-filling migration (`autobattle` prefs + per-character script). Small enough to be worth it this phase (vs. P3's waived bump for disposable saves). |

> **Noted (not a decision yet):** M1 requires a small extension to the AI
> interpreter (`src/core/combat/ai.ts`) — `AiActorState` gains `mp`/`maxMp` and
> `AiCondition` gains an MP/castability check plus an `and`/`any` combinator.
> This is the intentional seed of the M6 DSL; we keep it minimal and do not
> design the full DSL here.

## 4. Scope

### In scope (this phase)

- `src/core/combat/ai.ts` — **minimal interpreter extension**: `mp`/`maxMp` on
  `AiActorState`, new conditions `mp-pct` and `can-cast` (skillId optional),
  and a compound `and` / `any` combinator. Still pure + deterministic.
- `src/core/data/ai-presets.ts` (new) — player preset scripts (`dps`, `healer`)
  as `AiScript` data; `getPlayerAiScript(id)`; `defaultPresetFor(character)`
  (healer if the character knows any `kind === 'heal'` skill, else dps).
- `src/core/combat/battle.ts` — `choosePartyAction(battle, actorId, presetId,
  rng?)`: wraps the existing exported `buildAiField` + `chooseAction` (mirrors
  `chooseEnemyAction`).
- `src/core/types.ts` — `PlayerAiPresetId = 'dps' | 'healer'`;
  `Character.autobattle?: PlayerAiPresetId`; `AutobattlePrefs { speed: 1|2|4;
  skipAnimations: boolean; stops: { boss; elite; permadeath; rest: boolean } }`
  on `PlayerProfile`.
- **Headless ticker** (`src/core/ticker/`, new): drives `performAction` when
  wall-clock passes each actor's due `nextAt`; player side resolves via preset
  script, enemy side via `chooseEnemyAction`. Scene renders ticker state.
- **BattleScene** — per-card auto toggle + whole-party toggle, manual
  hand-off, speed controls, skip animations, full persistent battle log.
- **RunScene** — auto-advance (queue next node after battle) + stop-point
  dialog; hard stops on party wipe / run end.
- Store actions + persistence: `setAutobattle(characterId, preset?)`,
  `setPartyAutobattle(preset | off)`, `setSpeed`, `setAutoStop`, `setSkip`;
  `save.service.ts` schema v2 + default-filling migration.

### Out of scope (deferred)

- **Leveling / XP curves / level-ups** — Phase 5.
- **Full script DSL v2** (boolean condition lists, target-condition operators,
  "strongest heal" / enemy-type predicates) — M6 design milestone, later.
- **More than two presets** (Balanced / Tank / Glass Cannon) — M6+.
- **True "idle-run"** (auto-start new runs) — `autobattle-and-idle.md` §5
  stretch goal, not v1.
- **Balance tuning** — Phase 5 data pass.
- **Mid-battle saves** — locked #9 stands (checkpoints are post-battle / rest).

## 5. Module layout

### `src/core/combat/`

- **`ai.ts`** — extend without breaking the existing surface:
  - `AiActorState` gains `mp: number` and `maxMp: number`.
  - New conditions: `{ kind: 'mp-pct'; op; value }` (fraction of maxMp),
    `{ kind: 'can-cast'; skillId?: string }` (actor has MP ≥ the skill's cost;
    omit skillId → any known skill castable), `{ kind: 'and'; conditions: AiCondition[] }`
    and `{ kind: 'any'; conditions: AiCondition[] }`.
  - `chooseAction` unchanged in contract; determinism preserved (combinators
    are pure; only `random-*` targets consume `rng`).

### `src/core/data/`

- **`ai-presets.ts`** (new) — `PLAYER_AI_SCRIPTS: Record<PlayerAiPresetId, AiScript>`:
  - `dps`: `[ { condition: { kind: 'can-cast' }, action: { kind: 'skill',
    target: { kind: 'lowest-hp-enemy' } } }, { condition: { kind: 'always' },
    action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } } ]`
    (primary skill is the damaging skill; loadouts are basic).
  - `healer`: `[ { condition: { kind: 'and', conditions: [{ kind: 'hp-pct',
    scope: 'any-ally', op: '<', value: 0.6 }, { kind: 'can-cast' }] }, action:
    { kind: 'skill', target: { kind: 'lowest-hp-ally' } } }, { condition: {
    kind: 'always' }, action: { kind: 'defend' } } ]`
  - `getPlayerAiScript(id)`; `defaultPresetFor(character)`.

### `src/core/combat/`

- **`battle.ts`** — add `choosePartyAction(battle, actorId, presetId, rng?)`
  (uses existing `buildAiField`, exported at battle.ts:513, and `chooseAction`).

### `src/core/ticker/` (new — pure, clock-driven)

- **`ticker.ts`** — `createTicker(battle, clock)` / `tick(battle, now, …)`:
  while `peekNext(queue).nextAt <= now`, resolve that actor's turn —
  player side via `choosePartyAction` (or `null` for Manual → pause), enemy
  side via `chooseEnemyAction`; feed the seeded `rng`. Speed multiplies the
  clock (`now × speed`) so 2×/4× resolve turns faster. Emits per-turn events
  for the scene to animate or skip.
- **`index.ts`** — re-exports.

### `src/core/`

- **`types.ts`** — `PlayerAiPresetId`, `Character.autobattle`,
  `AutobattlePrefs` (+ `speed`, `skipAnimations`, `stops`) on `PlayerProfile`.
- **`store.ts`** — actions listed in §4; scene read-only (architecture.md §3).
- **`save.service.ts`** — persist `AutobattlePrefs` + per-character `autobattle`;
  schema bump **1 → 2** with default-filling migration (A12).

### `src/game/scenes/`

- **`BattleScene.ts`** — render ticker state; per-card auto toggle + whole-party
  toggle; Manual mode pauses the ticker at the player's turn; speed control;
  skip-animations renders turns instantly (log untouched); full battle log.
- **`RunScene.ts`** — auto-advance (after battle, queue the next node);
  stop-point dialog (A9); hard stops; hand-off to BattleScene / ResultScene
  unchanged.

## 6. Data-model & types surface changes

```ts
// types.ts additions
export type PlayerAiPresetId = 'dps' | 'healer'

interface Character {
  // ...existing...
  autobattle?: PlayerAiPresetId   // unset = Manual (A5 default assigned at run start)
}

interface AutobattlePrefs {
  speed: 1 | 2 | 4
  skipAnimations: boolean
  stops: { boss: boolean; elite: boolean; permadeath: boolean; rest: boolean }
}

interface PlayerProfile {
  // ...existing...
  autobattle: AutobattlePrefs
}

// ai.ts additions
interface AiActorState {
  // ...existing...
  mp: number
  maxMp: number
}

type AiCondition =
  // ...existing...
  | { kind: 'mp-pct'; op: AiCompareOp; value: number }
  | { kind: 'can-cast'; skillId?: string }
  | { kind: 'and'; conditions: AiCondition[] }
  | { kind: 'any'; conditions: AiCondition[] }
```

Notes:
- **Enemies have no MP** (`BattleActor.mp = 0`, battle.ts:89) — their existing
  scripts never reference `mp-*` / `can-cast`, so the extension is
  backwards-compatible with every current `AI_SCRIPTS` entry.
- **`can-cast`** checks `actor.mp >= getSkill(skillId).cost` (or, with no
  skillId, whether *any* known skill is castable). Cost data already lives on
  `SkillDef.cost`.
- **Ticker owns turn progression; scenes render.** Manual mode = ticker pauses
  on the player's turn and waits for `performAction` via the UI. This unifies
  the manual/autobattle paths on one driver.
- **Clock model:** the CTB engine already schedules turns in wall-clock units
  (`nextAt = turnTime + actionDelay × spdRef/spd`, timeline.ts:17). The ticker
  compares against `performance.now()` (scaled by speed). Browser timer
  throttling in hidden tabs (~1s) just means coarser resolution — acceptable,
  since turns are event-driven, not per-frame.

## 7. Milestones & exit criteria

### M1 — Autobattle core ✅ prerequisite
- Interpreter extension (`ai.ts`): `mp`/`maxMp`, `mp-pct`, `can-cast`, `and`/`any`.
- `ai-presets.ts` (`dps`, `healer`, `getPlayerAiScript`, `defaultPresetFor`);
  `battle.ts` `choosePartyAction`; `Character.autobattle` field + store action.
- Exit: `tsc --noEmit` clean; interpreter tests for the new conditions +
  combinators; preset behavior tests (dps uses damaging skill when castable
  else attack; healer heals an ally below 60% else defends, defends when out
  of MP); `defaultPresetFor` maps heal-knowing characters → healer; enemy
  scripts unchanged (regression: existing `AI_SCRIPTS` still resolve).

### M2 — BattleScene wiring
- Per-card auto toggle + whole-party toggle; Manual hand-off mid-battle; the
  ticker drives autobattle turns; player input drives Manual turns.
- Exit: full battle runs with any mix of auto/manual characters; toggling
  mid-battle takes effect next turn; same-actions-as-manual verified for both
  presets in the log.

### M3 — Speed controls
- 1×/2×/4× (ticker clock scale), skip animations (instant render, log
  untouched), speed + skip persisted per profile.
- Exit: 2×/4× resolve turns proportionally faster; skip renders the finished
  state instantly; the **full** battle log is identical across speeds/skip.

### M4 — Auto-advance + stop dialog
- RunScene queues the next node after a battle; stop-point dialog (checkboxes:
  boss, elite, individual permadeath, rest); hard stops on party wipe and
  run-end; prefs persisted per profile.
- Exit: every stop-point combination works (stops → return to RunScene,
  continues → auto-advance); party wipe and run end always hard-stop regardless
  of checkboxes; prefs round-trip save/load.

### M5 — Headless ticker & leave/return
- `core/ticker/` live; hidden tab keeps resolving via wall-clock; resume
  renders current mid-battle state exactly; checkpoints at safe boundaries
  (post-battle, rest); manual-mode hidden tab waits; audit log on return.
- Exit: tab-away → tab-back resumes mid-battle at the correct state with a
  complete log; a run left at a hard stop waits; checkpoints land at safe
  boundaries only.

### M6 — Script DSL v2 (design milestone, later — not today's ship)
- Design doc first: condition lists with boolean operators, target conditions
  with operators, richer actions ("strongest group heal", enemy-type
  predicates). Then extend `ai.ts` + presets. Flagged for a separate planning
  session.

### Exit criteria (from roadmap.md)
- A run can be left mid-way (tab hidden, still running) and resumed exactly
  where it was.
- Autobattle wins/loses using the same rules as manual play (no reward tax,
  no engine shortcuts).
- Full battle log is preserved at every speed/skip setting.
- Same seed → same run; formulas/rolls unit-tested (`npm run test` green,
  `tsc --noEmit` clean).

## 8. Test matrix (Vitest)

| Area | Cases |
| --- | --- |
| Interpreter | `mp-pct`/`can-cast` resolve correctly; `and`/`any` short-circuit + nest; determinism preserved; enemy scripts unaffected (mp absent) |
| Presets | dps: damaging skill when castable, else attack; healer: heal ally < 60% (lowest-hp-ally), defend otherwise, defend when no MP; same actions as a manual player |
| Defaults | `defaultPresetFor` healer iff knows a `kind === 'heal'` skill |
| Battle wiring | mixed auto/manual party; mid-battle toggle takes effect next turn |
| Speed | 2×/4× resolve proportionally faster; skip = instant; **log identical across all settings** |
| Auto-advance | each stop-point config continues/stops correctly; party wipe + run end always hard-stop; prefs persist |
| Ticker | wall-clock resolution (turns fire at due `nextAt`); resume mid-battle exact; manual-mode hidden tab waits; checkpoints at safe boundaries |
| Persistence | `AutobattlePrefs` + per-character `autobattle` round-trip; schema v1→v2 migration fills defaults |

## 9. Risks / notes

- **DSL creep:** the interpreter extension (M1) is the seed of M6. Guard scope
  — ship only `mp-pct`, `can-cast`, `and`/`any`. Anything richer (target
  operators, "strongest heal") waits for M6's design session.
- **Timer throttling:** hidden tabs throttle `setInterval`/`setTimeout` to
  ~1s. The ticker must be **rAF-independent** and drive from `performance.now`
  deltas, not frame callbacks. Coarse resolution in the background is fine —
  turns are event-driven, not per-frame.
- **No mid-battle checkpoint:** a tab closed mid-battle resumes at the
  pre-battle checkpoint (locked #9). The run "continuously occurs" only while
  the tab is *open but hidden*; closing the app is a checkpoint boundary.
- **Fairness:** autobattle can lose fights a good manual player would win —
  intended (`autobattle-and-idle.md` §6). No engine advantage for the AI side.
- **Determinism vs. wall-clock:** turn *order* is seeded/deterministic;
  *when* turns fire is wall-clock. Battles therefore replay with identical
  rolls given the same seed and action sequence (RNG is seeded), but timing is
  live. Fine for gameplay; unit tests use fixed clock values.

## 10. Landing this

Keep `autobattle-and-idle.md` and `combat.md` §8 current as builds resolve edge
questions, and log every new decision in `roadmap.md` (round 6). When Phase 4
lands, Phase 5 consumes leveling + the balance pass (including the preset
tuning this phase introduces), and M6 (script DSL v2) is its own design pass.
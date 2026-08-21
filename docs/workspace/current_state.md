# Current state of the project

The project is being prototyped. 
A stub of an API exists, this project will eventually connect to it.
In the mean time, everything is going to be dummy/placeholder data.
We're prototyping until we "find the fun".

Phase 1 has been completed. Additionally, theming capabilities have been added.

Phase 2 (the CTB combat engine) now has a thorough plan:
`workspace/phase-2-combat-plan.md`, with the full battle-system spec in
`combat.md` and the design decisions logged in `roadmap.md` (round 4).

Phase 2 milestones 1–2 are built:
- **M1 — Turn engine**: `core/combat/types.ts` + `core/combat/timeline.ts`
  (SPD-based timeline, action delays, reinsert queue, tie rules).
- **M2 — Damage/status formulas**: `core/combat/damage.ts` + `core/combat/status.ts`,
  unit-tested 1:1 against `combat.md` §5 (ratio damage, MAG-scaling /
  flat-item healing, element chart, crit / dodge / blind, stacking + own-turn
  durations, burn/regen/poison cadence, sleep/freeze CC). Data surface landed:
  `SkillDef.delay`, `StatusEffect.kind` += sleep/blind/freeze, balance
  constants `magRef` + `blindAccuracy`, heal skills now MAG-scaling.

Phase 2 milestone 3 is built:
- **M3 — Enemy AI scripts**: `core/combat/ai.ts` (data-driven priority-script
  interpreter) + `core/data/ai.ts` (the minion / tanky / glass / boss profile
  scripts). A script is an ordered list of `(condition → action)` pairs; the
  first true condition wins, so selection is deterministic and testable.
  Conditions cover HP fraction (self / any ally or enemy / lowest ally),
  living-count (`allies` / `enemies`), statuses, cooldown readiness, own-turn
  calendar patterns (`turns-mod` for boss themes) and global turn count.
  Actions pick attack / skill (primary = `skills[0]` unless overridden) /
  defend, plus a target rule (`lowest-hp-enemy`, highest, random via seeded
  RNG, lowest-hp-ally, self, all-enemies/all-allies for AoE). The same
  interpreter is the facade autobattle presets will reuse in Phase 4.
  `EnemyDef.ai` is now typed `AiProfileId = 'minion'|'tanky'|'glass'|'boss'`.
  11 unit tests + 5 data-integrity tests assert first-true wins, deterministic
  seeding, the boss calendar pattern, and that every profile/script is wired to
  a real enemy.

Phase 2 milestone 4 is built:
- **M4 — Battle orchestration + `BattleResult`**: `core/combat/battle.ts`
  (`createBattle` → `performAction` loop → end-checks → `getBattleResult`
  returning the outcome contract: status, koIds, survivors, xpAwarded,
  drops, log). `performAction` follows the `combat.md` §3 flow (own-turn
  ticks, CC skip, cooldown/MP/item/defend/escape handling, reinsert with
  action delay, poison global interval, won/lost/fled end-checks + full
  wipe). Enemies act through the AI interpreter via `chooseEnemyAction`;
  `BattleActor` gained battle-time fields (element, skills, maxMp,
  cooldowns, defending, ownTurn, aiProfile) and `applyStatus` now accepts
  skill `StatusEffect`s. 22 unit tests cover initiative, actions, statuses,
  poison, end conditions and seeded determinism; permadeath/full-wipe are
  detected here and **applied** by the run layer later. Full suite
  259/259 passing, `tsc --noEmit` clean.

Phase 2 milestone 5 is built:
- **M5 — Minimal scripted BattleScene**: `game/scenes/BattleScene.ts` renders
  the live `BattleState` (scene reads state only, never mutates the profile —
  win/loss application stays with the Phase 3 run layer). Entry via the
  "Test Battle" button in the MetaScene header; `scene.start('BattleScene')`
  wires a manual battle of the player's party (`partyForBattle` in
  `game/battle/battle-setup.ts`: equipped party first, else the first boxed
  champions) against the fixed scripted squad (2 slimes + 1 goblin). Manual
  controls: Attack / Defend / character skills with cooldown + MP gating;
  enemies act automatically through `chooseEnemyAction` on a readable delay.
  The scene renders the CTB queue strip, HP/MP bars, status badges, floating
  damage numbers, a live battle log and a win/loss result panel (retry with a
  fresh seed, or return to the base). Pure render helpers live in
  `game/battle/battle-vitals.ts` + `status-icons.ts` and are unit-tested.
  Full suite 273/273 passing, `tsc --noEmit` clean.

Phase 2 (milestones 1–5) is complete.

Phase 3 (runs & metagame) is complete. Milestones M1–M9 from
`workspace/phase-3-run-loop-plan.md` are all built:
- **M1 — Data model & types**: `'scroll'` ItemType + `ItemDef.castSkill`,
  `EnemyDef.xp`/`gold`, `ActiveRun`, `RunNode`, `RunResult`, `ShopStock`,
  `RecruitOffer`, `PlayerProfile.shop`/`recruitment`, `SaveFile.activeRun`,
  mana potions, `skill-items.ts` (Scroll/Tome of every player-facing skill).
- **M2 — Run generation**: `core/runs/run-gen.ts` + `enemy-scale.ts` — seeded
  branching node lists for lengths 3/5/10, rest every 5, boss final,
  difficulty-by-numbers enemy scaling.
- **M3 — Rewards & resolution**: `core/runs/rewards.ts` + `resolve.ts` —
  seeded gold/drop rolls, XP per survivor (no leveling), permadeath (KO'd
  removed, gear → inventory), full-wipe run end, rest-node recover, drop
  banking at run resolution (partial on failure/abandon).
- **M4 — Shop & recruitment**: `core/shop/shop.ts` + `recruitment.ts` —
  always potions + 4 gear + 3 skill rotating stock, sell pricing, 2–3
  level-1 permanent recruits at a flat price; refresh on run completion.
- **M5 — Battle items & scrolls**: `resolveItem` handles `castSkill` (no
  MP/cost/cooldown, 1 use) + BattleScene Item action (potions, scrolls).
- **M6 — RunScene**: branching run map, node navigation, on-map item usage,
  rest heal, battle handoff, boss node, reacted-to run-end transition,
  post-battle/at-rest checkpoints.
- **M7 — Shop & recruitment tabs**: `shop-panel.ts` + `recruitment-panel.ts`
  wired into the meta view.
- **M8 — Store actions & persistence**: `startRun`/`resolveNode`/`resolveRest`/
  `abandonRun`/`useItemOutOfBattle` and shop/recruitment refresh on run
  resolution; buy/sell/recruit helpers live in `core/shop/*`; `activeRun` +
  shop/recruitment persisted via `save.service.ts`. Schema version stayed 1 —
  no migration was needed (prototyping; waived).
- **M9 — ResultScene**: standalone `scenes/ResultScene.ts` — victory /
  wipe / abandon outcomes, gold-drops-XP summary, payout already banked to
  meta server-side, return to base / re-run on the main view. `RunScene`
  hands off with `scene.start('ResultScene', { result })`.

The full loop **recruit → gear → run → reward** is visible and repeatable.
Leveling is deferred to Phase 4 (XP accumulates no level-ups).

Phase 4 (autobattle & idle) is in progress. Milestones from
`workspace/phase-4-autobattle-plan.md`:
- **M1 — Autobattle core** ✅ done — interpreter extension (`mp`/`maxMp`,
  `mp-pct`, `can-cast`, `and`/`any`), `ai-presets.ts` (`dps`/`healer` +
  `defaultPresetFor`), `choosePartyAction` in `battle.ts`, `Character.autobattle`
  field + `setAutobattle` store action, save schema v2 migration. 408/408 green.
- **M2 — BattleScene wiring** ✅ done — per-card AUTO/MANUAL toggle + whole-party
  toggle; Manual hand-off mid-battle; Auto turns driven by `choosePartyAction`
  (headless ticker deferred to M5). Battles **default to Manual for all
  characters**; the per-character AI script (`Off`/`DPS`/`Healer`) is selected
  in the Party menu and stored via `setAutobattle`. Full suite 408/408 green,
  `tsc --noEmit` clean.

Remaining Phase 4 milestones: M3 (speed controls), M4 (auto-advance + stop
dialog), M5 (headless ticker & leave/return), M6 (script DSL v2, later).

Full suite passes (`npm run test`, 408 tests) and `tsc --noEmit` is clean.


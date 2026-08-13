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

Remaining in Phase 2: **M5 minimal BattleScene**.


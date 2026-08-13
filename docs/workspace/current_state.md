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

Remaining in Phase 2: **M3 enemy AI scripts**, **M4 battle orchestration +
`BattleResult`**, **M5 minimal BattleScene**.


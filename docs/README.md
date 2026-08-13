# Game Design Wiki

> Working title: **_(TBD — see Open Questions in `roadmap.md`)_**

A web-based roguelike team-battler. The player curates a persistent roster of
characters (the "PC boxes"), equips a party with weapons, armor, and magic
skills, then sends them into an escalating gauntlet of turn-based battles.
Anyone knocked out in battle is lost forever; survivors keep their experience,
level up, and bring back money and drops.

Built with **HTML5 + TypeScript + Phaser 4 + Vite**. Designed to be
idle-friendly: a lot of time is spent on customization, then runs can be left
to autobattle (optional) while the player walks away and returns later.

---

## The core loop (at a glance)

```
Login
  │
  ▼
Review PC boxes ──► pick characters
  │
  ▼
Equip party (weapons / armor / magic skills)
  │
  ▼
Start a run ──► gauntlet of successive battles
  │              │
  │              ├─ KO'd characters are LOST FOREVER
  │              └─ survivors gain XP, level, find gear
  │
  ▼
Run ends ──► money + drops, back to the boxes
  │
  └─────────► recruit / build / repeat
```

---

## Design pillars

Every design decision should be checked against these six pillars.

1. **Curation & customization** — The boxes and the loadout screens are the
   "home base." Players spend most of their attention here. This is the fun
   they come back to.
2. **Permadeath stakes** — KO = gone. Loss must be meaningful but fair; runs
   must be survivable with smart play and good builds.
3. **Turn-based combat with RPG depth** — Classes, stats, skills, gear, and
   elemental/tactical interplay. Familiar to anyone who has played
   Pokémon/Pokerogue-style games, but with the option of full manual control.
4. **Roguelike gauntlet runs** — Battle after battle, escalating difficulty,
   randomized encounters and rewards, and an eventual win condition.
5. **Idle-friendly autobattle** — Manual play is the default; autobattle is an
   opt-in convenience, not a crutch. Player can leave and return safely.
6. **Persistent meta progression** — Money, drops, gear, and leveled
   characters accumulate across runs. The roster is the save game.

---

## Document map

| Doc | What it covers | Status |
| --- | --- | --- |
| [metagame.md](./metagame.md) | Login/accounts, PC boxes, party selection, currencies, meta progression | Draft |
| [party-and-equipment.md](./party-and-equipment.md) | Characters, classes, stats, gear, magic skills, builds | Draft |
| [combat.md](./combat.md) | CTB battle engine: timeline/queue, damage & heal formulas, statuses, permadeath, enemy AI, outcome contract | Spec |
| [workspace/phase-2-combat-plan.md](./workspace/phase-2-combat-plan.md) | Build plan for the Phase 2 combat engine (modules, data changes, milestones, test matrix) | Draft |
| [durability.md](./durability.md) | Permanent vs. expiring assets (the durability template) | Draft |
| [runs-and-gauntlet.md](./runs-and-gauntlet.md) | Run structure, roguelike loop, difficulty curve, rewards | Draft |
| [autobattle-and-idle.md](./autobattle-and-idle.md) | Autobattle AI, speed controls, leaving/returning, persistence | Draft |
| [architecture.md](./architecture.md) | Phaser 4 + TS + Vite, folder structure, state, saves | Draft |
| [data-model.md](./data-model.md) | TypeScript entity schemas for all core objects | Draft |
| [roadmap.md](./roadmap.md) | Build phases, milestones, open questions | Draft |

> **Note to the team:** the larger design wiki contains story/lore content
> only and will be imported later. Decisions are tracked in `roadmap.md`.

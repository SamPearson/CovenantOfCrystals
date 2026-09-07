# Skills

Character abilities.

> **Implementation status:** the reaction-capable model below (no reactionary
> type, `reactionTo` gates) is **live** M2 of `phase_4.5.2-scripting.md`.
> Passive skills are `SkillDef.type: 'passive'`, applied at battle start via
> `applyPassivesAtBattleStart` (they must be in the loadout). Passives ship as
> **percentage buffs** through the existing status machinery (e.g. Toughness =
> ×1.2 DEF; whole-battle = `duration: 999`), logged as decision #70.
> Reaction-capable seeds: `steal`, `guardians_vow`, `thorns`.

Skills are abilities that characters gain access to as they level up classes or use skill tomes.

## Kinds of skills

There are two kinds of skills:

- Passive Skills — always active, applied at the start of battle and lasting
  until it ends. Example: "Toughness" (+5 DEF).

- Active Skills — require the user to use their turn to activate. Most skills
  are active.

There is **no reactionary skill type**. Reacting to battle events is a
*capability* a skill opts into with **`reactionTo`** (see below) — not a
separate kind of skill. A skill is written once and, when the data says it can
react, it can be used from the character's **reactions sheet** in addition to
its normal use.

### Reaction-capable skills (`reactionTo`)

Any skill may declare, on its `SkillDef`, which **reaction gates** it is legal
in:

```
reactionTo?: EventPattern[]   // absent / empty = never usable as a reaction
```

An `EventPattern` is `{ kind, source?, target? }` — e.g. `{ kind: 'evaded',
source: 'enemy', target: 'self' }` means "reacts when an enemy's attack
against me misses". This is how a thief "steals in reaction to a missed
attack" is expressed: Steal → `reactionTo: [{ kind: 'evaded', source: 'enemy',
target: 'self' }]`.

See `character-scripting.md` (Reactions) for the event vocabulary and the
full authoring model.

# Skill Brainstorm

## Passive Skills

hp and defense boost

evasion boost

stat boost of various types

elemental defense/immunity

elemental damage bonuses on attack

status defense or immunity

status chance on attack

## Active Skills

elemental magic

cure spell

regen spell

attack

hamstring (damage enemy's CTB score)

buffs

debuffs

## Reaction-capable skills (seed ideas, via `reactionTo`)

thorns (gate: `attacked`, target self)

cover / Guardian's Vow (gate: `attacked` by an enemy, target any ally)

counterattack (gate: `attacked`, target self)

steal (gate: `evaded` against self)

For item reactions ("use potion when HP is low"), see `items.md`.
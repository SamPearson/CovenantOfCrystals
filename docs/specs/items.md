# Items

> **Implementation status:** the `reactionTo` model below is **live** M2:
> `ItemDef.reactionTo?: EventPattern[]` landed, and the health/greater-health
> potions carry `reactionTo: [{ kind: 'attacked' }, { kind: 'status-applied' }]`.
> The **Antidote** seed is deferred until the engine gains a cleanse `use`
> effect (roadmap #72).

There are many types of items:

- equipment
- skill scrolls
- skill tomes
- active use items
- stat shot items

Equipment provides passive stat boosts and other bonuses when equipped.

Skill scrolls can be expended to cast a skill one time.

Skill tomes can be expended to add a skill to a character's skill library.

Active use items are single use items that provide some kind of stat change.

Stat shot items increase a character's base stat level for one stat.

All characters can use skill scrolls or active use items in battle.

Skill tomes and stat shots can be used outside of battle, on the home/town
screen.

## Reaction use

Active use items and skill scrolls can be declared **reaction-capable** the
same way as skills: the `ItemDef` gains `reactionTo?: EventPattern[]`, with the
same rules — absent / empty = never usable as a reaction. Restricting items is
a balance tool, not just a convenience; scripted potions can otherwise out-heal
every fight.

Examples:

- **Potion** → `reactionTo: [{ kind: 'attacked' }, { kind: 'status-applied' }]` —
  with an `hp-pct < 30%` (or `has-status: poison`) condition this becomes the
  classic "emergency potion".
- **Antidote** → `reactionTo: [{ kind: 'status-applied', target: 'ally' }]`.

See `character-scripting.md` (Reactions) for the full model.
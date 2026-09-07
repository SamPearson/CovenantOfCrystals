# Character Scripting

Character battle actions can be scripted. A script tells a character what to
do on its own turn (the **turn rules**) and how to respond to battle events
taking place around it (the **reactions** sheet).

Scripts are authored with dropdowns and number fields — no typing code. The
player owns a **script library** in their profile and assigns a script to each
character. (The Phase 4 `dps` / `healer` presets ship as **built-in** scripts,
read-only until duplicated.)

## Script anatomy

A **script** has:

- **name**, an optional **description**, and an optional **art glyph** —
  cosmetic, player-editable
- a **root block** of turn rules (depth 0), which may contain **nested blocks**
- a **reactions** sheet
- a **fallback** — always evaluated last (see Execution)

The library is per-profile and **capped** (`SCRIPT_LIBRARY_CAP`, a
developer-configurable constant, default 50). Creation past the cap is refused
and the cap is shown in the UI ("4 / 50 scripts").

## Turn rules

A **rule** (script line) = **trigger** + **target** + **action**.

- **Trigger** — `1..3` condition clauses joined by `AND` / `OR`; omitted =
  always true. Each clause is a single condition: "Enemy Defense < 30",
  "Previous Trigger Target HP > 50%", "Weak to Fire", "has status: poison".
- **Target** — a target rule: a target kind plus an optional narrowing
  condition (`lowest-hp-enemy`, `highest-threat-enemy`, `any-ally` with
  `hp-pct < 30%`, ...).
- **Action** — a **skill selector** over the character's loadout skills or
  usable inventory items.

Rules are numbered `01..N` by their position in the block — **the number is
the priority**. Rules evaluate from the lowest number to the highest.

## Nested blocks

A block is a set of rules with an overall trigger. The script's root block is
the whole script; the player can nest a second layer of blocks inside it and a
third inside that — **no deeper**. A nested block only opens if its trigger is
true; its rules then run top-down and control returns to the enclosing block.
Nested blocks are what make branching tactics ("when my HP is low, run the
defensive set") possible.

## Execution

- Turn rules are walked top-down (lowest priority first); **the first rule
  whose trigger is true wins**, resolving its target and action.
- If a winning rule resolves to nothing (no valid target, no matching
  skill/item), the walk continues with the next rule.
- If no rule matches, the **fallback** runs.
- **Fallback** — a special final rule: trigger *always true*; it cannot be
  removed or reordered, but its target and action are player-configurable.
  Default: attack the enemy with the lowest health.
- When several skills/items match an action selector, one is **chosen at
  random** among the matches (seeded RNG — deterministic within a seed).

## Conditions

The condition vocabulary. All structured; the set is extensible by additive
PRs.

- `always` / `never`
- `hp-pct`, `mp-pct` — scope, op, value (percent of max)
- `stat-compare` — scope, stat, op, value (flat, or % of base when
  `ofCurrent`), e.g. "Enemy Defense < 30 DEF", "Self MP < 30%"
- `has-status` — scope, status, present
- `weak-to` — scope, element (e.g. "Weak to Fire")
- `enemy-rank` — scope, ranks, present (e.g. "is Elite OR Boss")
- `ally-count`, `enemy-count`, `turn-count`, `turn-mod`
- `cooldown-ready` (skillId), `can-cast` (skillId?), `has-item` (itemId)
- `and` / `or` / `not`

**Scopes:**

- `self`, `any-ally`, `all-allies`, `lowest-hp-ally`, `highest-hp-ally`
- `any-enemy`, `all-enemies`, `lowest-hp-enemy`, `highest-hp-enemy`
- `attacker`, `trigger-target`, `previous-trigger-target` — event-relative,
  only meaningful inside a reaction (see Reactions)

## Targets

`self`, `lowest` / `highest` / `random` ally and enemy, `all-allies`,
`all-enemies`, `highest-threat-enemy`, and the event-relative `attacker`,
`trigger-target`, `previous-trigger-target`.

## Skill selectors (actions)

A list of filters, all of which must match (ANDed):

- `byId` — a specific skill
- `byElement` — e.g. any Fire spell
- `byKind` — heal / damage / buff / debuff / utility ("Any Attack Skill")
- `byTag` — e.g. `['heal', 'aoe']`
- `byMpCost` — absolute, or % of current MP
- `byCooldownReady`
- `byCastDelay`, `byPower`

The selector's **source** is either `skills` (the character's **loadout**) or
`items` (the character's usable inventory — potions, scrolls, active-use
items). Scripts can express "if any ally HP < 30% and I have a health potion,
use it". Using an item via a script consumes it, the same as manual use.

## Reactions

The **reactions sheet** is a list of **reaction rules** that respond to battle
events: being attacked, evading an attack, an ally being KO'd, a status
landing or clearing, an enemy casting, a turn starting or ending. Reactions are
**always active** — they fire in both AUTO and MANUAL mode; the AUTO/MANUAL
toggle only governs turn actions.

Each reaction rule:

- **gate** — the `EventPattern` it reacts to: kind + optional source/target
  filters. E.g. "an enemy attacks any party member" or "an enemy attacks me
  and misses".
- **conditions** (optional) — extra filters, evaluated in the event context
  (may reference `attacker`, `trigger-target`, ...).
- **target** — may reference the event's `attacker` / `trigger-target`.
- **action** — a skill selector, same shape as turn actions; may be an item.
- **delay** — the CTB cost of the reaction, overriding the action's own delay.
  `0` = instant (resolves inline). Defaults to the action's `delay`.

All reactions whose gate and conditions hold at an event fire, **in sheet
order**, queued into the timeline at their delay.

### Event vocabulary

```
attacked, evaded, ally-kod, status-applied, status-removed,
enemy-casts, turn-start, turn-end
```

An `EventPattern` is `{ kind, source?: ActorFilter, target?: ActorFilter }`
with `ActorFilter` = `'self' | 'ally' | 'enemy'`. Omitted filters match any
actor. E.g. `{ kind: 'attacked', source: 'enemy', target: 'ally' }` = "an enemy
attacks any party member".

### Who may react to what: `reactionTo`

Each skill and item declares which gates it is legal in:

- `SkillDef.reactionTo?: EventPattern[]` — the gates a skill may be used in;
  absent / empty = **the skill can never be used as a reaction**.
- `ItemDef.reactionTo?: EventPattern[]` — the same rule for items (potions,
  scrolls, active-use items).

The gate is the designer's **balance lever**; the conditions within a gate are
the player's tactical freedom. Examples:

- **Steal** → `reactionTo: [{ kind: 'evaded', source: 'enemy', target:
  'self' }]` — a thief can only steal when an enemy's attack misses them.
- **Guardian's Vow** → `reactionTo: [{ kind: 'attacked', source: 'enemy',
  target: 'ally' }]` — enables "when an enemy attacks any party member, attack
  them".
- **Potion** → `reactionTo: [{ kind: 'attacked' }, { kind: 'status-applied'
  }]` — potions react to being hit or catching a status (paired with an
  `hp-pct` / `has-status` condition for the classic "emergency potion").

Enforced in three layers: the editor only offers skills/items whose
`reactionTo` permits the chosen gate (`reactionTo` is matched against the
event's kind and source/target); the store refuses illegal combinations when
the script is saved; the interpreter re-validates at runtime as a backstop.

## Reacting to a "missed attack"

When a character is attacked and the attack misses, an `evaded` event fires.
Reaction rules gated on `evaded` (source enemy, target self) run then — this is
how "steal in reaction to a missed attack" is built. It arrives as data, not as
a new skill type.

## Authoring UX

Structured only; no raw text DSL in v1. The UI prototype
(`docs/script_window_template/template_002`) is the visual reference:
grimoire-styled editor with a script library (create / duplicate / delete /
read-only built-ins), per-rule numbered priorities, a collapsible rule editor
(condition rows joined by AND/OR chips, a target card, an action picker), and
the locked **∞ fallback**. Editing is **live** — a character using the edited
script picks up changes on the next turn; the editor's "Save" button is a
commit-on-exit affordance, not a separate assign step.
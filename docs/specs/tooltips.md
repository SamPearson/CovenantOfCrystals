# Tooltips

> **Implementation status:** planning. This is the final MVP feature before the
> economy/balance phase. No tooltip rendering exists yet.

## Goal

The player must always be able to see what any thing — item, weapon, armor,
skill, or status effect — is or does, by hovering over it. "Always" means in
every menu that renders one of these things:

- **shop** (for-sale items, gear for sale)
- **boxes** (character cards; the gear freelancers are wearing)
- **party** (character cards)
- **character detail** (gear rows, stat rows, learned/loadout skills)
- **equip** (slot pickers, owned gear)
- **battle** (skill buttons, item buttons in the action bar; passive/active
  skill tiles on actor cards)
- **recruitment** (offered character, learned skills)
- **rewards / level-up** (tome & scroll grants)
- **inventory** (consumables, stat shots, scrolls/tomes)

Tooltips are non-authoritative summaries. The engine (not the UI) remains the
source of truth for what a thing actually does; a tooltip must never be able to
lie about a number (cost, heal amount, stat delta). Where a value is derived
(damage dealt, heal strength), the tooltip shows the **derived value computed
from the owning character's current stats**, mirroring the engine formula, or —
where that would be misleading — the **base inputs** with a clear element/scaling
label.

## Design core: a single data model

Every thing that needs a tooltip already has a structured definition:

- items: `ItemDef` (src/core/types.ts) — `type`, `rarity`, `statBonus`,
  `boostStat`, `grantsSkill`, `castSkill`, `grantsSkillWhenEquipped`, `use`,
  `reactionTo`, `value`
- skills: `SkillDef` — `kind`, `element`, `power`, `scaling`, `targets`, `cost`,
  `cooldown`, `effect`, `type` (`'active'|'passive'`), `reactionTo`, `tags`
- status effects: `StatusEffect` — `kind`, `stat`, `power`, `duration`
- characters (for derived values): `Character` — gear, statBonus, level, mp pool

Tooltip content is **generated** from these defs, never hand-authored prose per
item/skill. This keeps the ~60 skills and ~40 items (plus every auto-generated
scroll/tome) covered without a bespoke string per entry, and guarantees a
tooltip can't drift from the data it describes.

The generator lives in a **pure, Phaser-free module** next to `format.ts` so it
is unit-testable and reusable by every panel:

`src/core/tooltips.ts` — exports `describeItem` / `describeSkill` /
`describeStatusEffect` returning a typed line list (see below).

## Data flow

A tooltip is two things:

1. a **source** — the thing being described (an `ItemDef`, `SkillDef`, or
   `StatusEffect`), plus optional **context** the description needs
   (e.g. the owning `Character` for derived damage numbers; the gear itemId for
   a granted skill).
2. a **connection** — which DOM/`(x,y)`/left edge, which metadata type.

Single renderer (`makeTooltip` in src/game/ui/tooltip.ts) takes a
**description payload** and draws it once; it does not know about items/skills
at all. All domain knowledge lives in the description generator.

## Content model

`describeItem(item: ItemDef, ctx?)` returns `TooltipLine[]`, where

```ts
type Line =
  | { kind: 'title', text: string, flare?: 'rarity' }
  | { kind: 'subtitle', text: string }
  | { kind: 'stat', key: StatKey, delta: number }        // colored stat line
  | { kind: 'effect', text: string }                     // e.g. heal/use/cast lines
  | { kind: 'label', text: string, tone: Tone }          // badges e.g. 'RARE' rarity chip
  | { kind: 'divider' }
  | { kind: 'desc', text: string }                       // body / plain line
  | { kind: 'source', text: string }                     // 'Loot: dungeon' etc.
```

`describeSkill(skill: SkillDef, owner?: Character, ownerResources?: {mp:number})`
returns the same. `Role`/`Tone` types come from THEME.tones and THEME.colors so
the pure module stays importable without Phaser — see "Tone/coloring" below.

### Items

Order and content depend on `type`:

- **title**: `name`; if the item is equipped, append the equipped character
  (e.g. `Staaf of Embers` + subtitle `wood · pistol · you`).
- **rarity chip**: `rarity` rendered as a labeled chip (stat shot items: no
  chip; they are not rarity-tiered). Use `RARITY_COLOR[rarity]`.
- **type subtitle**: `itemTypeLabel(type)` (e.g. `Weapon`, `Armor`,
  `Consumable`, `Skill scroll`, `Stat shot`).
- equipment (`statBonus`, `grantsSkillWhenEquipped`):
  - one `stat` line per bonus key from `statList`/`statDeltaText`
  - element line for element-tagged gear where relevant
  - if `grantsSkillWhenEquipped` → line `Grants <skill name> while equipped`,
    then inline the granted skill's short form (see Skills).
- consumables / scrolls (`use` | `castSkill`):
  - if `use.healHp` → `Heals <N> HP`; if `use.healMp` → `Restores <N> MP`
  - if `castSkill` → `Casts <skill name>` + the skill's short form (cast at
    current owner stats if in battle)
  - if `reactionTo` present → a `Reaction` line listing trigger(s), e.g.
    `Reacts: when attacked, when a status is applied`.
- tomes (`grantsSkill`) → `Teaches <skill name> (permanent)` + skill short form;
  note tomes grant a skill, scrolls cast one.
- stat shots (`boostStat`) → `Increases base <stat> by <N>` (uses
  `statDeltaText`), subtitle `Stat shot`; this is core to the "always clear"
  goal — stat shots were previously opaque.
- `misc` → no special rendering beyond title/desc.

**Derived values:** for potions, heal amounts are the raw `use.healHp`
constant — fine as-is. For skills granted/cast by gear, the skill's derived
damage is **not** shown from the item tooltip (no owner context); the item
tooltip shows the skill's base inputs (element, scaling, target) and defers the
derived number to the skill's own tooltip when the player hovers the skill
itself in battle / character detail.

### Skills

Order and content (active vs passive differ):

- **title**: `name`
- alive chip if today, see below.
- **type line**: `kind` — `damage/heal/buff/debuff/utility` — plus `active` or
  `passive`. Use labels from skill tags (tags carry kind + element + aoe +
  effect.kind already; see `tag()` in skills.ts). Render e.g.
  `damage · fire · single-target` or `buff · frost · all allies`.
- **element line**: `elementLabel(element)`, skipped when `element === 'none'`
  (elementless skills have no element line).
- **resource line (active only)**:
  - `MP <cost>` — this is the missing capability in the battle action bar today
    where skill buttons show only `skill.name` and affordability.
- **cooldown (active only)**: when `cooldown` present, `Cooldown <N>` 
  (turns/battles per BALANCE). no text when absent.
- **effect line** (from `effect`): e.g. `Applies Poison (power 5, 3 turns)` for
  debuffs, `Def +30%` for statBuff, etc. `describeStatusEffect` handles the
  formatting.
- **target line**: derived from `targets` — `Single target`, `All allies`,
  `All enemies`, `Self`. Both damage and buff/debuff show targets.
- **derived damage/heal** (active, `power`/`scaling`, owner provided):
  - damage kind: `Deals ~<N> <element> damage to <target>` where `N` is the
    derived value at owner's current stats (mirroring `physicalDamage` /
    `magicalDamage` / healMagic in src/core/combat/damage.ts). If no owner is
    provided, use base inputs: `Damage: <power> (<scaling> scaling)`.
  - heal kind: `Heals ~<N> to <target>` or at owner stats.
  - buff/debuff: `Applies <effect>` (uses the effect line; no derived number —
    power on a buff is a multiplier, shown by the effect line, not a damage
    number).
- **reaction (active)**: when `reactionTo` present → `Reacts: <pattern list>`.
- **passives**: no cost/cooldown/target lines from the skill (they're
  `'passive'`); just `Passive: <effect>` (e.g. `Fortress: Def +30% while held`).
  Passives are the ones that were previously opaque in character detail; this
  is a priority.

**Derived damage mirroring** (single source of truth): the generator calls the
same functions the engine does (`finalizeDamage`, `healMagic`, etc.) with
`owner` stats + element-neutral params, so the number shown matches roughly
what the char would deal, and — critically — cannot drift from the engine.

### Status effects

`describeStatusEffect(effect: StatusEffect)` → title = short name derived from
`kind` (e.g. Poison, Burn, Regen), then `effect` line:
- statBuff/statDebuff: `<Stat> +<pct>%` / `<Stat> -<pct>%` (round; e.g.
  `Def +30%`)
- burn/poison/regen: `deals <power> <element> per turn for <duration>` /
  `heals <power> per turn for <duration>`
- shield/taunt/stun/blind/freeze/sleep: short one-line description
- always show `duration` as `for <N> turns`.

## Description sources

Where tooltips pull data:

- items: `ITEMS[itemId]` from src/core/data/items.ts (incl. auto SKILL_SCROLLS/
  SKILL_TOMES).
- skills: `SKILLS[skillId]` from src/core/data/skills.ts.
- granted skills on gear: `grantsSkillWhenEquipped` → `SKILLS[...]`.
- a character's current derived stats: `Character` (base + `statBonus` + gear
  `statBonus`), plus mp pool for affordability coloring.
- reaction patterns: read from `reactionTo` array.

## Rendering

One stateless renderer: `makeTooltip(scene, parent, x, y, payload, opts)`.

- Round scalloped panel like `makePanel`, raised border, `depth` above the
  panel that triggered it, `setDepth` on the tooltip container (Phaser depth is
  global per scene; set it above UI content, e.g. `DEPTHS.tooltip`, defined
  alongside the action bar / overlay depths).
- Title uses the display font + title size; body uses md + sm lines.
- Lines render top-down from the typed `TooltipLine[]`; measure widths so the
  widest line sets the box width; max-width cap (long descriptions wrap).
- Optional **side** (left/right of the trigger) or **top/bottom** placement,
  flipping to keep on-screen within the camera bounds; single shared instance,
  repositioned (no create/destroy spam) wherever possible, though re-creating
  is acceptable per-phase (perf is fine at this scale).

### Tone / coloring

`Tone` and rarity colors come from `THEME.colors` (and `THEME.tones` where
used):

- rarity chip: map `Rarity` → a color. `RARITY_COLOR` lives with the tooltip
  module; `legendary` = bright/fiery, `epic` = purple, `rare` = blue,
  `common` = muted. Used by equip/boxes/shop/party for gear name color already
  — reuse the same mapping so colors agree.
- stat lines: positive `+` uses `good`, negative `-` uses `warn`.
- element tags: reuse existing element→color mapping if present in THEME else
  default to a single accent.
- mp-affordability: resource line for a skill a character can't afford tints
  `warn`.

## Delivery of the content (per-screen)

### Tooltip panel helper

New `src/game/ui/tooltip.ts` exporting `makeTooltip` and the placement helper.
`BALANCE`-independent. Reused by every panel.

### Character card summaries (boxes, party, recruitment)

Character cards get their tooltip from the underlying `Character`:
- title: name, class
- stat list, innate skill names, durability, mp affording.

### Equipped gear ("what am I wearing")

In boxes / character detail / recruit, gear rows already show `name`;
tooltip shows the gear ItemDef's effect tooltip (as a "what it does" summary —
stat lines + any granted skill), marked with the owner.

### Battle action bar

Skill buttons: hover → `describeSkill` tooltip with owner character + mp, so the
player sees **cost and effect** before committing — the headline missing
capability today.

Item buttons in the action bar (`Item` submenu): hover → item tooltip (heal/cast
amount, what it does). The item tooltip's `castSkill` shows the skill inline.

### Battleboard actor cards

Passive tiles and active skill tiles on cards: hover → skill tooltip. If screen
space is tight (cards are ~src/game/ui/small), the tooltip can flip to the
inside; acceptable.

### Rewards / level-up (tomes, scrolls)

When granting a tome, the hover already maps over member skills; attach the
skill tooltip to each skill tile in that overlay, and to the granting scroll/
tome icon itself.

### Stat shots in shop / inventory

`describeItem` handles via `boostStat` → `Increases base <stat> by <N>`. This is
specifically the previously-opaque case the user flagged and is coverage here.

## Battle-tooltip specifics for skills (actions)

Derived damage shown in battle:
- damage kind, owner provided: `Deals ~<N> damage to <target>` where N =
  `finalizeDamage(...)`-style compute using owner's current atk/mag/def/res.
- If owner has no target for `aoe` skills, show `<target>` generically.
- When affordable vs not: color the resource line.

## Not in scope (deferred)

- **Mouse-follow placement** on drag (only hover placement).
- **Reduced/cleared tooltips** blocking underlying clicks — no; tooltips never
  intercept input except a thin pass-through invisible hit rect is allowable if
  needed for hover-out.
- Multi-line **rich text** (images/art in tooltips). Single text lines only.
- Tooltips for damage floats or combat log entries.

## How to test

- Unit-test `describeItem` / `describeSkill` / `describeStatusEffect` in
  src/core (pure, deterministic) — assert exact line strings for a few
  representative defs each: a weapon, an armor, a potion, a scroll, a tome, a
  stat shot, a gear-granted skill, an active damage skill, a passive, a status
  effect. Assert no line can reference a hidden value (e.g. that a buff
  multiplier is shown, not a fake "damage").
- Golden-file or snapshot a few tooltip render payloads.
- Manual: hover every interactive thing across shop, boxes, party, equip,
  character detail, recruitment, rewards, battlebar — confirm no case leaves a
  number or effect unrevealed and none misstate a derived value.

## Open questions

1. **Derived damage**: should battle skill tooltips show a *range* (`~40–52`)
   instead of a single middle value? The engine has `varianceFactor`; a range
   is closer to "what it does" without being wrong. Recommend range using the
   engine variance range.
2. **Element color reuse**: THEME currently stores an element→color map for
   battle particles? If not, define one and use it for element chips across
   tooltips + battle tags so colors agree everywhere.
3. **Hover delay**: a short (~150–250ms) delay before showing a tooltip
   reduces the "spray" of tooltips when dragging the mouse across a panel; but
   it adds latency. Recommend a small built-in delay in `makeTooltip`
   (configurable, default ~150ms) with instant show on touch/pointerdown.
4. **Position of rerender on scroll**: scroll-region content is drawn into a
   DynamicTexture and non-interactive (see makeScrollRegion) — so hover over
   scrollable lists (boxes detail, character detail, shop list) can't register
   on the content children directly. **Recommendation:** place one invisible
   full-bounds hit rect in the *live* region container (sibling of the thumb),
   track pointer position, and re-derive the hovered row by y-offset from
   `setContentHeight` + current `scrollY`. This is the one structural bit of
   new work; it's isolated inside the tooltip integration so it doesn't touch
   the scroll region's scroll logic. See "Scroll hit layer" below.

## Scroll hit layer (the one structural change)

`makeScrollRegion` returns only `{ container, content, setContentHeight,
destroy }`. To let a tooltip (or any future hover affordance) respond inside a
scroll region, extend it minimally:

- add an on-demand **hit layer**: a transparent rect in `container` (live, not
  in `content`) sized to the viewport, made interactive, whose `pointermove` /
  `pointerout` events report `(y, contentOffset)`. It does **not** intercept
  wheel/drag (the bg already owns those), only reports hover coords for the
  tooltip layer to consume.
- expose the computed `scrollY` (via a getter, not a full state API) so a
  consumer can map pointer y → content row.

This keeps the scroll region's own input handling intact (bg still owns
wheel/drag) while giving tooltips a live coordinate source. It's the only new
piece needed across all the scroll-based panels.

## Layering / depth

Define `const DEPTHS` (tooltip) so the tooltip always sits above any panel,
scroll region image, and overlay. Reuse/reposition a single tooltip where
possible; the depth constant is the pytest that "tooltip is above".

## Acceptance

- [ ] Every interactive item/skill/stat-short shown in any menu reveals a
  tooltip with: name, type, and effect (stat base / heal amount / cast or grant
  behavior / stat-shot delta / skill cost + effect).
- [ ] Skill tooltips in battle show MP cost and effect; unaffordable costs are
  tinted.
- [ ] Passive skills show their passive effect (previously opaque).
- [ ] Rarity colors on gear match the existing equip/boxes color mapping.
- [ ] Derived damage/heal uses the engine's own functions (no duplicated
  formula that can drift).
- [ ] Content on scroll-region lists (boxes detail, character detail, shop) is
  hoverable via the scroll hit layer.
- [ ] All describe functions unit-tested; no tooltip references an unrevealed
  number.
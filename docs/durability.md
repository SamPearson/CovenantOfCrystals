# Durability: Permanent vs. Expiring Assets

A single template that applies to everything a player owns. Every asset is
either **permanent** or **expiring after a limited number of runs**.

## 1. The template

```
Durability =
  | { kind: 'permanent' }                 // owned forever
  | { kind: 'expires', runsRemaining: n } // gone after n more runs
```

- **Permanent** — stays until sold, given away, or lost to permadeath.
- **Expiring** — a "rental". Buy a very strong character or piece of equipment
  for cheap, but it only lasts a few runs.

This template is **widely applicable**: characters, weapons, armor, and
(later) any item or boon should all expose the same durability shape.

## 2. What it applies to

| Asset | Applies? | Notes |
| --- | --- | --- |
| Characters | Yes | Recruitment NPC can sell permanent or expiring characters |
| Weapons / armor / accessories | Yes | Drops and shop gear can be permanent or expiring |
| Consumables (potions, tomes) | No — used up on use | Consumables are consumed; durability is moot |
| Skills / tomes | Maybe later | Learn-once skills are permanent by nature |

## 3. Counting runs

- **A run counter decrements only through use:**
  - Character: included in the party at run start.
  - Equipment: equipped on a character who goes on the run.
- Assets sitting in a box or inventory do **not** tick down. Expiry only
  happens by bringing an asset on a run.
- At **run resolution** (run end), every participating asset with
  `runsRemaining` decrements; anything that hits 0 is removed.
- Edge case: an asset on its last run is usable for the entire run; it
  disappears when the run ends (win, wipe, or abandon).

## 4. Interaction with permadeath

**Gear is not destroyed by a character's death.** When a character dies, its
gear returns to inventory **unless** the gear was already due to expire at the
end of the current run.

| Gear durability | On character death |
| --- | --- |
| Permanent | Returns to inventory |
| Expiring, runsRemaining > 1 | Returns to inventory (keeps counting down through use) |
| Expiring, runsRemaining = 1 | Gone — consumed by the run anyway |

An **expiring character** that dies is dead like anyone else — no refund, no
early-expiry adjustment. Death is death.

## 5. UI & selling

- Show durability on every owned asset: a "Permanent" badge, or "N runs left".
- Expiring assets should sell for less than permanent ones (or not be
  sellable) — tune in the balance pass (`roadmap.md` Phase 5).

## 6. Why this matters

- **Economy lever:** two purchase tiers (cheap rentals vs. permanent
  investments) create a gold sink and keep the meta moving without pay-to-win
  (gold is earned in-game).
- **Roster churn:** expiring characters keep the boxes from becoming a static
  collection and push players to keep recruiting.
- **Risk texture:** an expiring high-value character on its last run changes
  how carefully you play the next run.

## 7. Data model

```ts
type Durability =
  | { kind: 'permanent' }
  | { kind: 'expires'; runsRemaining: number };
```

Applied on `Character` and on gear instances in the inventory
(`data-model.md` §1, §2, §4).

---

## Open questions (remaining)

1. Can expiring assets be sold mid-life, and for what? (Balance detail.)
2. Pricing curve: how much cheaper should expiring assets be? (Phase 5.)

Decision log: `roadmap.md`.

# Meta-Game: Accounts, Boxes, Currency, Progression

This doc covers everything that exists *outside* a run: the persistent world
the player curates between battles.

---

## 1. Login / accounts

**Pillar connection:** the roster is the save game, so identity matters.

**Decision (locked):** the full game will use a real API backend. Data flows
through **three stages**:
1. **Hardcoded JSON blobs** now — maximum flexibility while exploring the
   design; no server, no service layer.
2. **Mock API** — when things need to be created dynamically (recruitment,
   shops, generated runs), a mock API stands in and makes it look real.
3. **Real API** — swap the mock for the backend behind the same interface.
- Keep the save/load layer behind an interface so the real backend (REST +
  JWT, cloud saves) can replace the mock without reworking game logic.
- Demo accounts: pick/create a local profile name; save via
  localStorage/IndexedDB.
- See `architecture.md` → "Login / backend".

---

## 2. PC boxes (the roster)

The character collection. Roughly Pokemon-storage-shaped: tabs of boxes, each
box holding characters not currently in a party.

**Requirements from the pitch:**
- Review characters across boxes to decide who goes on a run.
- Characters persist between runs; they leave only via **permadeath** (run
  death) or **durability expiry** — see `durability.md`.

**Design elements:**
- **Boxes (locked):** **10 boxes of 30 slots** (300 total) — arbitrarily high
  but not infinite.
- **Box operations:** move between boxes, sort (level, class, name), filter
  (class, level range, gear status).
- **Character info surfaced:** class, level, XP, stats, gear, equipped skills,
  durability badge, last-used run, total wins/losses.
- **Recruitment (locked):** between runs, the player visits an **NPC /
  recruitment menu** and **pays gold to recruit randomly generated
  characters**. Recruitment is between-runs only — no mid-run replacements.
  - Recruited characters may be **permanent or expiring** (cheaper = expires
    after N runs) — `durability.md`.

**Open questions:**
- Box capacity — unlimited, or a cost/expansion mechanic?
- Does the player get to keep duplicate characters/classes? (Likely yes — it's
  a roguelike, you want a "talent pool".)

---

## 3. Party selection

- **Party size (locked):** **4** characters max.
- Pick from boxes → build a party for the next run.
- A party is committed when a run starts; it cannot be changed mid-run.
- **Open question:** are there synergies/bonuses for specific class
  combinations (e.g., tank + healer bonus)? (Nice-to-have, see roadmap.)

---

## 4. Equipment

Full detail lives in `party-and-equipment.md`. At the meta level:

- **Weapons:** one slot. Stat/role-defining.
- **Armor:** one slot. Defense/HP-defining.
- **Accessories:** **not in v1 (locked)** — no third slot.
- **Magic skills:** learned/equipped (a limited loadout), not a physical slot.
- Gear is owned per-character **and** stored in a shared inventory (drops go
  to inventory; equipping binds them to a character for the run).
- **Durability:** any piece of gear is permanent or expiring — see
  `durability.md`.
- **Gear on death (locked):** gear is **not** destroyed by a character's
  death — it returns to inventory, unless it was already due to expire at the
  end of the current run (`durability.md` §4).

---

## 5. Currency & loot

Two distinct reward streams (keep them separate in the data model):

| Currency | Earned from | Spends on |
| --- | --- | --- |
| **Gold / money** | Successful runs, some battles | Recruiting (NPC), healing items, shop purchases, box expansion |
| **Drops / items** | Battles, run rewards, elite/boss drops | Equipping directly, selling for gold, crafting (later) |

- Drops include gear, consumables (potions, heal items), and skill tomes.
  (Revive items do not exist — see `combat.md` §4.)
- Any drop can be **permanent or expiring** per the durability template
  (`durability.md`).
- **Single currency (locked):** just **gold**. No premium/third currency.

---

## 6. Meta progression (outside runs)

What the player keeps and grows over time:

- **Characters:** XP, levels, learned skills, gear carried out of a run
  (permanent ones; expiring ones keep counting down).
- **Currency:** gold balance.
- **Inventory:** unequipped drops.
- **Unlocks:** new classes, box slots, run difficulties, maybe a passive
  player-level/account-level (bonus drop rates, etc.).

**What does NOT persist across runs:** the run itself (see
`runs-and-gauntlet.md`), consumables used, temporary run modifiers.

---

## Open questions (remaining)

1. Duplicates of the same class in a box (talent pool)? (Likely yes.)
2. Party composition synergies/bonuses (tank + healer, etc.)? (Nice-to-have.)

Decision log: `roadmap.md`.

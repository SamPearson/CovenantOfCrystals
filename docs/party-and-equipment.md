# Party & Equipment: Characters, Classes, Stats, Gear, Skills

This doc defines the *unit* of the game: the character you raise, equip, and
risk on a run.

---

## 1. Character model

A character is an instance of a **class** plus accumulated progression.

```
Character
├── identity   : id, name, classId
├── level      : current level, xp, xp-to-next
├── stats      : HP / ATK / DEF / SPD / MAG / RES (see §3)
├── gear       : weapon, armor (no accessory in v1)
└── skills     : learned set + active loadout (see §5)
```

**Names (locked):** names are **auto-generated** (from a name generator) but
**player-editable**.

---

## 2. Classes (archetypes)

Roguelike role archetypes, not Pokédex species. Each class has:

- Base stat distribution (growth profile).
- A signature mechanic or passive.
- Access to a subset of skills.
- A distinct look for the battle scene.

Suggested starter roster (expand later):

| Class | Role | Base focus | Signature idea |
| --- | --- | --- | --- |
| Knight | Tank | High HP/DEF, low SPD | Taunt / damage reduction |
| Berserker | Melee DPS | High ATK, low RES | Risk-reward damage |
| Rogue | Physical burst | High SPD/ATK | Crits, poisons |
| Ranger | Ranged DPS | Balanced | Multi-hit / elemental shots |
| Mage | Magic burst | High MAG, low HP | Nukes, AoE |
| Healer | Support | High RES | Heals, cleanses |
| Bard | Buffer/Control | Balanced | Buffs, debuffs, speed control |

**Class change (locked):** **no** class-change system. A class is fixed for
life, and classes stay simple — this is deliberate for v1 (see `roadmap.md`).

---

## 3. Stats

Keep the classic six, tuned later by data:

- **HP** — health; 0 HP = knocked out.
- **ATK** — physical damage scaling.
- **DEF** — physical damage reduction.
- **MAG** — magic skill damage scaling.
- **RES** — magic damage reduction / heal power.
- **SPD** — turn order priority.

Derived stats (computed, not stored): crit chance, dodge, accuracy, turn
speed (from SPD). Growth comes from level-ups plus gear; see `combat.md` for
how stats feed formulas.

---

## 4. Equipment

| Slot | Effect direction | Examples |
| --- | --- | --- |
| **Weapon** | Primary stat/role push | Sword (+ATK), Staff (+MAG, +heal), Bow (+SPD, +crit) |
| **Armor** | Defense/survivability | Plate (+DEF), Robe (+RES, +HP), Leather (+SPD, +dodge) |

Accessory slot: **not in v1 (locked)** — no third slot for now.

- **Tier/rarity:** e.g., Common → Rare → Epic → Legendary. Drives the loot
  economy (see `metagame.md`).
- **Enchanting/upgrading** gear is a later-system candidate (see roadmap).
- **Weapon scaling note:** a weapon should matter to the *class* that uses it —
  a Berserker with a staff is a wasted run.
- **Durability:** every piece of gear is **permanent or expiring** (expires
  after N runs) — see `durability.md`.

---

## 5. Magic skills

- Characters **learn** skills (level-ups, tomes from drops) and **equip** a
  limited loadout — classic Pokémon-style moveset, which keeps each battle a
  decision.
- **Loadout size (locked):** **4** active skill slots for now — but this is a
  **data-driven parameter** (`ClassDef.loadoutSize`) that can be tuned per
  class without code changes.
- Skill taxonomy:
  - **Damage skills** — physical or magical, single-target or AoE, elemental.
  - **Healing / cleanse.**
  - **Buffs / debuffs** — ATK up, DEF down, speed control, taunts, shields.
  - **Utility** — dispel, dodge-up, etc. (No revive skills — see `combat.md`.)
- **Elements (locked):** an elemental system with a **weakness/resistance
  chart** is in v1 — e.g., Fire / Water / Frost / Earth / Holy / Shadow.
  This drives build choice, enemy scouting, and the "looter" reward loop.
- Skill data is data-driven (see `data-model.md` / `architecture.md`).

---

## 6. Builds & synergies

The "curation" pillar lives here: a party is a *composition*.

- Roles should be legible: a healer is clearly a healer.
- Party synergies (passives that trigger on composition) are a later
  nice-to-have.
- Autobattle AI reads a character's role to make sensible choices — see
  `autobattle-and-idle.md`.

---

## Open questions (remaining)

None — party/equipment-scope questions are resolved. Skill and class data
(element chart, learn sets, gear numbers) is tuned in the Phase 5 data pass.

Decision log: `roadmap.md`.

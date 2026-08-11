# Combat: Turn-Based Rules, Permadeath, Enemy AI

The heart of the game. Turn-based team combat, Pokerogue-style in feel:
both sides act on a speed-ordered turn, knockouts are final.

---

## 1. Battle format

- **Sides:** player's active party vs. an enemy squad (1–N enemies).
- **Active party (locked):** all chosen party members fight in every battle.
  **No mid-battle rotation/bench.**
- **Turn order:** computed from SPD (+ item/skill modifiers), refreshed each
  round, classic JRPG style.
- **Rounds:** within a round, every combatant acts once in order
  (speed ties resolved by a stable rule, e.g., faction priority then ID).

---

## 2. Actions per turn

A combatant's turn offers:

- **Attack** — basic weapon attack (ATK vs. DEF).
- **Skill** — spend MP/cooldown on an equipped skill (MAG or ATK scaling).
- **Item** — use a consumable (potions, buff items, etc.).
- **Defend** — reduce incoming damage until next turn (or guard a target).
- **Escape / run check** — attempt to flee (gauntlet context: see §6).

**Resource:** MP (or equivalent) shared across skills. **MP regenerates at
rest nodes only (locked)** — no regen between battles. (Rest nodes occur every
5 battles — see `runs-and-gauntlet.md` §1.)

---

## 3. Damage model (placeholder — tune by data)

```
physical:  damage = base × (ATK_eff / DEF_eff) × multiplier × crit
magical:   damage = base × (MAG_eff / RES_eff) × multiplier × crit
crit:      chance from SPD/gear/class, default ~1.5× (Rogue higher)

multiplier = element chart (weak/resist multipliers) × buff/debuff stack ×
             defend/guard modifier × random variance (e.g., 0.9–1.1)
```

Exact constants belong in a **balance spreadsheet/data file**, not in code.
Formulas should be written once in a pure module and unit-tested.

---

## 4. Status, buffs & debuffs

- **Buffs/debuffs:** stackable modifiers to stats, with duration in turns
  (ATK↑, DEF↓, SPD↓, poison, burn, blind, taunt, shields, regen…).
- **Crowd control:** stun/sleep/freeze (lose a turn) — keep rare and telegraphed.
- **No revives:** there is no revive effect, item, or skill. A KO is final
  (see §5).

---

## 5. Knockout & permadeath (THE core rule)

**Locked rules:**

1. **KO state:** HP reaches 0 → the character is KO'd and can't act.
2. **Permadeath:** the moment a battle ends, every character that is KO'd is
   **permanently dead. No recovery from death.** They are removed from the
   party immediately; the run continues with the survivors.
3. **No revives** — nothing in the game brings a character back.
4. **Full wipe:** if the whole active party is KO'd, the run **ends
   immediately**. The player ends with **0 characters in their party** and
   returns to the PC boxes to pull more, or to the recruitment NPC to buy
   more (`metagame.md` §2).
5. Survivors keep their XP, levels, and gear earned this run — and carry them
   home even if the run later fails.
6. **No mid-run recruitment:** lost members are not replaced until the next
   run — the party fights shorthanded (`runs-and-gauntlet.md`).
7. **Gear on death:** gear is not destroyed by permadeath; it returns to
   inventory unless it was already due to expire this run (`durability.md` §4).

---

## 6. Enemy AI

- **Minion AI:** simple priority heuristics (attack lowest-HP target, use
  strongest available skill, occasional self-buff).
- **Elite/Boss AI:** scripted patterns or weighted action pools (e.g., turn 1
  shield, then big AoE every 3rd turn) — read telegraphs for fairness.
- Enemies should be **scouted** by the player (party/type preview) so losing
  to an unknown enemy feels avoidable, not cheap.
- Enemy data is data-driven (`data-model.md`).

---

## 7. Manual vs. autobattle

- **Manual mode (default):** full control of every action.
- **Autobattle (optional):** AI-driven turns per the per-character script in
  `autobattle-and-idle.md`. The player can toggle per battle, per character,
  or hand control back at any moment.
- Autobattle must use the *same* rules engine — it selects actions, it never
  bends the rules.

---

## 8. Feedback & presentation

- Clear telegraphs: incoming damage, status icons, turn order display,
  damage numbers, KO announcements.
- A battle log (chat-style scrollback) — also the surface autobattle decisions
  are audited on.

---

## Open questions (remaining)

None — all combat-scope questions are resolved (see the decision log in
`roadmap.md`). Element-chart details, status lists, and MP costs are balance
data, decided in the Phase 5 data pass.

# Combat: Conditional Turn-Based Battle Engine

The heart of the game. **Conditional Turn-Based (CTB)** team combat, Pokerogue-style
in feel but with a *dynamic turn queue* the player can read and manipulate live.
Turn order is not a static per-round list — it is a timeline that shifts with
every choice made. Knockouts are final: permadeath, no revives.

CTB in one paragraph: all combatants sit on the same timeline. Speed determines how
fast a combatant climbs toward the top of the queue; the action *they choose*
determines how far they fall back after acting. Fast, light actions keep a
combatant near the front; heavy spells and items add major delay. Buffs, debuffs,
and effects can push enemies back or pull allies forward mid-fight.

---

## 1. Battle format

- **Sides:** the player's active party vs. an enemy squad (1–N enemies).
- **Active party (locked):** all chosen party members fight in every battle.
  **No mid-battle rotation/bench.**
- **The queue:** every combatant sits on one shared timeline, ordered by their
  position (`nextAt` — see §2). The combatant(s) at the front take their turn,
  act, and are **re-inserted into the queue** at a new position.
- **Visible queue:** the UI shows the "next in line" preview — the upcoming N
  combatants in real time. This is the primary tactical read (§10).
- **Determinism:** ties (equal position) resolve by a stable rule — player-side
  priority first, then actor ID — so ordering is reproducible in unit tests.
- **Rounds:** there are no fixed rounds. The battle clock simply advances from
  one resolved turn to the next.

---

## 2. The timeline: speed, action weight & delay (CTB core)

- **Climb rate — SPD:** a combatant's SPD stat sets how quickly it climbs the
  queue. Higher SPD = more turns in the same amount of battle time.
- **Action weight / delay:** every action carries a weight. A basic attack has a
  small weight (fight's fast); a heavy spell, a buff, or a special item has a
  large weight (fight's slow). High delay drops the user well down the queue.
- **Re-insertion:** after a combatant acts, its next turn position is computed
  from SPD and the action's delay:

  ```
  nextAt = turnTime + actionDelay × (SPD_REF / SPD)
  ```

  `SPD_REF` is a balance constant (normalizes SPD onto the timeline). Exact
  curve tuning happens in the Phase 5 data pass; the formula lives in a **pure,
  unit-tested module** and never in UI code.
- **Conditional manipulation:** effects can mutate the timeline mid-fight —
  reduce an ally's `nextAt` (pull their turn forward) or raise an enemy's
  `nextAt` (push it back). In v1 the engine supports this hook via SPD
  buffs/debuffs and reserved effect slots; direct "haste / slow / interrupt"
  spells are designed for but tuned later (§11). Event-node fields/traps can
  reuse the same hook in Phase 3.

---

## 3. Turn flow

For each queue slot (the front combatant, `C`):

1. **Turn begins.**
2. **Own-turn statuses tick first:** burn deals its damage to `C`; regen heals
   `C`. If a tick KO's `C`, the turn ends there (no action).
3. **CC check:** if `C` is asleep or frozen it skips its action; skip counters
   tick down; a sleeping `C` also wakes if it took damage this queue cycle
   (§5). Skips re-insert `C` with a light "waiting" delay.
4. **Act:** `C` chooses an action (manual or AI — §9, §8). Resolve it: hit
   roll (accuracy vs. dodge, blind), crit roll, damage/element/variance (§5),
   MP costs, cooldowns, new statuses.
5. **Resolve durations for `C`:** status cooldown counters of `C` tick; expired
   effects fall off.
6. **Re-insert `C`** into the queue at `nextAt` (§2) using the action's delay.
7. **Advance the global turn counter** (drives the poison interval ticker — §5)
   and check battle-end conditions (§9).

---

## 4. Actions per turn

A combatant's turn offers:

- **Attack** — basic weapon strike (ATK vs. DEF ratio, §5). Low delay.
- **Skill** — spend MP on an equipped skill (ATK or MAG scaling). Cooldowns
  count the caster's own turns (§5). MP is shared across skills and
  **regenerates at rest nodes only (locked)** — no regen between battles.
- **Item** — use a consumable (heal / buff / cleanse). Higher delay than a
  basic attack. *(Not wired in the Phase 2 test battle.)*
- **Defend** — halve incoming damage until the defender's **next own turn**
  (timeline-driven). A later option, guard-an-ally (intercept their incoming
  hits), is designed but tuning-deferred.
- **Escape / run check** — attempt to flee (gauntlet context, Phase 3).

---

## 5. Damage, healing & status

All formulas live in a pure, unit-tested module. Every constant (base values,
powers, caps, variance, SPD_REF) belongs in **balance data files, never code**.

### Damage — ratio-based (no clamp, **decided**)

```
physical:  damage = base × (ATK_eff / DEF_eff)
magical:   damage = base × (MAG_eff / RES_eff)

final = ratio-damage × elementMultiplier × defend/guard modifier
        × variance × crit
```

Applied in order:

- **base** — the action's power (`SkillDef.power`; the basic Attack uses a
  balance constant).
- **elementMultiplier** — the element chart (weak = 2×, resist = 0.5×;
  `src/core/data/elements.ts`).
- **defend/guard modifier** — halves damage while Defending.
- **variance** — seeded roll, 0.9–1.1.
- **crit** — crit *chance* derives from SPD/gear/class (Rogue higher); crit
  damage is ~1.5× by default.
- **dodge & blind** — before damage, a hit roll passes `accuracy × (1 − dodge)`.
  Base accuracy is 1.0; **blind halves the attacker's accuracy**. Dodge derives
  from SPD/gear. A missed attack deals 0. *(A standalone accuracy/block stat is
  out of v1 scope — see §11.)*
- **rounding** — the **final** damage value is rounded to the nearest whole
  number before being applied to HP (and shown in the battle log). The ratio,
  element, variance and crit steps are computed in full precision first.

The ATK/DEF ratio is **not clamped** (**decided**): extreme stat mismatches
produce proportionally huge or tiny hits. Scouts exist so a bad matchup is
the player's burden to avoid, not a dice roll (see §8).

### Healing — magic scales with MAG; items are flat (**decided**)

```
heal magic:  heal = basePower × (MAG_eff / MAG_REF)
heal item:   heal = use.healHp            // flat — no scaling
```

- **RES is magic defense only.** It does **not** modify outgoing healing.
- Healing magic scales with the **caster's MAG**. Items heal a flat amount.
- Both magic and item healing are **rounded to the nearest whole number**
  before being applied to HP.
- Gear augments, buffs on a healer, and other scaling sources are a designed
  future extension (not Phase 2).
- `regen` heals a flat `power` amount on its tick (already a whole number).

> **Data note:** heal skills in `src/core/data/skills.ts` currently carry
> `scaling: 'hp'`. Under this decision they scale on the caster's MAG, so heal
> skills switch to `scaling: 'mag'` when the engine lands (see the Phase 2
> plan). Items keep flat `use.healHp`.

### Status — the v1 engine set (**decided**)

| Status | Behavior |
| --- | --- |
| **statBuff / statDebuff** | Modify a stat (ATK/DEF/MAG/RES/SPD) for a duration |
| **burn** | Damage at the **start of the victim's own turn** |
| **poison** | Damage over time; ticks on a **global interval** (after every 3 resolved turns), independent of the victim's turns |
| **regen** | Heal at the **start of the affected actor's own turn** |
| **sleep** | Can't act; **wakes on taking damage**, otherwise ends after N own turns |
| **blind** | **Halves the affected actor's accuracy** (→ miss chance), N own turns |
| **freeze** | **Skips the next N turns** unconditionally (cannot act; not woken by damage) |

Rules:
- **Stacking** — statuses stack **per-status**: each application adds its own
  stack with its own duration. Effective modifier = stacks combined, **capped**
  (default cap 2×; a balance constant). Expired stacks fall off.
- **Duration** — counted in the **affected actor's own turns**. A 3-turn buff
  expires after that character has taken 3 of their own turns. Cooldowns count
  the caster's own turns the same way.
- **Cleanse** removes harmful effects; enemies use the same status system.
- **No revives** — nothing in the game revives a KO'd character (§6).
- **Deferred:** `shield`, `taunt`, `stun` stay in the types stub but are **out
  of the Phase 2 engine** until the Phase 5 balance pass (§11).

---

## 6. Knockout & permadeath (THE core rule — locked)

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

## 7. Battle end & the outcome contract

The battle ends when: all enemies are KO'd → **`won`**; all party members are
KO'd → **`lost`** (full wipe ends the run — §6); the party flees successfully
→ **`fled`**.

The engine **does not apply meta effects itself**. It returns a standard
outcome contract that the run layer (Phase 3) consumes:

```
BattleResult {
  status:   'won' | 'lost' | 'fled'
  koIds:    string[]          // party character IDs KO'd (→ permadeath)
  survivors:string[]          // surviving party character IDs
  xpAwarded:Record<Character.id, number>
  drops:    Loot[]            // items/gear won (banking decided in Phase 3)
  log:      BattleLogEntry[]  // full battle record (audit + review)
}
```

- **Permadeath resolution** (KO'd → removed, gear return, full-wipe run end)
  and **durability ticks** are applied by the run layer at battle end, not by
  the combat engine.
- Within a battle, KO'd actors simply can't act; combat continues until one
  side is wiped.

---

## 8. Enemy AI — data-driven priority scripts (**decided**)

- Every enemy chooses actions through a **compact priority script stored in
  data**: an ordered list of `(condition → action)` pairs; the first condition
  that is true wins.
- **Condition vocabulary:** own/ally HP%, ally or enemy count, current statuses,
  cooldowns ready, lowest-HP party member, etc.
- **Actions:** use skill X, basic attack, or defend, plus a target-selection
  rule.
- **Profiles** (the `ai` field on `EnemyDef`): `minion`, `tanky`, `glass`, and
  `boss`. Boss profiles may add scripted calendar patterns (e.g., defend turn
  1, then a big AoE every 3rd turn) expressed as conditions.
- **Same engine as autobattle:** the priority-script interpreter is the same
  one the player-autobattle presets drive in Phase 4 — scripts pick actions,
  they never bend the rules.
- **Scouting:** the run UI previews the enemy squad / types before a battle so
  a loss to an unknown composition feels avoidable, not cheap.

---

## 9. Manual vs. autobattle

- **Manual mode (default):** full control of every combatant's turn — acting
  out of the queue works like any CTB title (pick the front combatant's action,
  watch the queue reorder).
- **Autobattle (optional):** AI-driven turns per per-character scripts (presets
  built on the same interpreter as §8, tuned per class role — Balanced, Healer,
  Glass Cannon, Tank in `autobattle-and-idle.md`). Toggle per battle, per
  character, or hand control back at any moment.
- Autobattle must use the **same rules engine** — it selects actions, it never
  bends the rules.

---

## 10. Feedback & presentation

- **Live turn-order strip** on the queue panel — the core CTB read: "next in
  line", with positions shifting as acts land and delays push combatants back.
- Damage numbers, crit flashes, dodges/misses, status icons, KO announcements.
- A battle log (chat-style scrollback) recording every event — also the surface
  autobattle decisions are audited on.

---

## 11. Open items / deferred (tracked here so nothing is silently dropped)

- `shield`, `taunt`, `stun` statuses — types stub remains; out of the v1 engine.
- Direct queue-pull spells (haste / slow / interrupt) — the `nextAt` mutation
  hook exists (§2); the skills themselves are future work.
- Guard-an-ally (Defend intercept) tuning; environmental / field-trap timeline
  effects (Phase 3 event nodes).
- Standalone accuracy & block stats — v1 has dodge + blind's accuracy penalty
  only.
- MP-restoring items; items and escape wired into the test-battle scene.
- **Door left open (design intent):** weapon/armor **augments that teach
  skills or magic**, status items, and spells in item form — deep
  customization is the long-term goal; the engine's data-driven skill + delay +
  status model is shaped so those extensible additions don't require redesign.

### Resolved in this round (see the decision log in `roadmap.md`)

CTB queue model; action weight/delay as an explicit data field; ratio damage
unclamped; heal formula (MAG-scaling magic, flat items, RES excluded); v1 status
roster; per-status stacking with cap; own-turn durations; burn/regen
own-turn vs. poison interval ticks; sleep/blind/freeze semantics; crit + dodge
derived stats; priority-script AI; the outcome contract. Element-chart details,
MP costs, powers, and caps remain balance data for the Phase 5 pass.
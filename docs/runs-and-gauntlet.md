# Runs & The Gauntlet

A **run** is a self-contained expedition: a sequence of battles (the
*gauntlet*) with roguelike decisions and escalating difficulty. Runs are what
you start after customizing your party, and what produces XP, drops, and
gold.

---

## 1. Run anatomy

```
START ──► [node 1] ──► [node 2] ──► … ──► [final node] ──► WIN / FAIL
```

- A run = a fixed number of **nodes** (see locked shape below).
- A node is one of a small set of encounter types (see §3).
- Between nodes the player can review the party, use consumables, and
  confirm the next battle.

**Shape (locked):** runs are **fixed-length**. Pick a "destination/area"
(difficulty band) at run start; the run marches through a chosen number of
battles with choice nodes and a boss at the end. (Endless is a possible later
mode, not v1.)

**Run lengths (locked):** gauntlets of **1, 3, 5, 10, 15, or 20 battles**.
**Rest nodes appear every 5 battles** (what rest offers is deliberately left
open-ended for now — see §3).

---

## 2. Core loop inside a run

```
Battle won
   │
   ├── survivors gain XP / level up (in-place)
   ├── battle rewards: gold, drops, maybe a skill tome / gear
   └── check party (heal? use consumables? inspect loot?)
       │
       ▼
next node ──► battle / shop / rest / event
   │
   ▼ (boss node) ──► run complete: big meta payout
```

- **Survivors level up mid-run**, so a long run snowballs — that's the
  roguelike dopamine.
- **Drops are bound to the run until it ends** — they convert to the
  persistent inventory/money at run completion (or partial payout on failure;
  see §5).

---

## 3. Node types (v1 candidate set)

| Node | What happens |
| --- | --- |
| **Battle** | Standard fight. Win → XP + drops + gold. |
| **Elite** | Harder fight, better drops, optional challenge. |
| **Boss** | Signature fight at the end (or at milestones). |
| **Rest / Camp** | Recovery node, every 5 battles. What it offers is open-ended (see below). |
| **Shop** | Spend run gold on consumables and gear. |
| **Event** | Roguelike choice (accept a curse for a boon, gamble, etc.). |

Node order is *seeded per run* so it's reproducible/recordable, but shuffled
enough to feel varied.

**Rest points (open design space):** rest nodes recur every 5 battles. What
the player can do there (full heal vs. limited heals, spend gold, buy items,
re-spec loadouts, save-only, side perks) is intentionally **not locked yet** —
this is expected to have big tuning effects on the run economy. Tune in
Phase 5.

---

## 4. Roguelike elements

- **Seeded randomization:** enemy compositions, node order, drop tables, and
  event outcomes derive from a seed shown at run start (enables sharing and
  debugging, and makes "the RNG cheated me" verifiable).
- **Escalating difficulty (locked for MVP):** difficulty is driven by
  **numbers** — a rising enemy level/power curve per node, with elite and boss
  nodes as peaks. Smarter enemy tactics are a later pass.
- **Node selection (locked):** the run uses **branching paths** — players
  choose which node to take next (e.g., a standard battle with guaranteed
  gold, an elite with better gear, or a rest), creating real decisions
  between fights.
- **Run modifiers (stretch):** temporary buffs/nerfs picked at choice nodes
  ("double gold, +10% enemy ATK") — adds the deck-building layer of
  Pokerogue later.

---

## 5. Run end states

| End state | Payout |
| --- | --- |
| **Victory** (clear the final boss) | Full rewards: gold, all carried drops, big meta payout |
| **Full wipe** (entire party KO'd) | Run ends; the party is now **0 characters** — no survivors. Gold/drops are lost (optionally a small consolation). Player returns to the PC boxes / recruitment NPC. |
| **Abandon** (player quits the run) | Survivors keep XP/levels/gear; reduced gold/drops. No permadeath just for quitting. |

- **Permadeath is battle-driven only** (see `combat.md` §6); quitting a run
  never kills characters. A full wipe leaves **no survivors** — every KO'd
  character is gone.
- After any run end, the player rebuilds the party from the PC boxes or buys
  new characters at the recruitment NPC (`metagame.md` §2).
- Runs are **idle-friendly**: you can stop at any checkpoint and return later
  (`autobattle-and-idle.md`).

---

## 6. Rewards & economy hooks

- Battle-to-battle: XP, small gold, occasional drops.
- Elite/boss: guaranteed better-tier drops and skill tomes (feeds
  `metagame.md`; recruitment is gold-purchased between runs).
- Run completion: the primary source of **meta progression** (unlocks,
  box expansion, premium-gear acquisition).
- Durability ticks down at run resolution (`durability.md` §3).

---

## Open questions (remaining)

1. What exactly happens at rest points (see §3)? Intentionally open — big
   tuning lever.
2. Branch detail: how many branches per node, and how visible each branch's
   contents are. (Balance/UI detail, Phase 5.)

Deferred (not v1): run-level scores/records (best clear, fastest, no-death).

Decision log: `roadmap.md`.

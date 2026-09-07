# Autobattle & Idle

The pitch: "the player spends a lot of time on customization and then starts
a run, characters are possibly controlled by autobattle scripts, and the
player may leave the game and return to it. Autobattling should be optional."

This doc defines how that works without gutting the manual, deliberate
combat.

---

## 1. Principles

1. **Autobattle is an opt-in convenience, never a requirement.** Every battle
   can be played fully manually.
2. **Autobattle uses the same rules engine.** It only *chooses* actions; it
   never bends damage, hit, or reward rules. No autobattle tax on rewards.
3. **The player can intervene anytime.** Toggle autobattle mid-battle, hand
   control to one character while the rest autobattle, pause, resume.
4. **Nothing advances while the game is closed** (it's turn-based, not
   real-time), but a hidden-but-open tab **keeps running**. Progress is always
   **safely checkpointed**, so leaving is never punished.

---

## 2. Autobattle behavior

- **Per-character AI "scripts"** other than the two library built-ins are
  **player-authored** in the Automation Window. A script is a priority list of
  rules (trigger → target → action) plus a reactions sheet — see
  `specs/character-scripting.md` and the sprint plan
  `workspace/phase_4.5.2-scripting.md` (roadmap #55 supersedes the earlier
  v1 "curated presets only" scope).
- The **`dps` (Aggressive) and `healer` (Support)** built-in scripts ship in
  every profile's script library as read-only starting points; `Balanced` /
  `Glass Cannon` / `Tank` earlier listed recipes are deferred presets — the
  player can reproduce any of them by editing a duplicated built-in.
- Defaults: party members start on a script (the `healer` built-in for support
  roles) unless the player assigns otherwise; the player can switch a
  character to Manual at any time.

---

## 3. Speed controls

| Control | Effect |
| --- | --- |
| **1× / 2× / 4×** | Battle animation & tick speed |
| **Skip animations** | Instant resolution with a compact battle log |
| **Auto-advance** | After a battle, queue the next node (with a confirm/pause point) |

The battle log (see `combat.md` §10) is the audit trail: even at 4× you can
scroll back to see why a character made a move.

---

## 4. Leaving and returning

- **Checkpoints:** the game saves at safe boundaries:
  - after every battle resolution,
  - at rest/camp nodes,
  - on any meta-game screen change (boxes, loadout, shop),
  - immediately on quit/unload.
- **Mid-battle saves (locked):** **no** — saves happen between battles and at
  checkpoints only, not during a battle.
- **Background tab (locked):** a hidden tab **keeps running**. With autobattle
  on, battles resolve while the player is away (this game is an idler at
  heart). The run still stops at hard decision points (§5) and waits.

---

## 5. Idle-while-autobattling

- A **Run → Autobattle** mode: the player starts a run, sets scripts and
  speed, and lets it run while tabbing away for minutes-to-hours.
- With autobattle + auto-advance on, battles resolve themselves; the run stops
  at hard decision points (permadeath moments, shop nodes, events, boss
  telegraphs) so meaningful choices aren't made without the player.
- In **manual mode**, a hidden tab simply waits at the next decision point —
  nothing is lost, and play resumes when the player returns.
- **Stretch goal (later):** true "idle-run" — a run that continues to a
  checkpoint while away and reports results on return. Deliberately *not* in
  v1 because turn-based combat's core tension is decision-making.

---

## 6. Fairness guardrails

- Autobattle can lose fights a good manual player would win — that's fine and
  expected; it's the cost of convenience.
- Autobattle must never force a **forfeit**. If the player steps away and a
  battle is lost, that's combat loss rules (see `combat.md` §6), not an idle
  penalty.
- Abandoning a run while away = normal abandon payout (see
  `runs-and-gauntlet.md` §5); no extra punishment.

---

## Open questions (remaining)

1. Should autobattle results be skippable to a summary, or always watchable?

Deferred (not v1): player-authored script **editor** — now superseded by the
Automation Window shipped in the scripting sprint (this page's §2 no longer
deferrals note it).

Decision log: `roadmap.md`.

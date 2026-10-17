# Manual Test Cases — Skills, Combat Timing & Scripting System

**Purpose**: Comprehensive manual verification checklist for the Phase 4.5.2 feature set. Run these after each major change to the skill system, combat engine, or scripting interpreter.

**Environment**: Dev build (Vite dev server) + browser console for debugging.  
**Save File**: Use a dedicated "Test Profile" with all classes unlocked, max gold, pre-leveled characters.

---

> **🤖 Automation Note**: Most of this manual test plan is now covered by automated tests.
> - **Unit/Integration**: `npm run test` — covers §1 (Skill Matrix), §2 (CTB), §3 (Scripting logic), §4 (Status), §5 (Elements), §6 (Items), §9 (Save/Load)
> - **E2E**: `npx playwright test` — covers §3.2 (Script Editor UI)
> - See [Testing Documentation](../testing.md) for details.
> - Remaining manual sections: §7 (Run/Meta), §8 (Autobattle UI), §10 (Regression smoke)

---

---

## 0. Test Profile Setup

Create a save file (or use `localStorage` injection) with:

```json
{
  "profileId": "manual-test",
  "displayName": "Manual Test",
  "gold": 999999,
  "unlockedClasses": ["knight","berserker","rogue","ranger","mage","healer","bard"],
  "characters": {
    "c_knight": { "classId": "knight", "name": "TestKnight", "level": 10, "learnedSkills": ["slashing_strike","shield_bash","iron_guard"], "loadout": ["slashing_strike","shield_bash","iron_guard","attack"], "gear": {"weapon":{"id":"g1","itemId":"warhammer","durability":{"kind":"permanent"}}}, "durability": {"kind":"permanent"}, "scriptId": "builtin.dps", "scriptMode": "auto" },
    "c_berserker": { "classId": "berserker", "name": "TestZerker", "level": 10, "learnedSkills": ["flame_slash","berserk_strike","battle_fury"], "loadout": ["flame_slash","berserk_strike","battle_fury","attack"], "gear": {"weapon":{"id":"g2","itemId":"flame_staff","durability":{"kind":"permanent"}}}, "durability": {"kind":"permanent"}, "scriptId": "builtin.dps", "scriptMode": "auto" },
    "c_rogue": { "classId": "rogue", "name": "TestRogue", "level": 10, "learnedSkills": ["backstab","poison_blade","shadow_bolt"], "loadout": ["backstab","poison_blade","shadow_bolt","attack"], "durability": {"kind":"permanent"}, "scriptId": "builtin.dps", "scriptMode": "auto" },
    "c_mage": { "classId": "mage", "name": "TestMage", "level": 10, "learnedSkills": ["fireball","frost_bite","flame_wave","arcane_bolt"], "loadout": ["fireball","frost_bite","flame_wave","arcane_bolt"], "durability": {"kind":"permanent"}, "scriptId": "builtin.dps", "scriptMode": "auto" },
    "c_healer": { "classId": "healer", "name": "TestHealer", "level": 10, "learnedSkills": ["heal","cleanse","holy_light","greater_heal"], "loadout": ["heal","cleanse","holy_light","greater_heal"], "durability": {"kind":"permanent"}, "scriptId": "builtin.healer", "scriptMode": "auto" },
    "c_bard": { "classId": "bard", "name": "TestBard", "level": 10, "learnedSkills": ["battle_anthem","ice_song","soothing_song","slow_rhythm"], "loadout": ["battle_anthem","ice_song","soothing_song","slow_rhythm"], "durability": {"kind":"permanent"}, "scriptId": "builtin.healer", "scriptMode": "auto" },
    "c_ranger": { "classId": "ranger", "name": "TestRanger", "level": 10, "learnedSkills": ["rapid_shot","frost_arrow","tri_shot"], "loadout": ["rapid_shot","frost_arrow","tri_shot","attack"], "durability": {"kind":"permanent"}, "scriptId": "builtin.dps", "scriptMode": "auto" }
  },
  "party": ["c_knight","c_berserker","c_mage","c_healer"],
  "boxes": [{"id":"b1","name":"Box 1","slots":["c_knight","c_berserker","c_mage","c_healer","c_rogue","c_bard","c_ranger",null,...]}],
  "inventory": {"items":[],"gear":[]},
  "autobattle": {"speed":4,"skipAnimations":true,"resultDelayMs":0,"stops":{"boss":false,"elite":false,"permadeath":false,"rest":false}},
  "scriptLibrary": [/* built-ins + custom scripts */]
}
```

---

## 1. Skill Verification Matrix

Test every skill in `SKILLS` (player + enemy + passive + reaction) for:
- Correct damage/heal numbers (roughly)
- Correct targeting
- Correct element
- Correct status application (type, power, duration)
- Cooldown behavior
- MP cost deduction
- Script selector filtering (tags, kind, element)

### 1.1 Active Damage Skills

| Skill | Class | Element | Power | Scaling | Targets | Cost | CD | Effect | Test Notes |
|-------|-------|---------|-------|---------|---------|------|----|--------|------------|
| Slashing Strike | Knight | earth | 45 | atk | single | 4 | — | — | Basic damage |
| Shield Bash | Knight | earth | 35 | atk | single | 5 | 2 | def debuff 0.8× 2t | Debuff applies |
| Flame Slash | Berserker | fire | 50 | atk | single | 5 | — | — | Fire element |
| Berserk Strike | Berserker | fire | 60 | atk | single | 6 | 1 | — | Short CD |
| Backstab | Rogue | shadow | 55 | atk | single | 5 | — | — | High single-target |
| Poison Blade | Rogue | shadow | 40 | atk | single | 4 | — | poison 5×3t | Poison ticks |
| Shadow Bolt | Rogue | shadow | 45 | mag | single | 5 | — | — | Mag scaling |
| Rapid Shot | Ranger | water | 30 | atk | single | 3 | — | — | Low cost, spammable |
| Frost Arrow | Ranger | frost | 45 | atk | single | 5 | — | — | Frost element |
| Tri-Shot | Ranger | none | 30 | atk | single | 4 | — | — | No element |
| Fireball | Mage | fire | 55 | mag | single | 6 | — | — | Mage bread-and-butter |
| Frost Bite | Mage | frost | 45 | mag | single | 5 | — | spd debuff 0.7×2t | Debuff + damage |
| Flame Wave | Mage | fire | 40 | mag | all-enemies | 8 | 2 | — | AOE, high cost |
| Arcane Bolt | Mage | none | 40 | mag | single | 4 | — | — | Cheap filler |
| Holy Light | Healer | holy | 45 | mag | single | 5 | — | — | Healer offense |
| Ice Song | Bard | frost | 40 | mag | single | 5 | — | — | Bard damage |
| Battle Anthem | Bard | frost | 0 | hp | all-allies | 6 | 3 | atk buff 1.2×3t | Party buff |
| Slow Rhythm | Bard | frost | 0 | hp | all-enemies | 6 | 3 | spd debuff 0.7×2t | Party debuff |

**Test Procedure per Skill**:
1. Enter test battle (3-node run, first node)
2. Set character to Manual mode
3. Use skill → verify log shows correct element icon, damage range, target
4. Check status panel for buffs/debuffs
5. Verify MP deducted
6. Verify cooldown grays out skill for correct turns
7. Test vs. weak/resistant element (check 2× / 0.5× multiplier)

### 1.2 Active Heal/Utility Skills

| Skill | Class | Kind | Power | Scaling | Targets | Cost | CD | Effect |
|-------|-------|------|-------|---------|---------|------|----|--------|
| Heal | Healer | heal | 60 | mag | single | 5 | — | — |
| Greater Heal | Healer | heal | 120 | mag | single | 8 | — | — |
| Soothing Song | Bard | heal | 50 | mag | single | 5 | — | — |
| Cleanse | Healer | utility | 0 | hp | single | 4 | — | Removes debuffs |
| Iron Guard | Knight | buff | 0 | hp | self | 6 | 3 | def buff 1.3×3t |
| Battle Fury | Berserker | buff | 0 | hp | self | 6 | 3 | atk buff 1.25×3t |

**Test Procedure**:
- Heal: Damage ally → cast → verify HP restored ≈ `power × (MAG/20)`
- Cleanse: Apply poison/burn/stun → cast → verify removed
- Buffs: Cast → verify stat sheet shows increased stat for duration

### 1.3 Passive Skills (Applied at Battle Start)

| Skill | Class | Effect | Duration |
|-------|-------|--------|----------|
| Fortress (Knight) | def buff 1.3× | 999 (permanent) |
| Reckless (Berserker) | atk buff 1.25× | 999 |
| Toughness | def buff 1.2× | 999 |
| Regen Aura | regen 5/allies | 999 |

**Test Procedure**:
1. Start battle with Knight (has Fortress passive in loadout)
2. Before any action, open stat tooltip → verify DEF shows base + 30%
3. Same for Berserker (ATK +25%), any class with Toughness, any with Regen Aura
4. Verify passives do NOT appear in action menu (type: passive)
5. Verify passives work even if character is stunned/silenced

### 1.4 Reaction Skills (Triggered by Event Gates)

| Skill | Reaction To | Test Trigger |
|-------|-------------|--------------|
| Thorns | attacked (self) | Enemy attacks character with Thorns loaded |
| Steal | evaded (enemy→self) | Enemy attacks, character evades (blind/dodge) |
| Guardian's Vow | attacked (enemy→ally) | Enemy attacks different ally |

**Test Procedure**:
1. Create custom script with reaction blocks for these skills
2. Assign to character, set to Auto
3. Force trigger condition (e.g., give enemy 100% hit, give character blind for evade)
4. Verify reaction fires immediately after trigger event (same CTB tick)
5. Verify reaction respects MP/cooldown (reactions ignore MP cost? Check spec)
6. Verify reaction target selection matches script target clause

### 1.5 Enemy Skills

| Skill | Enemy | Element | Power | Scaling | Notes |
|-------|-------|---------|-------|---------|-------|
| Tackle | Slime | none | 30 | atk | Basic |
| Goblin Swipe | Goblin | none | 35 | atk | Basic |
| Ember | Fire Elemental | fire | 40 | mag | Fire |
| Frost Breath | Frost Wraith | frost | 40 | mag | Frost |
| Shadow Strike | Shadow Assassin | shadow | 45 | atk | Shadow |
| Rock Smash | Earth Golem | earth | 40 | atk | Earth |
| Holy Smite | Holy Guardian | holy | 40 | mag | Holy |

**Test**: Run battles vs each enemy type; verify skills used, elements correct.

---

## 2. Combat Timing & CTB Verification

The CTB (Count Time Battle) system uses `SPD` and `actionDelay` to schedule turns.

### 2.1 Core Timing Formula

```
nextAt = currentTurnTime + actionDelay × (spdRef / SPD)
spdRef = 100 (BALANCE.spdRef)
actionDelay: attack=100, defend=110, item=160, skill=120 (BALANCE.actionDelays)
```

### 2.2 Test Cases

| # | Scenario | Expected | Verification |
|---|----------|----------|--------------|
| 1 | Two actors, SPD 10 vs 20, both use Attack (delay 100) | SPD 20 acts twice as often | Check turn order log; ratio ≈ 2:1 |
| 2 | Same SPD, Attack (100) vs Skill (120) | Attack acts slightly more often | Count turns over 30s |
| 3 | Defend (110) vs Attack (100) | Attack acts ~10% more | Compare turn counts |
| 4 | Item (160) vs Attack (100) | Attack acts 1.6× more | Compare turn counts |
| 5 | Haste/Slow buff (SPD ±50%) | Turn frequency scales inversely | Apply buff, measure |
| 6 | SPD debuff (statDebuff spd 0.5×) | Target acts half as often | Apply Frost Bite / Slow Rhythm |
| 7 | Speed 4× (autobattle) | All timing compressed 4× | Enable speed 4, verify battle ends 4× faster |
| 8 | Skip Animations | No visual delay between turns | Enable, verify log still accurate |
| 9 | CTB tie-break (same nextAt) | Deterministic (party before enemy, then ID) | Force same SPD/delay, check order |

### 2.3 Speed Math Debugging

Open browser console during battle; `BattleScene` exposes `this.ctb` (if debug build). Check:
- `ctb.queue` — sorted by `nextAt`
- `ctb.turnTime` — current timeline position
- Each actor's `timeToNext`

---

## 3. Scripting System Verification

Test the character scripting system (`src/core/scripting/`) end-to-end.

### 3.1 Built-in Scripts

| Script | ID | Behavior | Test |
|--------|-----|----------|------|
| DPS | `builtin.dps` | Cast affordable damage skill at lowest-HP enemy; else basic attack | Assign to Knight → verify uses Slashing Strike → Shield Bash (on CD) → Attack |
| Healer | `builtin.healer` | Cast affordable heal at lowest-HP ally <60%; else Defend | Assign to Healer → damage party → verify heals prioritized |

**Test Steps**:
1. Assign script in Profile → Character → Script dropdown
2. Set `scriptMode: 'auto'`
3. Run 3-node battle on speed 4, skip animations
4. Watch battle log (or enable debug overlay) for action choices
5. Verify no invalid targets (dead, out of range — though range not implemented)
6. Verify MP management (doesn't cast unaffordable skills)

### 3.2 Custom Script Authoring (Script Editor Panel)

Test the full authoring flow in the Script Editor panel (`ScriptEditorPanel`).

#### 3.2.1 Trigger Conditions

| Condition Kind | Params | Test |
|----------------|--------|------|
| `hp-pct` | scope: `self`\|`any-ally`\|`any-enemy`\|`lowest-hp-ally`\|`lowest-hp-enemy`, op: `<`\|`>`\|`<=`\|`>=`\|`==`, value: 0–1 | Set `hp-pct < 0.5` on `self` → skill fires when <50% HP |
| `can-cast` | — | Skill only fires if MP ≥ cost and off cooldown |
| `status-present` | statusKind, targetScope | Fire when target has poison |
| `enemy-count` | op, value | Fire when ≥3 enemies alive |
| `turn-count` | op, value | Fire on turn 3+ |
| `buff-active` | stat, targetScope | Fire when ATK buff active |

**Test Matrix**: Create script with each condition type; verify triggers correctly.

#### 3.2.2 Target Selectors

| Target Kind | Test |
|-------------|------|
| `self` | Buff targets caster |
| `lowest-hp-ally` | Heal targets most wounded ally |
| `lowest-hp-enemy` | Damage targets most wounded enemy |
| `highest-hp-enemy` | Damage targets tankiest enemy |
| `random-ally` | Random valid ally |
| `random-enemy` | Random valid enemy |
| `all-allies` | AOE buff/heal hits all living allies |
| `all-enemies` | AOE damage hits all living enemies |

#### 3.2.3 Action Sources & Filters

| Source | Filters | Test |
|--------|---------|------|
| `skills` | `byKind: damage` | Only damage skills considered |
| `skills` | `byKind: heal` | Only heal skills |
| `skills` | `byElement: fire` | Only fire skills |
| `skills` | `byId: fireball` | Only that specific skill |
| `skills` | `byTag: aoe` | Only AOE skills |
| `items` | `byType: consumable` | Uses potion/scroll |
| `basic-attack` | — | Falls back to attack |
| `defend` | — | Defend action |

#### 3.2.4 Nested Blocks (If/Else Chains)

```json
{
  "rootBlock": {
    "lines": [
      { "trigger": { "conditions": [{ "kind": "hp-pct", "scope": "self", "op": "<", "value": 0.3 }], "operator": "AND" }, "target": { "kind": "self" }, "action": { "source": "skills", "filters": [{ "kind": "byKind", "skillKind": "heal" }] } },
      { "trigger": { "conditions": [{ "kind": "enemy-count", "op": ">=", "value": 3 }], "operator": "AND" }, "target": { "kind": "all-enemies" }, "action": { "source": "skills", "filters": [{ "kind": "byTag", "tag": "aoe" }] } }
    ],
    "nested": []
  }
}
```

**Test**: Low HP → heal; else if 3+ enemies → AOE; else → fallback.

#### 3.2.5 Reactions

```json
"reactions": [
  { "trigger": { "conditions": [{ "kind": "attacked", "target": "self" }], "operator": "AND" }, "target": { "kind": "source" }, "action": { "source": "skills", "filters": [{ "kind": "byId", "skillId": "thorns" }] } }
]
```

**Test**: Enemy attacks → Thorns fires back immediately (same tick).

#### 3.2.6 Editor UI Tests

| Action | Expected |
|--------|----------|
| New script → name → save | Appears in library, assignable |
| Edit script → add line → save | Persists, loads correctly |
| Duplicate script | Creates copy with new ID |
| Delete script | Removed from library, unassigned from characters |
| Import/Export JSON | Round-trip preserves all fields |
| Validation errors | Inline red highlight, save blocked |

### 3.3 Script Interpreter Edge Cases

| Case | Expected |
|------|----------|
| No affordable skill matches filters | Fallback action used |
| All targets dead | Skip line, evaluate next |
| Reaction trigger but skill on CD | Reaction skipped (or queued? Spec says ignore CD for reactions?) |
| Multiple reactions same trigger | All fire in declaration order |
| Script assigned but `scriptMode: 'manual'` | Player controls, script ignored |
| Character has no loadout skills | Fallback only (attack/defend) |
| `can-cast` with 0 MP skills (enemy) | Always true |

---

## 4. Status Effect Verification

Test each status in `StatusEffect.kind` (see `src/core/types.ts`).

| Status | Application | Tick Behavior | Removal | Test |
|--------|-------------|---------------|---------|------|
| `statBuff` | Skill effect | Duration-- per turn | Duration 0 or Cleanse | Verify stat sheet shows boosted value |
| `statDebuff` | Skill effect | Duration-- per turn | Duration 0 or Cleanse | Verify stat sheet shows reduced value |
| `burn` | Fire skills | Deals `% max HP` per tick (spec: 5%?) | Duration 0 or Cleanse | Check damage log each turn |
| `poison` | Poison Blade | Fixed damage per `poisonInterval` turns | Duration 0 or Cleanse | Ticks every 3 turns (BALANCE.poisonInterval) |
| `regen` | Regen Aura / skills | Heals per turn | Duration 0 | Check heal log each turn |
| `sleep` | (Future) | Skip turns | Damage wakes / duration 0 | N/A v1 |
| `blind` | (Future) | Accuracy × `blindAccuracy` | Duration 0 | N/A v1 |
| `freeze` | (Future) | Skip turns, breaks on damage | Duration 0 | N/A v1 |
| `shield` | (Future) | Absorbs damage | HP 0 or duration 0 | N/A v1 |
| `taunt` | (Future) | Forces target | Duration 0 | N/A v1 |
| `stun` | (Future) | Skip turns | Duration 0 | N/A v1 |

**Active Statuses (v1)**: `statBuff`, `statDebuff`, `burn`, `poison`, `regen`

**Test Procedure per Active Status**:
1. Apply via skill (known effect)
2. Observe battle log for tick messages
3. Verify stat tooltip shows status icon + remaining duration
4. Verify Cleanse removes it
5. Verify expiration removes it
6. Verify stacking rules (per-status cap = `BALANCE.statCap` = 2)

---

## 5. Element System Verification

`ELEMENT_CHART` defines 2× / 0.5× interactions.

| Attack \ Defend | fire | water | frost | earth | holy | shadow | none |
|-----------------|------|-------|-------|-------|------|--------|------|
| fire | 1 | 0.5 | **2** | 1 | 1 | 1 | 1 |
| water | **2** | 1 | 0.5 | 1 | 1 | 1 | 1 |
| frost | 0.5 | **2** | 1 | 1 | 1 | 1 | 1 |
| earth | 1 | 1 | 1 | 1 | **2** | 0.5 | 1 |
| holy | 1 | 1 | 1 | 0.5 | 1 | **2** | 1 |
| shadow | 1 | 1 | 1 | **2** | 0.5 | 1 | 1 |
| none | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

**Test Cases**:
1. Fire skill vs Frost enemy → ~2× damage (check log `elementMult: 2`)
2. Water skill vs Fire enemy → ~2× damage
3. Frost skill vs Water enemy → ~2× damage
4. Earth skill vs Holy enemy → ~2× damage
5. Holy skill vs Shadow enemy → ~2× damage
6. Shadow skill vs Earth enemy → ~2× damage
7. Reverse pairs → ~0.5× damage
8. Same element → 1×
9. None vs anything → 1×
10. Mixed party: verify each character's element icon matches class

---

## 6. Equipment & Item Verification

### 6.1 Weapons/Armor (Stat Bonuses)

| Item | Type | Stat Bonus | Test |
|------|------|------------|------|
| Iron Sword | weapon | atk +10 | Equip → derivedStats.atk +10 |
| Warhammer | weapon | atk +26 | Equip → derivedStats.atk +26 |
| Mage Staff | weapon | mag +10 | Equip → derivedStats.mag +10 |
| Flame Staff | weapon | mag +12, res +4, grants fireball | Equip → fireball in loadout (grantsSkillWhenEquipped) |
| Leather Armor | armor | def +6 | Equip → derivedStats.def +6 |
| Plate Armor | armor | def +20, hp +25 | Equip → derivedStats.def +20, hp +25 |
| Ranger Cloak | armor | res +8, spd +4 | Equip → derivedStats.res +8, spd +4 |

### 6.2 Consumables

| Item | Use Effect | Test |
|------|------------|------|
| Health Potion | healHp 80 | Battle: use → HP +80 (clamped to max) |
| Greater Health Potion | healHp 200 | Battle: use → HP +200 |
| Mana Potion | healMp 30 | Battle: use → MP +30 |
| Greater Mana Potion | healMp 80 | Battle: use → MP +80 |

### 6.3 Stat-Shots (Permanent Base Stat Boost)

| Item | Boost | Test |
|------|-------|------|
| Shot HP 5 | hp +5 | Meta: use → character.baseStats.hp +5, persists across battles |
| Shot ATK 1 | atk +1 | Meta: use → baseStats.atk +1 |
| Shot DEF 1 | def +1 | Meta: use → baseStats.def +1 |
| Shot MAG 1 | mag +1 | Meta: use → baseStats.mag +1 |
| Shot RES 1 | res +1 | Meta: use → baseStats.res +1 |
| Shot SPD 1 | spd +1 | Meta: use → baseStats.spd +1 |

### 6.4 Skill Tomes & Scrolls

| Type | Behavior | Test |
|------|----------|------|
| Tome | Consumed meta → permanently adds skill to `learnedSkills` | Buy tome → use in Apply panel → skill appears in loadout options |
| Scroll | Consumed in battle → casts skill (no MP, no CD) | Battle: use scroll → skill fires, MP unchanged, no CD applied |

---

## 7. Run Generation & Meta Loop

### 7.1 Run Lengths (3, 5, 10)

| Length | Node Count (battles + rests) | Boss Level Band | Test |
|--------|------------------------------|-----------------|------|
| 3 | 3 battles + 0–1 rest | 7–10 | Generate → verify boss level |
| 5 | 5 battles + 1 rest | 12–15 | Generate → verify rest at step 5 |
| 10 | 10 battles + 2 rests | 18–22 | Generate → verify rest at 5, 10 (pre-boss) |

### 7.2 Branching Choices

At each non-boss node: 3 choices (Battle, Elite, Rest).  
**Test**: Pick each → verify next node type matches.

### 7.3 Rewards & Payout

| Outcome | Gold Multiplier | Drop Multiplier | XP |
|---------|-----------------|-----------------|-----|
| Won | 1.0 | 1.0 | Full |
| Abandoned | 0.5 | 0.5 | Full (survivors) |
| Lost | 0.25 | 0.25 | None |

**Test**: Win/abandon/lose runs → check `goldEarned`, `drops`, character `xp`.

### 7.4 Shop Refresh

Complete run → enter Shop panel → verify:
- Always items present (potions, stat-shots)
- 4 rotating gear, 3 rotating skill items
- Prices match `ITEMS[].value`
- Buy → gold deducted, item added to inventory/gear
- Sell → gold added, item removed

### 7.5 Recruitment Refresh

Complete run → enter Recruit panel → verify:
- 2–3 offers
- Classes from unlocked pool
- Level 1, permanent durability
- Price = `BALANCE.economy.recruitPrice` (150)
- Recruit → gold deducted, character added to box, offer removed

---

## 8. Autobattle & Speed Settings

| Setting | Values | Test |
|---------|--------|------|
| Speed | 1, 2, 4 | Battle completes in ~1/2/4 real-time |
| Skip Animations | on/off | On = instant turns; log still generated |
| Result Delay | 0–3000ms | Victory screen lingers for N ms |
| Auto-Stop: Boss | on/off | On = pauses before boss node |
| Auto-Stop: Elite | on/off | On = pauses before elite node |
| Auto-Stop: Permadeath | on/off | On = pauses if any character KO'd |
| Auto-Stop: Rest | on/off | On = pauses at rest node |

**Test**: Enable all stops → run 10-length → verify pauses at each trigger.

---

## 9. Save/Load & Persistence

| Action | Verify |
|--------|--------|
| Save mid-run (checkpoint) | `activeRun` present in save, all node states preserved |
| Load mid-run | Resume at correct node, party HP/MP/cooldowns restored |
| Save between runs | Profile gold, chars, inventory, boxes, shop, recruitment saved |
| Load between runs | All meta state restored, town selection (when implemented) restored |
| Schema migration | Old save loads with defaults for new fields |

---

## 10. Regression Checklist (Pre-Release)

Run through all of the above, plus:

- [ ] Fresh profile → tutorial flow (if any) → first run works
- [ ] All 7 classes playable, learnset correct
- [ ] Party size enforced (max 4)
- [ ] Box capacity (10 boxes × 30 slots)
- [ ] Durability: permanent gear never breaks; expiring gear counts down
- [ ] Perma-death: character KO'd in lost run → removed from profile (if enabled)
- [ ] Infinite mode: runs loop, HP/MP persist, characters KO'd stay at 0 HP
- [ ] UI tooltips: skills, items, characters, stats all show correct data
- [ ] No console errors/warnings in normal play
- [ ] Performance: 10-length run at speed 4 completes < 30s real time

---

## 11. Debugging Commands (Browser Console)

```js
// Inspect current profile
const p = require('./src/core/store').getProfile()
console.log(p)

// Inspect active run
console.log(p.activeRun)

// Force run generation
const { generateRun } = require('./src/core/runs/run-gen')
const run = generateRun('test', ['c1','c2','c3','c4'], 5, 12345)
console.log(run.nodes.map(n => ({ type: n.type, enemies: n.enemySquad?.map(e => e.id) })))

// Test skill damage math
const { calculateDamage } = require('./src/core/combat/damage')
console.log(calculateDamage(attacker, defender, skill, { variance: 1, crit: false }))

// Test CTB queue
const { CTB } = require('./src/core/combat/ctb')
const ctb = new CTB(actors)
console.log(ctb.queue)

// Reload scripts
const { loadScriptLibrary } = require('./src/core/scripting/store')
loadScriptLibrary()
```

---

## 12. Known Gaps / Future Test Expansion

- [ ] Enemy AI scripts (minion/tanky/glass/boss) — verify priority behavior
- [ ] Status: sleep/blind/freeze/shield/taunt/stun — when implemented
- [ ] Range/position mechanics — if added
- [ ] Town system (this doc's companion) — town-specific enemy pools, shop, recruits
- [ ] Procedural enemy generation — when implemented
- [ ] Multiplayer / cloud save — not in scope

---

## Appendix: Quick Reference — Key Constants

```ts
// BALANCE (src/core/data/balance.ts)
spdRef: 100
variance: [0.9, 1.1]
critRate: 0.05
critDamage: 1.5
dodgeRate: 0.05
magRef: 20
blindAccuracy: 0.5
statCap: 2
poisonInterval: 3
maxMp: 30
basicAttackPower: 15
actionDelays: { attack: 100, defend: 110, item: 160, skill: 120 }
run: { difficultyStep: 1.12, eliteMult: 1.6, bossMult: 2.2, bossMultByLength: {3: 1.2}, restCadence: 5, baseGold: 20, goldVariance: [0.8,1.2], dropChance: 0.5, dropWeights: {gear:1, consumable:1, skillItem:0.5}, runPayout: {won:1, abandoned:0.5, lost:0.25} }
economy: { startingGold: 1500, sellRatio: 0.5, recruitPrice: 150, rotatingGear: 4, rotatingSkillItems: 3, skillItemPrice: {common:200, rare:450, epic:900, legendary:1600}, tomePriceMult: 2.5 }

// RUN_LENGTHS: [3, 5, 10]
// PARTY_SIZE: 4
// BOX_COUNT: 10, BOX_SIZE: 30
```

---

*Document version: 1.0 — Update after each Phase 4.5.2+ change*
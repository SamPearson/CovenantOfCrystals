# Automated Test Infrastructure

This document describes the automated testing infrastructure that replaces the manual test plan procedures.

## Overview

The test suite is organized into three layers:

| Layer | Location | Purpose | Tools |
|-------|----------|---------|-------|
| **Unit** | `src/**/*.test.ts` | Pure logic (damage, CTB, scripting, status) | Vitest |
| **Integration** | `tests/integration/*.test.ts` | Headless battle runner, skill matrix | Vitest |
| **E2E** | `tests/e2e/*.spec.ts` | Script Editor UI, user flows | Playwright |

Run all tests:
```bash
npm run test          # Unit + Integration (Vitest)
npx playwright test   # E2E (requires `npm run dev` server)
```

---

## Test Fixtures (`tests/utils/test-fixtures.ts`)

Reusable profiles replacing the manual "Test Profile Setup" from the manual test plan.

### Available Profiles

```typescript
import { getTestProfile, PROFILE_FULL_UNLOCK } from './tests/utils/test-fixtures';

// Full unlock — all classes, level 10, max gold, all skills
const profile = getTestProfile('fullUnlock');

// Minimal — single knight, level 1
const profile = getTestProfile('minimal');

// Healer focus — dedicated healer + 3 DPS
const profile = getTestProfile('healerFocus');

// Reaction heavy — thorns, steal, guardian's vow
const profile = getTestProfile('reactionHeavy');

// Status test — pre-configured poison/burn/regen
const profile = getTestProfile('statusTest');

// Element coverage — one character per element
const profile = getTestProfile('elementCoverage');
```

### Creating Custom Characters

```typescript
import { createTestCharacter } from './tests/utils/test-fixtures';

const knight = createTestCharacter({
  classId: 'knight',
  level: 10,
  learnedSkills: ['slashing_strike', 'shield_bash'],
  loadout: ['slashing_strike', 'shield_bash'],
  scriptId: 'builtin.dps',
});
```

---

## Integration Test Helpers (`tests/utils/test-integration.ts`)

Headless battle runner for automating manual test procedures without Phaser.

### Creating Test Battles

```typescript
import { createTestBattle, TEST_AUTOBATTLE } from './tests/utils/test-integration';

// From profile character IDs
const battle = createTestBattle({
  player: 'c_knight',
  enemy: 'slime',
  seed: 1,
  enemyHpMultiplier: 10,  // High HP so enemy survives
});

// Multiple party members
const battle = createTestBattle({
  player: ['c_knight', 'c_mage', 'c_healer'],
  enemy: ['slime', 'goblin'],
});

// Custom character objects
const battle = createTestBattle({
  player: myCustomCharacter,
  enemy: myCustomEnemy,
});

// Pre-applied statuses
const battle = createTestBattle({
  player: 'c_knight',
  enemy: 'slime',
  initialStatuses: {
    'c_knight': [{ kind: 'poison', power: 5, duration: 3 }],
  },
});
```

### Testing Skill Usage

```typescript
import { testSkillUsage, expectStatus } from './tests/utils/test-integration';

const { log, battle, actor } = testSkillUsage(battle, 'c_knight', 'slashing_strike', {
  element: 'earth',           // Verify element in log
  mpCost: 4,                  // Verify MP deducted
  cooldown: 0,                // Verify cooldown applied
  minDamage: 40,              // Verify damage range
  maxDamage: 50,
  targetId: 'slime#0',        // Target for status checks
  statusApplied: {            // Verify status applied
    kind: 'statDebuff',
    stat: 'def',
    power: 0.8,
    minDuration: 2,
  },
}, rng);
```

### Element Weakness/Resistance Testing

```typescript
import { createElementTestBattle } from './tests/utils/test-integration';

// Fire skill vs Frost enemy (2× damage)
const battle = createElementTestBattle('fire', 'frost', { playerSkill: 'fireball' });

// Water skill vs Fire enemy (2× damage)
const battle = createElementTestBattle('water', 'fire', { playerSkill: 'frost_arrow' });
```

### Script Testing

```typescript
import { testScriptAction, runBattleWithScript, BUILT_IN_DPS } from './tests/utils/test-integration';

// Test script action selection in a context
const action = testScriptAction(customScript, battle, 'c_knight', rng);

// Run full battle with custom script
const finalBattle = runBattleWithScript(customScript, 'c_knight', {
  player: 'c_knight',
  enemy: 'slime',
});
```

---

## Skill Verification Tests (`tests/integration/skill-verification.test.ts`)

Automates **Manual Test Plan §1** — Skill Verification Matrix.

### What's Covered

| Section | Skills Tested | Assertions |
|---------|---------------|------------|
| 1.1 Active Damage | 23 skills | Element, MP, CD, weakness/resist, status effects |
| 1.2 Heal/Utility | 10 skills | Healing, cleanse, buffs, party-wide effects |
| 1.3 Passive | 4 skills | Battle-start application, party-wide |
| 1.4 Reaction | 3 skills | Trigger verification |
| 1.5 Enemy | 7 skills | Element, loadout presence |

### Running Specific Sections

```bash
# All skill verification tests
npx vitest run tests/integration/skill-verification.test.ts

# Only damage skills
npx vitest run -t "Active Damage Skills"

# Only passive skills
npx vitest run -t "Passive Skills"
```

---

## E2E Script Editor Tests (`tests/e2e/script-editor.spec.ts`)

Automates **Manual Test Plan §3.2** — Script Editor Panel.

### What's Covered

| Feature | Test |
|---------|------|
| New script → save → library | ✅ |
| Edit → add lines → persist | ✅ |
| Duplicate → new ID | ✅ |
| Delete → unassigned | ✅ |
| Import/Export JSON round-trip | ✅ |
| Validation errors block save | ✅ |
| Trigger conditions (7 types) | ✅ |
| Target selectors (8 types) | ✅ |
| Action sources/filters (9 types) | ✅ |
| If/else chains | ✅ |
| Reactions | ✅ |

### Running E2E Tests

```bash
# Start dev server first (in separate terminal)
npm run dev

# Then run Playwright
npx playwright test

# Or with UI
npx playwright test --ui
```

---

## Adding New Tests

### Unit Test (Pure Logic)

```typescript
// src/core/combat/my-new-logic.test.ts
import { describe, expect, it } from 'vitest';
import { myFunction } from './my-new-logic';

describe('myFunction', () => {
  it('does something', () => {
    expect(myFunction(1, 2)).toBe(3);
  });
});
```

### Integration Test (Battle Logic)

```typescript
// tests/integration/my-feature.test.ts
import { describe, expect, it } from 'vitest';
import { createTestBattle, testSkillUsage } from '../utils/test-integration';

describe('My Feature', () => {
  it('works in battle', () => {
    const battle = createTestBattle({ player: 'c_knight', enemy: 'slime' });
    const { log } = testSkillUsage(battle, 'c_knight', 'slashing_strike', {
      mpCost: 4,
    }, createRng(1));
    expect(log.some(l => l.includes('Slashing Strike'))).toBe(true);
  });
});
```

### E2E Test (UI Flow)

```typescript
// tests/e2e/my-panel.spec.ts
import { test, expect } from '@playwright/test';

test('my panel works', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("My Panel")');
  await expect(page.locator('.my-panel')).toBeVisible();
});
```

---

## Debugging Tips

### Vitest Debugging

```bash
# Run with verbose output
npx vitest run --reporter=verbose

# Run single test file with logging
npx vitest run tests/integration/skill-verification.test.ts --reporter=verbose

# Debug in VS Code: add breakpoint, run "Debug Test" from test explorer
```

### Playwright Debugging

```bash
# Headed mode (see browser)
npx playwright test --headed

# Debug mode (pause at each step)
npx playwright test --debug

# Trace viewer
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### Battle Log Inspection

```typescript
// In integration tests, inspect battle.log
const battle = createTestBattle({ player: 'c_knight', enemy: 'slime' });
// ... perform actions ...
console.log(battle.log.map(e => e.text).join('\n'));
```

---

## CI Configuration

### Vitest (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

### Playwright (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

---

## Migration from Manual Test Plan

| Manual Section | Automated Test |
|----------------|----------------|
| 0. Test Profile Setup | `getTestProfile('fullUnlock')` |
| 1. Skill Verification Matrix | `tests/integration/skill-verification.test.ts` |
| 2. Combat Timing/CTB | `src/core/combat/timeline.test.ts`, `battle.test.ts` |
| 3. Scripting System | Unit: `interpreter.test.ts`; E2E: `script-editor.spec.ts` |
| 4. Status Effects | `status.test.ts`, `battle.test.ts` |
| 5. Element System | `damage.test.ts`, integration skill tests |
| 6. Equipment/Items | `equip.test.ts`, `apply.test.ts` |
| 7. Run/Meta Loop | *Not yet automated* |
| 8. Autobattle Settings | *UI only — E2E candidate* |
| 9. Save/Load | `save.service.test.ts` |
| 10. Regression | `npm run test` (full suite) |
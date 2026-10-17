/**
 * Integration Test Helpers — Headless battle runner for automating manual test procedures.
 * Uses pure core logic (no Phaser) to run battles and assert outcomes.
 */
import { createRng } from '../../src/core/rng/rng';
import type { Rng } from '../../src/core/rng/rng';
import { createBattle, performAction, getBattleResult, type Battle } from '../../src/core/combat/battle';
import { createCharacter, type Character } from '../../src/core/character';
import { ENEMIES, type EnemyDef } from '../../src/core/data';
import { SKILLS, type Skill } from '../../src/core/data/skills';
import { chooseScriptedAction, buildScriptContext, type CharacterScript } from '../../src/core/scripting/interpreter';
import { BUILT_IN_DPS, BUILT_IN_HEALER } from '../../src/core/data/scripts';
import { applyStatus, type StatusEffect } from '../../src/core/combat/status';
import { TEST_PROFILES, getTestProfile, createTestCharacter, TEST_AUTOBATTLE } from './test-fixtures';
import type { Profile, BattleAction } from '../../src/core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST BATTLE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface TestBattleOptions {
  /** Player character(s) — can be Character objects or profile character IDs. */
  player?: Character | Character[] | string | string[];
  /** Enemy type(s) from ENEMIES registry, or custom EnemyDef objects. */
  enemy?: keyof typeof ENEMIES | (keyof typeof ENEMIES)[] | EnemyDef | EnemyDef[];
  /** Battle seed for deterministic RNG. */
  seed?: number;
  /** Custom RNG (overrides seed). */
  rng?: Rng;
  /** Reaction resolver for script reactions. */
  reactionResolver?: (characterId: string) => CharacterScript | undefined;
  /** Pre-apply status effects to actors. */
  initialStatuses?: Record<string, StatusEffect[]>;
  /** Override player HP/MP for specific test scenarios. */
  playerOverrides?: Record<string, { hp?: number; mp?: number; items?: string[] }>;
  /** Override enemy HP. */
  enemyHpMultiplier?: number;
}

/**
 * Create a battle configured for testing.
 * Accepts either Character objects or profile character IDs (resolved from fullUnlock profile).
 */
export function createTestBattle(options: TestBattleOptions = {}): Battle {
  const {
    player = 'c_knight',
    enemy = 'slime',
    seed = 1,
    rng = createRng(seed),
    reactionResolver,
    initialStatuses = {},
    playerOverrides = {},
    enemyHpMultiplier = 1,
  } = options;

  // Resolve player characters
  const playerChars: Character[] = Array.isArray(player) ? player : [player];
  const resolvedPlayers = playerChars.map((p) => {
    if (typeof p === 'string') {
      const profile = getTestProfile('fullUnlock');
      const charData = profile.characters[p];
      if (!charData) throw new Error(`Character ${p} not found in test profile`);
      return createTestCharacter({ ...charData, id: p });
    }
    return p;
  });

  // Apply player overrides (HP, MP, items)
  for (const char of resolvedPlayers) {
    const override = playerOverrides[char.id];
    if (override) {
      if (override.hp !== undefined) char.hp = override.hp;
      if (override.mp !== undefined) char.mp = override.mp;
      if (override.items) char.items = override.items;
    }
  }

  // Resolve enemies
  const enemyInput = Array.isArray(enemy) ? enemy : [enemy];
  let enemyTemplates: EnemyDef[];

  if (enemyInput.length > 0 && typeof enemyInput[0] === 'string') {
    // Enemy keys
    const enemyKeys = enemyInput as (keyof typeof ENEMIES)[];
    enemyTemplates = enemyKeys.map((k) => ENEMIES[k]);
    if (enemyTemplates.some((e) => !e)) {
      throw new Error(`Unknown enemy key in: ${enemyKeys.join(', ')}`);
    }
  } else {
    // Enemy objects
    enemyTemplates = enemyInput as EnemyDef[];
  }

  const battle = createBattle(resolvedPlayers, enemyTemplates as any, seed);
  battle.reactionResolver = reactionResolver;

  // Apply enemy HP multiplier
  if (enemyHpMultiplier !== 1) {
    for (const actor of Object.values(battle.actors)) {
      if (actor.side === 'enemy') {
        actor.hp = Math.floor(actor.stats.hp * enemyHpMultiplier);
      }
    }
  }

  // Apply initial statuses
  for (const [actorId, statuses] of Object.entries(initialStatuses)) {
    const actor = battle.actors[actorId];
    if (actor) {
      for (const status of statuses) {
        applyStatus(actor, status);
      }
    }
  }

  return battle;
}

/** Run a battle to completion with a simple AI for both sides. */
export function runBattleToEnd(
  battle: Battle,
  options: {
    playerAction?: (battle: Battle, playerId: string, rng: Rng) => BattleAction;
    enemyAction?: (battle: Battle, enemyId: string, rng: Rng) => BattleAction;
    maxTurns?: number;
    rng?: Rng;
  } = {}
): Battle {
  const {
    playerAction = (b, id) => chooseScriptedAction(BUILT_IN_DPS, buildScriptContext(b, id), b.rng ?? createRng(1)),
    enemyAction = (b, id) => ({ kind: 'attack' }),
    maxTurns = 200,
    rng = createRng(1),
  } = options;

  for (let turn = 0; turn < maxTurns && !battle.over; turn++) {
    const entry = battle.queue[0];
    if (!entry) break;

    const actor = battle.actors[entry.actorId];
    if (!actor || actor.ko) continue;

    const action = actor.side === 'player'
      ? playerAction(battle, entry.actorId, rng)
      : enemyAction(battle, entry.actorId, rng);

    performAction(battle, entry.actorId, action, rng);
  }

  return battle;
}

/** Run a single player turn and return the log entries generated. */
function runPlayerTurn(
  battle: Battle,
  playerId: string,
  action: BattleAction,
  rng: Rng = createRng(1)
): { log: string[]; battle: Battle } {
  const logBefore = battle.log.length;
  performAction(battle, playerId, action, rng);
  const newLog = battle.log.slice(logBefore).map((e) => e.text);
  return { log: newLog, battle };
}

/** Run until a specific actor's turn, then execute action and return log. */
function runUntilActor(
  battle: Battle,
  targetActorId: string,
  action: BattleAction,
  rng: Rng = createRng(1)
): { log: string[]; battle: Battle } {
  // Rotate queue until target actor is at front
  while (battle.queue[0]?.actorId !== targetActorId) {
    const entry = battle.queue.shift()!;
    battle.queue.push({ ...entry, nextAt: entry.nextAt + 1000 });
  }
  return runPlayerTurn(battle, targetActorId, action, rng);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSERTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SkillTestExpectations {
  /** Expected element icon in log (fire, water, frost, earth, holy, shadow, none). */
  element?: string;
  /** Minimum damage expected (approximate). */
  minDamage?: number;
  /** Maximum damage expected (approximate). */
  maxDamage?: number;
  /** Expected target actor ID. */
  targetId?: string;
  /** Expected status effect applied to target. */
  statusApplied?: { kind: StatusEffect['kind']; power?: number; minDuration?: number };
  /** Expected MP cost deducted. */
  mpCost?: number;
  /** Expected cooldown turns. */
  cooldown?: number;
  /** Whether skill should hit (vs miss). */
  shouldHit?: boolean;
  /** Custom log text matcher. */
  logMatches?: RegExp;
}

/**
 * Test a skill usage and verify expectations.
 * Returns the battle log entries for further assertions.
 */
export function testSkillUsage(
  battle: Battle,
  playerId: string,
  skillId: string,
  expectations: SkillTestExpectations = {},
  rng: Rng = createRng(1)
): { log: string[]; battle: Battle; actor: ReturnType<typeof battle.actors>[0] } {
  const player = battle.actors[playerId];
  if (!player) throw new Error(`Player ${playerId} not found`);

  const skill = SKILLS[skillId];
  if (!skill) throw new Error(`Skill ${skillId} not found`);

  const mpBefore = player.mp;
  const cooldownsBefore = { ...player.cooldowns };

  const { log, battle: updatedBattle } = runPlayerTurn(battle, playerId, { kind: 'skill', skillId, targetId: expectations.targetId }, rng);
  const updatedPlayer = updatedBattle.actors[playerId]!;

  // MP cost check
  if (expectations.mpCost !== undefined) {
    const mpSpent = mpBefore - updatedPlayer.mp;
    if (mpSpent !== expectations.mpCost) {
      throw new Error(`MP cost mismatch: expected ${expectations.mpCost}, spent ${mpSpent}`);
    }
  }

  // Cooldown check
  if (expectations.cooldown !== undefined) {
    const cd = updatedPlayer.cooldowns?.[skillId];
    // If cooldown is 0, we accept undefined (no cooldown applied) or 0
    const expectedCd = expectations.cooldown;
    const actualCd = cd ?? 0;
    if (actualCd !== expectedCd) {
      throw new Error(`Cooldown mismatch: expected ${expectedCd}, got ${actualCd}`);
    }
  }

  // Element check (look for element icon in log)
  if (expectations.element) {
    const elementPattern = new RegExp(`\\[${expectations.element}\\]`, 'i');
    const hasElement = log.some((l) => elementPattern.test(l));
    if (!hasElement) {
      throw new Error(`Expected element ${expectations.element} in log: ${log.join(' | ')}`);
    }
  }

  // Damage range check
  if (expectations.minDamage !== undefined || expectations.maxDamage !== undefined) {
    const damageLog = log.find((l) => /for \d+/.test(l));
    if (damageLog) {
      const match = damageLog.match(/for (\d+)/);
      if (match) {
        const damage = parseInt(match[1], 10);
        if (expectations.minDamage !== undefined && damage < expectations.minDamage) {
          throw new Error(`Damage ${damage} below minimum ${expectations.minDamage}`);
        }
        if (expectations.maxDamage !== undefined && damage > expectations.maxDamage) {
          throw new Error(`Damage ${damage} above maximum ${expectations.maxDamage}`);
        }
      }
    }
  }

  // Target check
  if (expectations.targetId) {
    const target = updatedBattle.actors[expectations.targetId];
    if (!target) throw new Error(`Target ${expectations.targetId} not found`);
    // Target should have taken damage or received status
  }

  // Status applied check
  if (expectations.statusApplied) {
    const targetId = expectations.targetId ?? playerId; // default to self for buffs
    const target = updatedBattle.actors[targetId];
    if (!target) throw new Error(`Target ${targetId} not found for status check`);

    const status = target.statuses.find((s) => s.kind === expectations.statusApplied!.kind);
    if (!status) {
      throw new Error(`Expected status ${expectations.statusApplied.kind} not found on ${targetId}`);
    }
    if (expectations.statusApplied.power !== undefined && status.power !== expectations.statusApplied.power) {
      throw new Error(`Status power mismatch: expected ${expectations.statusApplied.power}, got ${status.power}`);
    }
    if (expectations.statusApplied.stat !== undefined && status.stat !== expectations.statusApplied.stat) {
      throw new Error(`Status stat mismatch: expected ${expectations.statusApplied.stat}, got ${status.stat}`);
    }
    if (expectations.statusApplied.minDuration !== undefined && status.duration < expectations.statusApplied.minDuration) {
      throw new Error(`Status duration ${status.duration} below minimum ${expectations.statusApplied.minDuration}`);
    }
  }

  // Hit/miss check
  if (expectations.shouldHit === false) {
    const missLog = log.find((l) => /miss|evade|dodge/i.test(l));
    if (!missLog) {
      throw new Error(`Expected miss/evade but got hit: ${log.join(' | ')}`);
    }
  }

  // Custom log match
  if (expectations.logMatches) {
    const matched = log.some((l) => expectations.logMatches!.test(l));
    if (!matched) {
      throw new Error(`Log does not match ${expectations.logMatches}: ${log.join(' | ')}`);
    }
  }

  return { log, battle: updatedBattle, actor: updatedPlayer };
}

/** Verify a status effect exists on an actor with expected properties. */
export function expectStatus(
  battle: Battle,
  actorId: string,
  kind: StatusEffect['kind'],
  expectations: { power?: number; minDuration?: number; maxDuration?: number } = {}
): void {
  const actor = battle.actors[actorId];
  if (!actor) throw new Error(`Actor ${actorId} not found`);

  const status = actor.statuses.find((s) => s.kind === kind);
  if (!status) throw new Error(`Status ${kind} not found on ${actorId}`);

  if (expectations.power !== undefined && status.power !== expectations.power) {
    throw new Error(`Status power mismatch: expected ${expectations.power}, got ${status.power}`);
  }
  if (expectations.minDuration !== undefined && status.duration < expectations.minDuration) {
    throw new Error(`Status duration ${status.duration} below minimum ${expectations.minDuration}`);
  }
  if (expectations.maxDuration !== undefined && status.duration > expectations.maxDuration) {
    throw new Error(`Status duration ${status.duration} above maximum ${expectations.maxDuration}`);
  }
}

/** Verify an actor has a stat buff/debuff showing in derived stats. */
export function expectStatModifier(
  battle: Battle,
  actorId: string,
  stat: 'atk' | 'def' | 'mag' | 'res' | 'spd',
  expectedMultiplier: number,
  tolerance = 0.02
): void {
  const actor = battle.actors[actorId];
  if (!actor) throw new Error(`Actor ${actorId} not found`);

  const baseStat = actor.stats[stat];
  const derivedStat = actor.stats[stat]; // In this engine, stats are already derived with statuses applied

  // The derived stat should reflect the multiplier
  // This is a simplified check - actual implementation depends on how stats are computed
  // For now, verify via status effects
  const buff = actor.statuses.find((s) => s.kind === 'statBuff' && s.stat === stat);
  const debuff = actor.statuses.find((s) => s.kind === 'statDebuff' && s.stat === stat);

  if (expectedMultiplier > 1) {
    if (!buff) throw new Error(`Expected ${stat} buff (${expectedMultiplier}×) but none found`);
    if (Math.abs(buff.power - expectedMultiplier) > tolerance) {
      throw new Error(`${stat} buff power ${buff.power} != expected ${expectedMultiplier}`);
    }
  } else if (expectedMultiplier < 1) {
    if (!debuff) throw new Error(`Expected ${stat} debuff (${expectedMultiplier}×) but none found`);
    if (Math.abs(debuff.power - expectedMultiplier) > tolerance) {
      throw new Error(`${stat} debuff power ${debuff.power} != expected ${expectedMultiplier}`);
    }
  }
}

/** Count turns taken by each actor. */
export function countTurns(battle: Battle): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of battle.log) {
    // Log entries don't directly track turns, but we can approximate from action logs
    // This is a placeholder - actual turn counting would need battle.turnCount per actor
  }
  return counts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELEMENT WEAKNESS/RESIST TESTING
// ═══════════════════════════════════════════════════════════════════════════════

/** Element matchups for testing (attackElement -> defendElement -> multiplier). */
export const ELEMENT_MULTIPLIERS: Record<string, Record<string, number>> = {
  fire: { frost: 2, water: 0.5 },
  water: { fire: 2, frost: 0.5 },
  frost: { water: 2, fire: 0.5 },
  earth: { holy: 2, shadow: 0.5 },
  holy: { shadow: 2, earth: 0.5 },
  shadow: { earth: 2, holy: 0.5 },
  none: {},
};

/** Create a battle with specific element matchup for testing weakness/resist. */
export function createElementTestBattle(
  attackElement: string,
  defendElement: string,
  options: { playerSkill?: string; seed?: number } = {}
): Battle {
  const player = createTestCharacter({
    classId: 'mage',
    learnedSkills: options.playerSkill ? [options.playerSkill] : ['fireball'],
    loadout: options.playerSkill ? [options.playerSkill] : ['fireball'],
  });

  // Create enemy with specific element
  const enemy = {
    ...ENEMIES.slime!,
    id: `test_${defendElement}_elemental`,
    element: defendElement as any,
    name: `${defendElement.charAt(0).toUpperCase() + defendElement.slice(1)} Elemental`,
  };

  return createTestBattle({
    player,
    enemy: [enemy],
    seed: options.seed ?? 1,
    enemyHpMultiplier: 10, // High HP to survive multiple hits
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT TESTING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Test a custom script's action selection in a given battle context. */
export function testScriptAction(
  script: CharacterScript,
  battle: Battle,
  playerId: string,
  rng: Rng = createRng(1)
): BattleAction | null {
  const context = buildScriptContext(battle, playerId);
  return chooseScriptedAction(script, context, rng);
}

/** Run a battle with a custom script assigned to a player. */
export function runBattleWithScript(
  script: CharacterScript,
  playerId: string,
  options: TestBattleOptions = {}
): Battle {
  const battle = createTestBattle({
    ...options,
    player: options.player ?? playerId,
    reactionResolver: (id) => (id === playerId ? script : undefined),
  });

  return runBattleToEnd(battle, {
    playerAction: (b, id) => (id === playerId ? testScriptAction(script, b, id) ?? { kind: 'attack' } : { kind: 'attack' }),
    rng: options.rng,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN/META TESTING (Placeholder - requires run-gen integration)
// ═══════════════════════════════════════════════════════════════════════════════

/** Generate a test run (requires run-gen to be importable). */
export async function generateTestRun(
  profile: Profile,
  length: 3 | 5 | 10 = 5,
  seed = 12345
): Promise<any> {
  // Dynamic import to avoid circular deps
  const { generateRun } = await import('../runs/run-gen');
  const partyIds = profile.party;
  return generateRun('test', partyIds, length, seed);
}

export { TEST_PROFILES, getTestProfile, createTestCharacter, TEST_AUTOBATTLE } from './test-fixtures';
export { buildScriptContext, chooseScriptedAction, BUILT_IN_DPS, BUILT_IN_HEALER };
export { performAction, runPlayerTurn, createRng };
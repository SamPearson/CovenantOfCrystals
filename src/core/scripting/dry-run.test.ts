/**
 * Phase 4.5.2 M5 — dry-run tests. The dry-run must walk the exact interpreter
 * and reaction paths battle uses (shared code, distinct entry points). These
 * tests assert parity with chooseScriptedAction/checkReactions, the mock
 * overrides, the rule card index, and the would-consume signal.
 */

import { describe, it, expect } from 'vitest'
import { createCharacter } from '../character'
import { ENEMIES } from '../data'
import { chooseScriptedAction, buildScriptContext } from './interpreter'
import type { CharacterScript, ScriptBlock, ScriptLine, TargetRule, SkillSelector, Trigger } from './types'
import { checkReactions } from '../combat/reactions'
import type { BattleEvent } from '../combat/types'
import {
  applyDryRunMocks,
  createDryRunBattle,
  dryRunCheckReactions,
  dryRunChooseAction,
  ruleCardIndex,
} from './dry-run'

function makeCharacter() {
  return createCharacter({ classId: 'knight', name: 'Aria' })
}

function line(p: { id?: string; trigger?: Trigger; target: TargetRule; action: SkillSelector }): ScriptLine {
  return { id: p.id ?? 'l', target: p.target, action: p.action, ...(p.trigger ? { trigger: p.trigger } : {}) }
}

function block(p: Partial<ScriptBlock> & { lines?: ScriptLine[]; nested?: ScriptBlock[] } = {}): ScriptBlock {
  return {
    id: p.id ?? 'root',
    depth: p.depth ?? 0,
    lines: p.lines ?? [],
    nested: p.nested ?? [],
    ...(p.trigger ? { trigger: p.trigger } : {}),
  }
}

function script(p: Partial<CharacterScript> & { rootBlock: ScriptBlock }): CharacterScript {
  return {
    id: p.id ?? 's',
    name: p.name ?? 's',
    rootBlock: p.rootBlock,
    reactions: p.reactions ?? [],
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('createDryRunBattle (phase 4.5.2, M5)', () => {
  it('is the shared createBattle path — same actors and queue', () => {
    const aria = makeCharacter()
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    expect(Object.keys(battle.actors)).toEqual([aria.id, 'slime#0'])
    expect(battle.queue).toHaveLength(2)
    expect(battle.status).toBe('ongoing')
    expect(battle.over).toBe(false)
  })
})

describe('applyDryRunMocks (phase 4.5.2, M5)', () => {
  const attacked: import('./types').Condition = { kind: 'hp-pct', scope: 'self', op: '<', value: 0.5 }

  it('applies HP/MP fractions and clamps them to [0, max]', () => {
    const aria = makeCharacter()
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    const who = battle.actors[aria.id]!
    applyDryRunMocks(battle, {
      [aria.id]: { hpFraction: 0.25, mpFraction: 2 },
      'slime#0': { hpFraction: -1, mpFraction: 0.5 },
    })
    expect(who.hp).toBe(Math.round(who.stats.hp * 0.25))
    expect(who.mp).toBe(who.maxMp)
    const slime = battle.actors['slime#0']!
    expect(slime.hp).toBe(0)
    expect(slime.mp).toBe(0)
  })

  it('applies statuses, items, cooldowns, and the turn counter', () => {
    const aria = makeCharacter()
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    const who = battle.actors[aria.id]!
    applyDryRunMocks(battle, {
      [aria.id]: {
        statuses: ['burn', 'shield'],
        items: ['health_potion'],
        cooldowns: { slashing_strike: 2 },
        turnCount: 7,
      },
    })
    expect(who.statuses.map((s) => s.kind)).toEqual(['burn', 'shield'])
    expect(who.statuses.every((s) => s.duration === 999)).toBe(true)
    expect(who.items).toEqual(['health_potion'])
    expect(who.cooldowns).toEqual({ slashing_strike: 2 })
    expect(battle.turnCount).toBe(7)
  })

  it('is idempotent and ignores unknown actor ids', () => {
    const aria = makeCharacter()
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    const who = battle.actors[aria.id]!
    const hp = who.hp
    applyDryRunMocks(battle, { ghost: { hpFraction: 0.5 } })
    expect(who.hp).toBe(hp)
    applyDryRunMocks(battle, { [aria.id]: { hpFraction: 0.5 } })
    applyDryRunMocks(battle, { [aria.id]: { hpFraction: 0.5 } })
    expect(who.hp).toBe(Math.round(who.stats.hp * 0.5))
  })

  it('respects a mocked hp trigger through the turn walk', () => {
    const s = script({
      rootBlock: block({
        lines: [
          line({
            id: 'l1',
            trigger: { conditions: [attacked], operator: 'AND' },
            target: { kind: 'lowest-hp-enemy' },
            action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'slashing_strike' }] },
          }),
        ],
      }),
    })
    const aria = makeCharacter()
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    expect(dryRunChooseAction(battle, aria.id, s)).toMatchObject({ fromFallback: true })
    applyDryRunMocks(battle, { [aria.id]: { hpFraction: 0.1 } })
    const hit = dryRunChooseAction(battle, aria.id, s)
    expect(hit.fromFallback).toBe(false)
    expect(hit.ruleIndex).toBe(0)
    expect(hit.blockDepth).toBe(0)
    expect(hit.action).toEqual({ kind: 'skill', skillId: 'slashing_strike', targetId: 'slime#0' })
  })
})

describe('dryRunChooseAction parity (phase 4.5.2, M5)', () => {
  it('returns exactly what chooseScriptedAction would in real battle', () => {
    const s = script({
      rootBlock: block({
        lines: [
          line({
            id: 'l1',
            target: { kind: 'lowest-hp-enemy' },
            action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'slashing_strike' }] },
          }),
        ],
      }),
    })
    const aria = makeCharacter()
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    applyDryRunMocks(battle, { [aria.id]: { hpFraction: 0.4, turnCount: 3 } })
    const expected = chooseScriptedAction(s, buildScriptContext(battle, aria.id), undefined)
    const actual = dryRunChooseAction(battle, aria.id, s)
    expect(actual.action).toEqual(expected)
    expect(actual.fromFallback).toBe(expected === null)
  })

  it('reports the fall-through and a would-consume item id', () => {
    const s = script({
      rootBlock: block({
        lines: [
          line({
            id: 'l1',
            trigger: { conditions: [{ kind: 'hp-pct', scope: 'self', op: '<', value: 0.01 }], operator: 'AND' },
            target: { kind: 'self' },
            action: { source: 'items', filters: [{ kind: 'byId', skillId: 'health_potion' }] },
          }),
        ],
      }),
    })
    const aria = makeCharacter()
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    applyDryRunMocks(battle, { [aria.id]: { items: ['health_potion'], hpFraction: 0.1 } })
    const miss = dryRunChooseAction(battle, aria.id, s)
    expect(miss.fromFallback).toBe(true)
    expect(miss.ruleIndex).toBe(-1)
    expect(miss.action).toEqual({ kind: 'attack', targetId: 'slime#0' })
    expect(miss.wouldConsumeItemId).toBeUndefined()
    applyDryRunMocks(battle, { [aria.id]: { hpFraction: 0.005 } })
    const drink = dryRunChooseAction(battle, aria.id, s)
    expect(drink.action).toEqual({ kind: 'item', itemId: 'health_potion', targetId: aria.id })
    expect(drink.wouldConsumeItemId).toBe('health_potion')
    expect(drink.ruleIndex).toBe(0)
  })

  it('walks nested blocks and reports their card index and depth', () => {
    const s = script({
      rootBlock: block({
        lines: [
          line({
            id: 'l1',
            trigger: { conditions: [{ kind: 'mp-pct', scope: 'self', op: '>', value: 1 }], operator: 'AND' },
            target: { kind: 'self' },
            action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] },
          }),
        ],
        nested: [
          block({
            id: 'b1',
            depth: 1,
            lines: [
              line({
                id: 'l2',
                trigger: { conditions: [{ kind: 'enemy-count', op: '>=', value: 1 }], operator: 'AND' },
                target: { kind: 'highest-threat-enemy' },
                action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'slashing_strike' }] },
              }),
            ],
          }),
        ],
      }),
    })
    const aria = makeCharacter()
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    expect(ruleCardIndex(s, 'l1')).toBe(0)
    expect(ruleCardIndex(s, 'l2')).toBe(1)
    expect(ruleCardIndex(s, 'ghost')).toBe(-1)
    const pick = dryRunChooseAction(battle, aria.id, s)
    expect(pick.ruleIndex).toBe(1)
    expect(pick.blockDepth).toBe(1)
    expect(pick.action).toEqual({ kind: 'skill', skillId: 'slashing_strike', targetId: 'slime#0' })
  })
})

describe('dryRunCheckReactions parity (phase 4.5.2, M5)', () => {
  it('returns exactly what checkReactions would for a mocked event stream', () => {
    const aria = makeCharacter()
    aria.loadout = ['thorns']
    const s = script({
      rootBlock: block(),
      reactions: [
        {
          id: 'r1',
          gate: { kind: 'attacked', source: 'enemy', target: 'self' },
          target: { kind: 'attacker' },
          action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'thorns' }] },
        },
      ],
    })
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    const event: BattleEvent = { kind: 'attacked', actorId: aria.id, sourceId: 'slime#0' }
    const getScript = (characterId: string) => (characterId === aria.id ? s : undefined)
    const expected = checkReactions(battle, event, undefined, getScript)
    const actual = dryRunCheckReactions(battle, event, undefined, getScript)
    expect(actual).toEqual(expected)
    expect(actual).toHaveLength(1)
    expect(actual[0]).toMatchObject({ id: 'r1', actorId: aria.id, kind: 'skill', skillId: 'thorns', targetId: 'slime#0' })
  })

  it('produces no plans when the gate does not match, mirroring checkReactions', () => {
    const aria = makeCharacter()
    aria.loadout = ['thorns']
    const s = script({
      rootBlock: block(),
      reactions: [
        {
          id: 'r1',
          gate: { kind: 'attacked', source: 'enemy', target: 'self' },
          target: { kind: 'attacker' },
          action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'thorns' }] },
        },
      ],
    })
    const battle = createDryRunBattle([aria], [ENEMIES.slime!], 1)
    const getScript = (characterId: string) => (characterId === aria.id ? s : undefined)
    const friendly: BattleEvent = { kind: 'attacked', actorId: aria.id, sourceId: aria.id }
    const actual = dryRunCheckReactions(battle, friendly, undefined, getScript)
    expect(actual).toEqual(checkReactions(battle, friendly, undefined, getScript))
    expect(actual).toHaveLength(0)
  })
})

describe('ruleCardIndex (phase 4.5.2, M5)', () => {
  it('indexes depth-first through lines and nested blocks', () => {
    const s = script({
      rootBlock: block({
        lines: [line({ id: 'a', target: { kind: 'self' }, action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] } })],
        nested: [
          block({
            id: 'x',
            depth: 1,
            lines: [line({ id: 'b', target: { kind: 'self' }, action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] } })],
            nested: [block({ id: 'y', depth: 2, lines: [line({ id: 'c', target: { kind: 'self' }, action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] } })] })],
          }),
        ],
      }),
    })
    expect(ruleCardIndex(s, 'a')).toBe(0)
    expect(ruleCardIndex(s, 'b')).toBe(1)
    expect(ruleCardIndex(s, 'c')).toBe(2)
    expect(ruleCardIndex(s, 'nope')).toBe(-1)
  })
})
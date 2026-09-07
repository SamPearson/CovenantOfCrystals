/**
 * Phase 4.5.2 M1 — interpreter tests. Covers trigger evaluation (1/2/3
 * conditions, AND/OR), line matching (first-true, fall-through on empty
 * resolve), the locked fallback (explicit and default), nested blocks, every
 * condition and target kind (including stat-compare, weak-to, enemy-rank, and
 * event-relative scopes resolving empty in turn context), skill selectors
 * (skills + items), seeded-random action selection, and the built-in dps/healer
 * scripts matching the Phase 4 M1 preset code.
 */

import { describe, it, expect } from 'vitest'
import type { Rng } from '../rng/rng'
import { createRng } from '../rng/rng'
import type { ActiveStatusKind } from '../combat/types'
import type { BattleAction } from '../combat/types'
import { chooseAction } from '../combat/ai'
import { getPlayerAiScript } from '../data/ai-presets'
import type { AiBattlefield, AiActorState } from '../combat/ai'
import { chooseScriptedAction, validateScriptDepth } from './interpreter'
import type {
  CharacterScript,
  Condition,
  InterpreterContext,
  ScriptActorSnapshot,
  TargetRule,
  SkillSelector,
  ScriptBlock,
  ScriptLine,
  Trigger,
} from './types'
import { BUILT_IN_DPS, BUILT_IN_HEALER } from '../data/scripts'

const rng: Rng = () => 0.42

const STATS = { hp: 100, atk: 10, def: 10, mag: 10, res: 10, spd: 10 } as const

function actor(p: Partial<ScriptActorSnapshot> & { id: string }): ScriptActorSnapshot {
  return {
    id: p.id,
    hp: p.hp ?? 100,
    maxHp: p.maxHp ?? 100,
    mp: p.mp ?? 50,
    maxMp: p.maxMp ?? 50,
    statuses: p.statuses ?? [],
    stats: p.stats ?? { ...STATS },
    baseStats: p.baseStats ?? p.stats ?? { ...STATS },
    element: p.element ?? 'none',
    rank: p.rank,
    skills: p.skills ?? ['slash', 'fireball'],
    cooldowns: p.cooldowns ?? {},
    skillCosts: p.skillCosts ?? { slash: 4, fireball: 6 },
    items: p.items ?? [],
  }
}

function baseCtx(overrides: Partial<InterpreterContext> = {}): InterpreterContext {
  const self = overrides.self ?? actor({ id: 'self' })
  return {
    self,
    allies: overrides.allies ?? [self],
    enemies: overrides.enemies ?? [actor({ id: 'foe', hp: 30, maxHp: 100 })],
    turnCount: overrides.turnCount ?? 1,
    attackerId: overrides.attackerId,
    triggerTargetId: overrides.triggerTargetId,
    previousTriggerTargetId: overrides.previousTriggerTargetId,
  }
}

function line(p: { id?: string; trigger?: Trigger; target: TargetRule; action: SkillSelector }): ScriptLine {
  return { id: p.id ?? 'l', target: p.target, action: p.action, ...(p.trigger ? { trigger: p.trigger } : {}) }
}

function block(p: Partial<ScriptBlock> & { lines?: ScriptLine[]; nested?: ScriptBlock[] }): ScriptBlock {
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
    createdAt: p.createdAt ?? 0,
    updatedAt: p.updatedAt ?? 0,
    fallback: p.fallback,
  }
}

const attackLine = (trigger?: Trigger, target: TargetRule = { kind: 'self' }): ScriptLine =>
  line({
    ...(trigger ? { trigger } : {}),
    target,
    action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] },
  })

const defendLine = (trigger?: Trigger, target: TargetRule = { kind: 'self' }): ScriptLine =>
  line({
    ...(trigger ? { trigger } : {}),
    target,
    action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'defend' }] },
  })

const trig = (conditions: Condition[], operator: ScriptOperator = 'AND'): Trigger => ({ conditions, operator })
const cond = (c: Condition): Condition => c

// ---------------------------------------------------------------------------
describe('M1 — trigger evaluation', () => {
  it('line with no trigger is always true', () => {
    const ctx = baseCtx()
    const s = script({ rootBlock: block({ lines: [defendLine()] }) })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'defend' })
  })

  it('single condition uses AND regardless of operator', () => {
    const ctx = baseCtx()
    const s = script({
      rootBlock: block({
        lines: [defendLine(trig([cond({ kind: 'always' })], 'OR'))],
      }),
    })
    expect(chooseScriptedAction(s, ctx, rng)?.kind).toBe('defend')
  })

  it('two conditions combined AND require both true', () => {
    const ctx = baseCtx({ self: actor({ id: 'self', hp: 30 }) })
    const tAnd = trig([cond({ kind: 'hp-pct', scope: 'self', op: '<', value: 0.5 }), cond({ kind: 'can-cast' })], 'AND')
    const tOr = trig([cond({ kind: 'hp-pct', scope: 'self', op: '<', value: 0.5 }), cond({ kind: 'can-cast' })], 'OR')
    const mk = (t: Trigger) => script({ rootBlock: block({ lines: [defendLine(t)] }) })
    expect(chooseScriptedAction(mk(tAnd), ctx, rng)?.kind).toBe('defend')
    expect(chooseScriptedAction(mk(tOr), ctx, rng)?.kind).toBe('defend')
    const high = baseCtx({ self: actor({ id: 'self', hp: 90 }) })
    expect(chooseScriptedAction(mk(tAnd), high, rng)).toEqual({ kind: 'attack', targetId: 'foe' })
    expect(chooseScriptedAction(mk(tOr), high, rng)?.kind).toBe('defend')
  })

  it('three conditions honor AND', () => {
    const ctx = baseCtx({ self: actor({ id: 'self', mp: 0 }), enemies: [actor({ id: 'f', hp: 10 })] })
    const t = trig([
      cond({ kind: 'enemy-count', op: '>', value: 0 }),
      cond({ kind: 'can-cast' }),
      cond({ kind: 'always' }),
    ], 'AND')
    const s = script({ rootBlock: block({ lines: [defendLine(t)] }) })
    // can-cast is false (mp 0) -> AND fails -> locked default fallback acts instead
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'attack', targetId: 'f' })
  })
})

describe('M1 — line matching & fallback', () => {
  it('first-true line wins', () => {
    const ctx = baseCtx()
    const s = script({
      rootBlock: block({
        lines: [attackLine(undefined, { kind: 'self' }), defendLine()],
      }),
    })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'attack', targetId: 'self' })
  })

  it('line falls through when target resolves empty', () => {
    const ctx = baseCtx({ enemies: [] })
    const s = script({
      rootBlock: block({
        lines: [attackLine(undefined, { kind: 'lowest-hp-enemy' }), defendLine()],
      }),
    })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'defend' })
  })

  it('line falls through when no skill matches', () => {
    const ctx = baseCtx({ self: actor({ id: 'self', skills: ['slash'], skillCosts: { slash: 4 } }) })
    const s = script({
      rootBlock: block({
        lines: [
          line({ target: { kind: 'self' }, action: { source: 'skills', filters: [{ kind: 'byKind', skillKind: 'heal' }] } }),
          defendLine(),
        ],
      }),
    })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'defend' })
  })

  it('explicit fallback defends', () => {
    const ctx = baseCtx({ self: actor({ id: 'self', mp: 0 }), enemies: [actor({ id: 'f', hp: 10 })] })
    const s = script({
      rootBlock: block({
        lines: [defendLine(trig([cond({ kind: 'never' })]))],
      }),
      fallback: defendLine(undefined, { kind: 'self' }),
    })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'defend' })
  })

  it('default fallback: basic attack at the lowest-HP enemy', () => {
    const ctx = baseCtx({ self: actor({ id: 'self', mp: 0 }), enemies: [actor({ id: 'e1', hp: 50 }), actor({ id: 'e2', hp: 5 })] })
    const s = script({
      rootBlock: block({
        lines: [defendLine(trig([cond({ kind: 'never' })]))],
      }),
    })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'attack', targetId: 'e2' })
  })
})

describe('M1 — nested blocks (depth 3)', () => {
  it('parent trigger fires -> child line resolves', () => {
    const ctx = baseCtx()
    const child: ScriptBlock = block({
      id: 'c',
      depth: 1,
      trigger: trig([cond({ kind: 'always' })]),
      lines: [defendLine()],
    })
    const s = script({ rootBlock: block({ nested: [child] }) })
    expect(chooseScriptedAction(s, ctx, rng)?.kind).toBe('defend')
  })

  it('parent trigger false -> nested skipped', () => {
    const ctx = baseCtx()
    const child: ScriptBlock = block({
      id: 'c',
      depth: 1,
      trigger: trig([cond({ kind: 'never' })]),
      lines: [defendLine()],
    })
    const s = script({ rootBlock: block({ nested: [child] }) })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'attack', targetId: 'foe' })
  })

  it('sibling rule still runs after nested block falls through', () => {
    const ctx = baseCtx({ self: actor({ id: 'self', mp: 0 }) })
    const child: ScriptBlock = block({
      id: 'c',
      depth: 1,
      trigger: trig([cond({ kind: 'never' })]),
      lines: [defendLine()],
    })
    const s = script({ rootBlock: block({ lines: [defendLine()], nested: [child] }) })
    expect(chooseScriptedAction(s, ctx, rng)?.kind).toBe('defend')
  })

  it('depth 3 valid, depth 4 refused by validator', () => {
    const grandchild: ScriptBlock = block({ id: 'gc', depth: 2, lines: [] })
    const child: ScriptBlock = block({ id: 'c', depth: 1, nested: [grandchild] })
    const s = script({ rootBlock: block({ nested: [child] }) })
    expect(() => validateScriptDepth(s)).not.toThrow()

    const bad: ScriptBlock = block({ id: 'gc2', depth: 2, nested: [block({ id: 'g2', depth: 3 as 0 | 1 | 2, lines: [] })] })
    const childBad: ScriptBlock = block({ id: 'cb', depth: 1, nested: [bad] })
    const sBad = script({ rootBlock: block({ nested: [childBad] }) })
    expect(() => validateScriptDepth(sBad)).toThrow()
  })

  it('validator refuses trigger with 0 or more than 3 conditions', () => {
    const s0 = script({ rootBlock: block({ trigger: { conditions: [], operator: 'AND' }, lines: [] }) })
    expect(() => validateScriptDepth(s0)).toThrow()
    const s4 = script({
      rootBlock: block({
        lines: [
          line({
            trigger: {
              conditions: [
                cond({ kind: 'always' }),
                cond({ kind: 'always' }),
                cond({ kind: 'always' }),
                cond({ kind: 'always' }),
              ],
              operator: 'AND' as const,
            },
            target: { kind: 'self' },
            action: { source: 'skills', filters: [] },
          }),
        ],
      }),
    })
    expect(() => validateScriptDepth(s4)).toThrow()
  })
})

describe('M1 — conditions vocabulary', () => {
  const cases: Array<[Condition, Partial<InterpreterContext> & { self?: ScriptActorSnapshot }, boolean]> = [
    [{ kind: 'hp-pct', scope: 'self', op: '<', value: 0.5 }, { self: actor({ id: 's', hp: 30, maxHp: 100 }) }, true],
    [{ kind: 'hp-pct', scope: 'any-ally', op: '<', value: 0.6 }, { allies: [actor({ id: 'a' }), actor({ id: 'b', hp: 30 })] }, true],
    [{ kind: 'hp-pct', scope: 'all-allies', op: '>', value: 0.9 }, { allies: [actor({ id: 'a', hp: 95 }), actor({ id: 'b', hp: 80 })] }, false],
    [{ kind: 'hp-pct', scope: 'lowest-hp-ally', op: '<', value: 0.5 }, { allies: [actor({ id: 'a', hp: 95 }), actor({ id: 'b', hp: 30 })] }, true],
    [{ kind: 'mp-pct', scope: 'self', op: '>=', value: 1 }, { self: actor({ id: 's', mp: 50, maxMp: 50 }) }, true],
    [{ kind: 'stat-compare', scope: 'self', stat: 'atk', op: '>=', value: 18 }, { self: actor({ id: 's', stats: { ...STATS, atk: 20 } }) }, true],
    [{ kind: 'stat-compare', scope: 'self', stat: 'atk', op: '>=', value: 0.5, ofCurrent: true }, { self: actor({ id: 's', stats: { ...STATS, atk: 20 }, baseStats: { ...STATS, atk: 10 } }) }, true],
    [{ kind: 'stat-compare', scope: 'self', stat: 'atk', op: '<', value: 0.6, ofCurrent: true }, { self: actor({ id: 's', stats: { ...STATS, atk: 20 }, baseStats: { ...STATS, atk: 10 } }) }, false],
    [{ kind: 'weak-to', scope: 'any-enemy', element: 'fire' }, { enemies: [actor({ id: 'e', element: 'frost' })] }, true],
    [{ kind: 'weak-to', scope: 'any-enemy', element: 'fire' }, { enemies: [actor({ id: 'e', element: 'water' })] }, false],
    [{ kind: 'enemy-rank', scope: 'any-enemy', ranks: ['boss'], present: true }, { enemies: [actor({ id: 'e', rank: 'boss' })] }, true],
    [{ kind: 'enemy-rank', scope: 'any-enemy', ranks: ['boss'], present: true }, { enemies: [actor({ id: 'e' })] }, false],
    [{ kind: 'has-status', scope: 'self', status: 'poison' as ActiveStatusKind, present: true }, { self: actor({ id: 's', statuses: ['poison' as ActiveStatusKind] }) }, true],
    [{ kind: 'has-status', scope: 'self', status: 'poison' as ActiveStatusKind, present: false }, { self: actor({ id: 's', statuses: ['burn' as ActiveStatusKind] }) }, true],
    [{ kind: 'ally-count', op: '==', value: 2 }, { allies: [actor({ id: 'a' }), actor({ id: 'b' })] }, true],
    [{ kind: 'enemy-count', op: '>', value: 1 }, { enemies: [actor({ id: 'e1' }), actor({ id: 'e2' })] }, true],
    [{ kind: 'turn-count', op: '>=', value: 3 }, { turnCount: 3 }, true],
    [{ kind: 'turn-mod', mod: 3, equals: 0 }, { turnCount: 6 }, true],
    [{ kind: 'cooldown-ready', skillId: 'slash' }, { self: actor({ id: 's', skills: ['slash'], cooldowns: {} }) }, true],
    [{ kind: 'can-cast', skillId: 'slash' }, { self: actor({ id: 's', skills: ['slash'], skillCosts: { slash: 4 }, mp: 10 }) }, true],
    [{ kind: 'can-cast' }, { self: actor({ id: 's', skills: ['slash'], skillCosts: { slash: 4 }, mp: 10 }) }, true],
    [{ kind: 'has-item', itemId: 'health_potion' }, { self: actor({ id: 's', items: ['health_potion'] }) }, true],
    [{ kind: 'not', condition: { kind: 'always' } }, {}, false],
    [{ kind: 'and', conditions: [{ kind: 'always' }, { kind: 'never' }] }, {}, false],
    [{ kind: 'or', conditions: [{ kind: 'never' }, { kind: 'always' }] }, {}, true],
  ]
  for (const [condition, partial, expected] of cases) {
    it(`condition ${JSON.stringify(condition)} -> ${expected}`, () => {
      const ctx = baseCtx(partial)
      const s = script({
        rootBlock: block({
          lines: [defendLine(trig([cond(condition)]))],
        }),
      })
      const got = chooseScriptedAction(s, ctx, rng)
      expect(got === null ? false : got.kind === 'defend').toBe(expected)
    })
  }

  it('event-relative conditions resolve false in turn context', () => {
    const ctx = baseCtx()
    const s = script({
      rootBlock: block({
        lines: [
          line({
            trigger: { conditions: [{ kind: 'has-status', scope: 'attacker', status: 'poison' as ActiveStatusKind, present: true }], operator: 'AND' },
            target: { kind: 'self' },
            action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'defend' }] },
          }),
        ],
      }),
    })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'attack', targetId: 'foe' })
  })
})

describe('M1 — target rules', () => {
  it('lowest / highest hp enemy resolve to correct ids', () => {
    const enemies = [actor({ id: 'e1', hp: 50 }), actor({ id: 'e2', hp: 10 }), actor({ id: 'e3', hp: 80 })]
    const ctx = baseCtx({ enemies })
    const lowest = script({ rootBlock: block({ lines: [attackLine(undefined, { kind: 'lowest-hp-enemy' })] }) })
    const highest = script({ rootBlock: block({ lines: [attackLine(undefined, { kind: 'highest-hp-enemy' })] }) })
    expect(chooseScriptedAction(lowest, ctx, rng)?.targetId).toBe('e2')
    expect(chooseScriptedAction(highest, ctx, rng)?.targetId).toBe('e3')
  })

  it('highest-threat-enemy resolves to the living enemy with the highest atk', () => {
    const enemies = [actor({ id: 'e1', stats: { ...STATS, atk: 15 } }), actor({ id: 'e2', stats: { ...STATS, atk: 25 } })]
    const ctx = baseCtx({ enemies })
    const s = script({ rootBlock: block({ lines: [attackLine(undefined, { kind: 'highest-threat-enemy' })] }) })
    expect(chooseScriptedAction(s, ctx, rng)?.targetId).toBe('e2')
  })

  it('all-enemies yields undefined targetId', () => {
    const ctx = baseCtx({ enemies: [actor({ id: 'e1' }), actor({ id: 'e2' })] })
    const s = script({ rootBlock: block({ lines: [attackLine(undefined, { kind: 'all-enemies' })] }) })
    expect(chooseScriptedAction(s, ctx, rng)?.targetId).toBeUndefined()
  })

  it('event-relative targets resolve empty in turn context (falls through)', () => {
    const ctx = baseCtx()
    const s = script({ rootBlock: block({ lines: [attackLine(undefined, { kind: 'attacker' })] }) })
    expect(chooseScriptedAction(s, ctx, rng)).toEqual({ kind: 'attack', targetId: 'foe' })
  })

  it('target narrowing filters by condition', () => {
    const enemies = [actor({ id: 'e1', hp: 50 }), actor({ id: 'e2', hp: 10, statuses: ['poison' as ActiveStatusKind] })]
    const ctx = baseCtx({ enemies })
    const s = script({
      rootBlock: block({
        lines: [
          line({
            target: { kind: 'lowest-hp-enemy', condition: { kind: 'has-status', scope: 'self', status: 'poison' as ActiveStatusKind, present: true } },
            action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] },
          }),
        ],
      }),
    })
    expect(chooseScriptedAction(s, ctx, rng)?.targetId).toBe('e2')
  })
})

describe('M1 — skill selector (skills + items)', () => {
  it('no filters selects the first known skill', () => {
    const ctx = baseCtx()
    const s = script({ rootBlock: block({ lines: [line({ target: { kind: 'self' }, action: { source: 'skills', filters: [] } })] }) })
    expect(chooseScriptedAction(s, ctx)).toEqual({ kind: 'skill', skillId: 'slash', targetId: 'self' })
  })

  it('byKind filter picks a matching skill', () => {
    const ctx = baseCtx({ self: actor({ id: 'self', skills: ['fireball', 'backstab'], skillCosts: { fireball: 6, backstab: 5 } }) })
    const s = script({
      rootBlock: block({
        lines: [
          line({ target: { kind: 'self' }, action: { source: 'skills', filters: [{ kind: 'byKind', skillKind: 'damage' }] } }),
        ],
      }),
    })
    expect(chooseScriptedAction(s, ctx)).toEqual({ kind: 'skill', skillId: 'fireball', targetId: 'self' })
  })

  it('without rng the first match wins; multiple matches are seed-deterministic with rng', () => {
    const ctx = baseCtx({ self: actor({ id: 's', skills: ['fireball', 'backstab'], skillCosts: { fireball: 6, backstab: 5 }, mp: 20 }) })
    const s = script({
      rootBlock: block({
        lines: [
          line({ target: { kind: 'self' }, action: { source: 'skills', filters: [{ kind: 'byKind', skillKind: 'damage' }] } }),
        ],
      }),
    })
    const deterministic = chooseScriptedAction(s, ctx)
    expect(deterministic).toEqual({ kind: 'skill', skillId: 'fireball', targetId: 's' })
    const a = chooseScriptedAction(s, ctx, createRng(42))
    const b = chooseScriptedAction(s, ctx, createRng(42))
    expect(a).not.toBeNull()
    expect(a).toEqual(b)
  })

  it('items source selects and reports item action', () => {
    const ctx = baseCtx({ self: actor({ id: 's', items: ['health_potion'] }) })
    const s = script({
      rootBlock: block({
        lines: [line({ target: { kind: 'self' }, action: { source: 'items', filters: [{ kind: 'byId', skillId: 'health_potion' }] } })],
      }),
    })
    expect(chooseScriptedAction(s, ctx)).toEqual({ kind: 'item', itemId: 'health_potion', targetId: 's' })
  })

  it('items source: empty filter matches first usable item', () => {
    const ctx = baseCtx({ self: actor({ id: 's', items: ['mana_potion'] }) })
    const s = script({ rootBlock: block({ lines: [line({ target: { kind: 'self' }, action: { source: 'items', filters: [] } })] }) })
    expect(chooseScriptedAction(s, ctx)?.itemId).toBe('mana_potion')
  })
})

// ---------------------------------------------------------------------------
// Equivalence with the Phase 4 M1 presets.
// ---------------------------------------------------------------------------

function toField(ctx: InterpreterContext): AiBattlefield {
  const toAi = (a: ScriptActorSnapshot): AiActorState => ({
    id: a.id,
    hp: a.hp,
    maxHp: a.maxHp,
    mp: a.mp,
    maxMp: a.maxMp,
    statuses: a.statuses,
    skills: a.skills,
    cooldowns: a.cooldowns,
    skillCosts: a.skillCosts,
  })
  return {
    self: toAi(ctx.self),
    allies: ctx.allies.map(toAi),
    enemies: ctx.enemies.map(toAi),
    turn: 1,
    turnCount: ctx.turnCount,
  }
}

/** The script (no rng -> first match) and the preset must pick the same action. */
function equiv(script: CharacterScript, preset: 'dps' | 'healer', ctx: InterpreterContext): BattleAction {
  const fromScript = chooseScriptedAction(script, ctx)
  const fromPreset = chooseAction(getPlayerAiScript(preset), toField(ctx))
  expect(fromScript).toEqual(fromPreset)
  return fromPreset
}

describe('M1 — built-in scripts match Phase 4 presets', () => {
  it('dps: can-cast -> primary skill at lowest enemy', () => {
    const ctx = baseCtx({
      self: actor({ id: 's', skills: ['fireball', 'slash'], skillCosts: { fireball: 6, slash: 4 }, mp: 20 }),
      enemies: [actor({ id: 'e1', hp: 50 }), actor({ id: 'e2', hp: 5 })],
    })
    expect(equiv(BUILT_IN_DPS, 'dps', ctx)).toEqual({ kind: 'skill', skillId: 'fireball', targetId: 'e2' })
  })

  it('dps: no mp -> basic attack at lowest enemy', () => {
    const ctx = baseCtx({
      self: actor({ id: 's', skills: ['fireball'], skillCosts: { fireball: 6 }, mp: 0 }),
      enemies: [actor({ id: 'e1', hp: 50 }), actor({ id: 'e2', hp: 5 })],
    })
    expect(equiv(BUILT_IN_DPS, 'dps', ctx)).toEqual({ kind: 'attack', targetId: 'e2' })
  })

  it('healer: ally < 60% & can-cast -> heal at lowest ally', () => {
    const ctx = baseCtx({
      self: actor({ id: 'h', skills: ['heal', 'smite'], skillCosts: { heal: 5, smite: 5 }, mp: 20 }),
      allies: [actor({ id: 'h', hp: 20, maxHp: 100 }), actor({ id: 'a', hp: 30, maxHp: 100 })],
    })
    expect(equiv(BUILT_IN_HEALER, 'healer', ctx)).toEqual({ kind: 'skill', skillId: 'heal', targetId: 'h' })
  })

  it('healer: no hurt ally -> defend', () => {
    const ctx = baseCtx({
      self: actor({ id: 'h', skills: ['heal'], skillCosts: { heal: 5 }, mp: 20, hp: 95, maxHp: 100 }),
      allies: [actor({ id: 'h', hp: 95, maxHp: 100 }), actor({ id: 'a', hp: 90, maxHp: 100 })],
    })
    expect(equiv(BUILT_IN_HEALER, 'healer', ctx)).toEqual({ kind: 'defend' })
  })
})

type ScriptOperator = 'AND' | 'OR'
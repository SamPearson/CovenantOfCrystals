import { describe, expect, it } from 'vitest'
import type { BattleActor, BattleEvent, BattleState } from './types'
import { checkReactions } from './reactions'
import type { ReactionRule } from '../scripting/types'
import type { CharacterScript } from '../scripting/types'

function makeActor(id: string, side: BattleActor['side'], skills: string[] = []): BattleActor {
  return {
    id,
    sourceId: id,
    side,
    name: id,
    stats: { hp: 100, atk: 10, def: 5, mag: 5, res: 5, spd: 5 },
    hp: 80,
    mp: 30,
    maxMp: 30,
    statuses: [],
    ko: false,
    skills,
  }
}

function makeBattle(heroOverrides: Partial<BattleActor> = {}): BattleState {
  const hero = makeActor('hero', 'player', ['thorns'])
  const ally = makeActor('ally', 'player')
  const goblin = makeActor('goblin', 'enemy', ['tackle'])
  return {
    seed: 1,
    actors: {
      hero: { ...hero, ...heroOverrides },
      ally,
      goblin,
    },
    queue: [],
    turnTime: 0,
    turnCount: 0,
    pendingEvents: [],
    reactionQueue: [],
    log: [],
    status: 'ongoing',
    over: false,
  }
}

function makeScript(reactions: ReactionRule[]): CharacterScript {
  return {
    id: 'builtin.react',
    name: 'Reactor',
    builtIn: true,
    rootBlock: { id: 'root', depth: 0, lines: [], nested: [] },
    reactions,
    createdAt: 0,
    updatedAt: 0,
  }
}

function rule(overrides: Partial<ReactionRule> = {}): ReactionRule {
  return {
    id: 'r1',
    gate: { kind: 'attacked', source: 'enemy', target: 'self' },
    target: { kind: 'attacker' },
    action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'thorns' }] },
    ...overrides,
  }
}

const attacked: BattleEvent = { kind: 'attacked', actorId: 'hero', sourceId: 'goblin' }

function resolver(script: CharacterScript | undefined) {
  return (_characterId: string) => script
}

describe('checkReactions (phase 4.5.2, M2)', () => {
  it('produces a plan when the gate matches the event', () => {
    const battle = makeBattle()
    const plans = checkReactions(battle, attacked, undefined, resolver(makeScript([rule()])))
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({
      id: 'r1',
      actorId: 'hero',
      kind: 'skill',
      skillId: 'thorns',
      targetId: 'goblin',
    })
    expect(plans[0]!.delay).toBe(120)
  })

  it('produces no plan when the gate kind does not match', () => {
    const battle = makeBattle()
    const plans = checkReactions(
      battle,
      { kind: 'evaded', actorId: 'hero', sourceId: 'goblin' },
      undefined,
      resolver(makeScript([rule()])),
    )
    expect(plans).toHaveLength(0)
  })

  it('rejects an event whose source fails the gate source filter', () => {
    const battle = makeBattle()
    const friendlyHit: BattleEvent = { kind: 'attacked', actorId: 'hero', sourceId: 'ally' }
    const plans = checkReactions(battle, friendlyHit, undefined, resolver(makeScript([rule()])))
    expect(plans).toHaveLength(0)
  })

  it('evaluates rule conditions against the reactor base context', () => {
    const battle = makeBattle()
    const pinch = rule({
      conditions: [{ kind: 'hp-pct', scope: 'self', op: '<', value: 0.5 }],
    })
    const full = checkReactions(battle, attacked, undefined, resolver(makeScript([pinch])))
    expect(full).toHaveLength(0)
    battle.actors.hero!.hp = 30
    const hurt = checkReactions(battle, attacked, undefined, resolver(makeScript([pinch])))
    expect(hurt).toHaveLength(1)
  })

  it('evaluates event-relative conditions against the triggered event actor', () => {
    const battle = makeBattle()
    const threat = rule({
      conditions: [{ kind: 'hp-pct', scope: 'attacker', op: '<', value: 0.5 }],
    })
    const tough = checkReactions(battle, attacked, undefined, resolver(makeScript([threat])))
    expect(tough).toHaveLength(0)
    battle.actors.goblin!.hp = 30
    const weak = checkReactions(battle, attacked, undefined, resolver(makeScript([threat])))
    expect(weak).toHaveLength(1)
  })

  it('exposes the previous event through previous-trigger-target', () => {
    const battle = makeBattle()
    const previous: BattleEvent = { kind: 'status-applied', actorId: 'goblin', sourceId: 'hero' }
    const followUp = rule({
      conditions: [{ kind: 'hp-pct', scope: 'previous-trigger-target', op: '<', value: 0.5 }],
    })
    const none = checkReactions(battle, attacked, previous, resolver(makeScript([followUp])))
    expect(none).toHaveLength(0)
    battle.actors.goblin!.hp = 20
    const hit = checkReactions(battle, attacked, previous, resolver(makeScript([followUp])))
    expect(hit).toHaveLength(1)
  })

  it('rejects reaction actions whose skill lacks a matching reactionTo (S21)', () => {
    const battle = makeBattle()
    battle.actors.hero!.skills = ['fireball']
    const illegal = rule({
      action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'fireball' }] },
    })
    const plans = checkReactions(battle, attacked, undefined, resolver(makeScript([illegal])))
    expect(plans).toHaveLength(0)
  })

  it('allows a reaction action whose reactionTo grants the fired gate', () => {
    const battle = makeBattle()
    const plans = checkReactions(battle, attacked, undefined, resolver(makeScript([rule()])))
    expect(plans[0]!.skillId).toBe('thorns')
  })

  it('fires every qualifying rule in sheet order', () => {
    const battle = makeBattle()
    const a = rule({ id: 'r1' })
    const b = rule({ id: 'r2', target: { kind: 'self' } })
    const plans = checkReactions(battle, attacked, undefined, resolver(makeScript([a, b])))
    expect(plans.map((p) => p.id)).toEqual(['r1', 'r2'])
  })

  it('respects an explicit zero delay (instant reaction)', () => {
    const battle = makeBattle()
    const plans = checkReactions(battle, attacked, undefined, resolver(makeScript([rule({ delay: 0 })])))
    expect(plans[0]!.delay).toBe(0)
  })

  it("skips KO'd reactors", () => {
    const battle = makeBattle({ ko: true })
    const plans = checkReactions(battle, attacked, undefined, resolver(makeScript([rule()])))
    expect(plans).toHaveLength(0)
  })

  it('never consults a script for enemy-side actors', () => {
    const battle = makeBattle()
    battle.actors.goblin!.skills = ['tackle']
    const enemy = checkReactions(battle, attacked, undefined, resolver(makeScript([rule()])))
    expect(enemy.map((p) => p.actorId)).toEqual(['hero'])
  })

  it('produces no plan when the resolver returns no script', () => {
    const battle = makeBattle()
    const plans = checkReactions(battle, attacked, undefined, resolver(undefined))
    expect(plans).toHaveLength(0)
  })

  it('ignores a qualifying rule whose targets resolve empty', () => {
    const battle = makeBattle()
    const orphan = rule({
      target: { kind: 'highest-hp-ally', condition: { kind: 'has-status', scope: 'any-enemy', status: 'burn', present: true } },
    })
    const plans = checkReactions(battle, attacked, undefined, resolver(makeScript([orphan])))
    expect(plans).toHaveLength(0)
  })
})
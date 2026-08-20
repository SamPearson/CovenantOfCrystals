import { describe, expect, it } from 'vitest'
import { AI_SCRIPTS } from '../data'
import { createRng } from '../rng/rng'
import type { AiActorState, AiBattlefield, AiCompareOp, AiScript } from './ai'
import { chooseAction } from './ai'

function actor(
  id: string,
  hp: number,
  maxHp: number,
  overrides: Partial<AiActorState> = {},
): AiActorState {
  const { mp = 0, maxMp = 0, statuses = [], skills = ['tackle'], ...rest } = overrides
  return { id, hp, maxHp, mp, maxMp, statuses, skills, ...rest }
}

function battle(
  self: AiActorState,
  allies: readonly AiActorState[],
  enemies: readonly AiActorState[],
  overrides: Partial<AiBattlefield> = {},
): AiBattlefield {
  const withSelf = allies.some((a) => a.id === self.id) ? allies : [self, ...allies]
  return { self, allies: withSelf, enemies, turn: 1, turnCount: 0, ...overrides }
}

describe('first true condition wins', () => {
  const braceOrAttack: AiScript = [
    { condition: { kind: 'hp-pct', scope: 'self', op: '<', value: 0.5 }, action: { kind: 'defend' } },
    { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
  ]

  it('takes the first true condition in list order', () => {
    const field = battle(actor('self', 40, 100), [], [])
    expect(chooseAction(braceOrAttack, field)).toEqual({ kind: 'defend' })
  })

  it('falls through to later entries while earlier conditions are false', () => {
    const enemies = [actor('later', 60, 100), actor('early', 90, 100)]
    const field = battle(actor('self', 80, 100), [], enemies)
    expect(chooseAction(braceOrAttack, field)).toEqual({ kind: 'attack', targetId: 'later' })
  })

  it('the always catch-all matches, so a script always resolves a move', () => {
    const field = battle(actor('self', 100, 100), [], [actor('e', 50, 100)])
    expect(chooseAction(braceOrAttack, field).kind).toBe('attack')
  })
})

describe('conditions', () => {
  const hpCases: Array<[AiCompareOp, number, boolean]> = [
    ['<', 0.61, true], ['<', 0.6, false],
    ['<=', 0.6, true], ['<=', 0.59, false],
    ['>', 0.59, true], ['>', 0.6, false],
    ['>=', 0.6, true], ['>=', 0.61, false],
    ['==', 0.6, true], ['==', 0.5, false],
    ['!=', 0.5, true], ['!=', 0.6, false],
  ]
  for (const [op, value, expected] of hpCases) {
    it(`hp-pct self ${op} ${value} → ${expected} at 60% HP`, () => {
      const script: AiScript = [
        { condition: { kind: 'hp-pct', scope: 'self', op, value }, action: { kind: 'defend' } },
      ]
      const field = battle(actor('self', 60, 100), [], [])
      expect(chooseAction(script, field).kind).toBe(expected ? 'defend' : 'attack')
    })
  }

  it('hp-pct any-ally is true when at least one ally qualifies', () => {
    const script: AiScript = [
      { condition: { kind: 'hp-pct', scope: 'any-ally', op: '<', value: 0.5 }, action: { kind: 'defend' } },
    ]
    const hurt = actor('hurt', 10, 100)
    const fine = actor('fine', 100, 100)
    expect(chooseAction(script, battle(actor('self', 100, 100), [hurt, fine], [])).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100), [fine, fine], [])).kind).toBe('attack')
  })

  it('hp-pct any-enemy reads the enemy side', () => {
    const script: AiScript = [
      { condition: { kind: 'hp-pct', scope: 'any-enemy', op: '<', value: 0.25 }, action: { kind: 'defend' } },
    ]
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [actor('e', 19, 80), actor('f', 80, 80)])).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [actor('e', 50, 80), actor('f', 80, 80)])).kind).toBe('attack')
  })

  it('hp-pct lowest-ally compares by HP fraction, not raw HP', () => {
    const script: AiScript = [
      { condition: { kind: 'hp-pct', scope: 'lowest-ally', op: '<', value: 0.5 }, action: { kind: 'defend' } },
    ]
    const lowest = battle(actor('self', 100, 100), [actor('allyA', 10, 80), actor('allyB', 60, 100)], [])
    expect(chooseAction(script, lowest).kind).toBe('defend')
    const healthy = battle(actor('self', 100, 100), [actor('allyA', 50, 80), actor('allyB', 60, 100)], [])
    expect(chooseAction(script, healthy).kind).toBe('attack')
  })

  it('count allies is living allies including self', () => {
    const script: AiScript = [
      { condition: { kind: 'count', scope: 'allies', op: '==', value: 2 }, action: { kind: 'defend' } },
    ]
    expect(chooseAction(script, battle(actor('self', 100, 100), [actor('a', 50, 100)], [])).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [])).kind).toBe('attack')
  })

  it('count enemies reads the enemy side', () => {
    const script: AiScript = [
      { condition: { kind: 'count', scope: 'enemies', op: '>=', value: 2 }, action: { kind: 'defend' } },
    ]
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [actor('x', 50, 100), actor('y', 50, 100)])).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [actor('x', 50, 100)])).kind).toBe('attack')
  })

  it('has-status matches a status present on self', () => {
    const script: AiScript = [
      { condition: { kind: 'has-status', status: 'burn' }, action: { kind: 'defend' } },
    ]
    expect(chooseAction(script, battle(actor('self', 100, 100, { statuses: ['burn'] }), [], [])).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100, { statuses: ['poison'] }), [], [])).kind).toBe('attack')
  })

  it('no-status matches when self lacks the status', () => {
    const script: AiScript = [
      { condition: { kind: 'no-status', status: 'blind' }, action: { kind: 'defend' } },
    ]
    expect(chooseAction(script, battle(actor('self', 100, 100, { statuses: ['poison'] }), [], [])).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100, { statuses: ['blind'] }), [], [])).kind).toBe('attack')
  })

  it('cooldown-ready is true while a skill is off cooldown', () => {
    const script: AiScript = [
      { condition: { kind: 'cooldown-ready', skillId: 'heavy' }, action: { kind: 'defend' } },
    ]
    const ready = actor('self', 100, 100, { cooldowns: { heavy: 0 } })
    const cooling = actor('self', 100, 100, { cooldowns: { heavy: 2 } })
    expect(chooseAction(script, battle(ready, [], [])).kind).toBe('defend')
    expect(chooseAction(script, battle(cooling, [], [])).kind).toBe('attack')
  })

  it('an absent cooldown entry counts as ready', () => {
    const script: AiScript = [
      { condition: { kind: 'cooldown-ready', skillId: 'heavy' }, action: { kind: 'defend' } },
    ]
    const field = battle(actor('self', 100, 100), [], [])
    expect(chooseAction(script, field).kind).toBe('defend')
  })

  it('turns compares the actor own battle turn', () => {
    const script: AiScript = [
      { condition: { kind: 'turns', op: '==', value: 1 }, action: { kind: 'defend' } },
    ]
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [], { turn: 1 })).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [], { turn: 4 })).kind).toBe('attack')
  })

  it('turns-mod implements boss calendar patterns', () => {
    const script: AiScript = [
      { condition: { kind: 'turns-mod', divisor: 3, remainder: 0 }, action: { kind: 'defend' } },
    ]
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [], { turn: 3 })).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [], { turn: 6 })).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [], { turn: 4 })).kind).toBe('attack')
  })

  it('turn-count compares the global resolved-turn counter', () => {
    const script: AiScript = [
      { condition: { kind: 'turn-count', op: '>=', value: 5 }, action: { kind: 'defend' } },
    ]
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [], { turnCount: 5 })).kind).toBe('defend')
    expect(chooseAction(script, battle(actor('self', 100, 100), [], [], { turnCount: 4 })).kind).toBe('attack')
  })
})

describe('condition validation', () => {
  it('rejects an out-of-range hp-pct fraction', () => {
    const script: AiScript = [
      { condition: { kind: 'hp-pct', scope: 'self', op: '<', value: 1.5 }, action: { kind: 'defend' } },
    ]
    expect(() => chooseAction(script, battle(actor('self', 50, 100), [], []))).toThrow(RangeError)
  })

  it('rejects a non-positive turns-mod divisor', () => {
    const script: AiScript = [
      { condition: { kind: 'turns-mod', divisor: 0, remainder: 0 }, action: { kind: 'defend' } },
    ]
    expect(() => chooseAction(script, battle(actor('self', 100, 100), [], []))).toThrow(RangeError)
  })
})

describe('target rules', () => {
  it('lowest-hp-enemy picks by remaining HP, ties by id ascending', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const enemies = [actor('c', 50, 100), actor('a', 50, 100), actor('b', 90, 100)]
    expect(chooseAction(script, battle(actor('self', 100, 100), [], enemies))).toEqual({ kind: 'attack', targetId: 'a' })
  })

  it('highest-hp-enemy picks the most healthy foe by raw HP', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'skill', skillId: 'rock_smash', target: { kind: 'highest-hp-enemy' } } },
    ]
    const enemies = [actor('p3', 60, 100), actor('p1', 80, 100), actor('p2', 120, 200)]
    const field = battle(actor('self', 100, 100, { skills: ['rock_smash'] }), [], enemies)
    expect(chooseAction(script, field)).toEqual({ kind: 'skill', skillId: 'rock_smash', targetId: 'p2' })
  })

  it('lowest-hp-ally includes the actor itself', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'skill', target: { kind: 'lowest-hp-ally' } } },
    ]
    const self = actor('self', 30, 100)
    expect(chooseAction(script, battle(self, [self, actor('a', 90, 100), actor('b', 40, 100)], [])).targetId).toBe('self')
  })

  it('lowest-hp-ally ties break by id ascending', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-ally' } } },
    ]
    const allies = [actor('c', 40, 100), actor('a', 40, 100)]
    expect(chooseAction(script, battle(actor('self', 100, 100), allies, [])).targetId).toBe('a')
  })

  it('self targets the acting actor', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'skill', target: { kind: 'self' } } },
    ]
    const field = battle(actor('self', 100, 100), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'skill', skillId: 'tackle', targetId: 'self' })
  })

  it('aoe targets leave targetId undefined for the battle layer to resolve', () => {
    const enemies: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'skill', target: { kind: 'all-enemies' } } },
    ]
    const field = battle(actor('self', 100, 100), [], [actor('e', 50, 100)])
    expect(chooseAction(enemies, field).targetId).toBeUndefined()

    const allyAoe: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'all-allies' } } },
    ]
    const allyField = battle(actor('self', 100, 100), [actor('a', 50, 100)], [])
    expect(chooseAction(allyAoe, allyField).targetId).toBeUndefined()
  })

  it('random-enemy consumes the seeded rng deterministically', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'random-enemy' } } },
    ]
    const enemies = [actor('a', 50, 100), actor('b', 60, 100), actor('c', 70, 100)]
    const expected = enemies[Math.floor(createRng(7)() * enemies.length)]!
    expect(chooseAction(script, battle(actor('self', 100, 100), [], enemies), createRng(7)).targetId).toBe(expected.id)
  })

  it('random-enemy without an rng falls back to id order', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'random-enemy' } } },
    ]
    const enemies = [actor('c', 50, 100), actor('a', 60, 100)]
    expect(chooseAction(script, battle(actor('self', 100, 100), [], enemies)).targetId).toBe('a')
  })
})

describe('skill resolution', () => {
  it('omitting skillId uses the actor primary skill (skills[0])', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'skill', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(actor('self', 100, 100, { skills: ['rock_smash', 'goblin_swipe'] }), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'skill', skillId: 'rock_smash', targetId: 'e' })
  })

  it('an explicit skillId takes precedence', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'skill', skillId: 'ember', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(actor('self', 100, 100, { skills: ['ember'] }), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'skill', skillId: 'ember', targetId: 'e' })
  })

  it('rejects a skill the actor does not know', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'skill', skillId: 'frost_breath', target: { kind: 'lowest-hp-enemy' } } },
    ]
    expect(() => chooseAction(script, battle(actor('self', 100, 100, { skills: ['ember'] }), [], []))).toThrow(/does not know skill/)
  })

  it('rejects a scripted skill when the actor knows no skills', () => {
    const script: AiScript = [
      { condition: { kind: 'always' }, action: { kind: 'skill', target: { kind: 'lowest-hp-enemy' } } },
    ]
    expect(() => chooseAction(script, battle(actor('self', 100, 100, { skills: [] }), [], []))).toThrow(/knows none/)
  })
})

describe('fallback safety', () => {
  it('a script with no matching condition falls back to a deterministic attack', () => {
    const script: AiScript = [
      { condition: { kind: 'hp-pct', scope: 'self', op: '<', value: 0.5 }, action: { kind: 'defend' } },
    ]
    const enemies = [actor('c', 40, 100), actor('a', 60, 100)]
    expect(chooseAction(script, battle(actor('self', 100, 100), [], enemies))).toEqual({ kind: 'attack', targetId: 'c' })
  })

  it('an empty script still resolves to a basic attack', () => {
    const field = battle(actor('self', 100, 100), [], [actor('e', 50, 100)])
    expect(chooseAction([], field)).toEqual({ kind: 'attack', targetId: 'e' })
  })
})

describe('profile sanity (data)', () => {
  const party = [actor('p1', 40, 100), actor('p2', 90, 100)]

  it('minion always basic-attacks the weakest foe', () => {
    const field = battle(actor('self', 40, 40, { skills: ['tackle'] }), [], party)
    expect(chooseAction(AI_SCRIPTS.minion, field)).toEqual({ kind: 'attack', targetId: 'p1' })
  })

  it('tanky opens defensive, re-braces when hurt, otherwise swings its primary skill', () => {
    const golemCombat = { skills: ['rock_smash'] }
    const open = battle(actor('golem', 110, 110, golemCombat), [], party, { turn: 1 })
    expect(chooseAction(AI_SCRIPTS.tanky, open)).toEqual({ kind: 'defend' })
    const swing = battle(actor('golem', 110, 110, golemCombat), [], party, { turn: 2 })
    expect(chooseAction(AI_SCRIPTS.tanky, swing)).toEqual({ kind: 'skill', skillId: 'rock_smash', targetId: 'p1' })
    const hurt = battle(actor('golem', 35, 110, golemCombat), [], party)
    expect(chooseAction(AI_SCRIPTS.tanky, hurt)).toEqual({ kind: 'defend' })
  })

  it('glass always casts its primary spell', () => {
    const field = battle(actor('wraith', 50, 50, { skills: ['frost_breath'] }), [], party)
    expect(chooseAction(AI_SCRIPTS.glass, field)).toEqual({ kind: 'skill', skillId: 'frost_breath', targetId: 'p1' })
  })

  it('boss calendar: survey turn 1, crush every 3rd turn, press when bloodied, otherwise attack', () => {
    const king = (turn: number, hp = 180): AiBattlefield => battle(
      actor('king', hp, 180, { skills: ['rock_smash', 'goblin_swipe'] }), [], party, { turn },
    )
    expect(chooseAction(AI_SCRIPTS.boss, king(1))).toEqual({ kind: 'defend' })
    expect(chooseAction(AI_SCRIPTS.boss, king(3))).toEqual({ kind: 'skill', skillId: 'rock_smash', targetId: 'p1' })
    expect(chooseAction(AI_SCRIPTS.boss, king(6))).toEqual({ kind: 'skill', skillId: 'rock_smash', targetId: 'p1' })
    expect(chooseAction(AI_SCRIPTS.boss, king(2))).toEqual({ kind: 'attack', targetId: 'p1' })
    expect(chooseAction(AI_SCRIPTS.boss, king(2, 80))).toEqual({ kind: 'skill', skillId: 'rock_smash', targetId: 'p1' })
  })

  it('boss baseline attack is randomly seeded and replays reproducible', () => {
    const field = battle(actor('king', 180, 180, { skills: ['rock_smash', 'goblin_swipe'] }), [], party, { turn: 2 })
    const first = chooseAction(AI_SCRIPTS.boss, field, createRng(11))
    const again = chooseAction(AI_SCRIPTS.boss, field, createRng(11))
    expect(first).toEqual(again)
    expect(first.targetId).toBeDefined()
  })
})

describe('mp-pct condition', () => {
  const script: AiScript = [
    { condition: { kind: 'mp-pct', op: '>', value: 0.2 }, action: { kind: 'defend' } },
    { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
  ]

  it('compares the actor MP fraction against the threshold', () => {
    const field = battle(actor('self', 100, 100, { mp: 25, maxMp: 100 }), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'defend' })
  })

  it('is false when MP sits below the threshold', () => {
    const field = battle(actor('self', 100, 100, { mp: 1, maxMp: 100 }), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'attack', targetId: 'e' })
  })

  it('reads 0 when no maxMp is set', () => {
    const field = battle(actor('self', 100, 100), [], [actor('e', 50, 100)])
    const emptyScript: AiScript = [
      { condition: { kind: 'mp-pct', op: '<', value: 0.5 }, action: { kind: 'defend' } },
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    expect(chooseAction(emptyScript, field)).toEqual({ kind: 'defend' })
  })

  it('rejects values outside [0, 1]', () => {
    const field = battle(actor('self', 100, 100), [], [actor('e', 50, 100)])
    expect(() => chooseAction([{ condition: { kind: 'mp-pct', op: '<', value: 1.5 }, action: { kind: 'defend' } }], field)).toThrow(/fraction in \[0, 1\]/)
  })
})

describe('can-cast condition', () => {
  const script: AiScript = [
    { condition: { kind: 'can-cast', skillId: 'heal' }, action: { kind: 'defend' } },
    { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
  ]

  it('is true when the actor knows the skill and can afford its cost', () => {
    const field = battle(
      actor('self', 100, 100, { mp: 6, maxMp: 10, skills: ['tackle', 'heal'], skillCosts: { heal: 5 } }),
      [],
      [actor('e', 50, 100)],
    )
    expect(chooseAction(script, field)).toEqual({ kind: 'defend' })
  })

  it('is false when MP cannot cover the cost', () => {
    const field = battle(
      actor('self', 100, 100, { mp: 4, maxMp: 10, skills: ['tackle', 'heal'], skillCosts: { heal: 5 } }),
      [],
      [actor('e', 50, 100)],
    )
    expect(chooseAction(script, field)).toEqual({ kind: 'attack', targetId: 'e' })
  })

  it('is false when the skill is not known', () => {
    const field = battle(actor('self', 100, 100, { mp: 10, maxMp: 10, skills: ['tackle'] }), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'attack', targetId: 'e' })
  })

  it('treats a skill without a listed cost as free', () => {
    const field = battle(actor('self', 100, 100, { mp: 0, maxMp: 10, skills: ['tackle', 'heal'] }), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'defend' })
  })

  it('with no skillId is true when any known skill is affordable', () => {
    const anyScript: AiScript = [
      { condition: { kind: 'can-cast' }, action: { kind: 'defend' } },
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(
      actor('self', 100, 100, { mp: 8, maxMp: 10, skills: ['tackle', 'heal'], skillCosts: { heal: 5, tackle: 3 } }),
      [],
      [actor('e', 50, 100)],
    )
    expect(chooseAction(anyScript, field)).toEqual({ kind: 'defend' })
  })

  it('with no skillId is false when every known skill is unaffordable', () => {
    const anyScript: AiScript = [
      { condition: { kind: 'can-cast' }, action: { kind: 'defend' } },
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(
      actor('self', 100, 100, { mp: 1, maxMp: 10, skills: ['tackle', 'heal'], skillCosts: { heal: 5, tackle: 3 } }),
      [],
      [actor('e', 50, 100)],
    )
    expect(chooseAction(anyScript, field)).toEqual({ kind: 'attack', targetId: 'e' })
  })
})

describe('and / any combinators', () => {
  it('and is true when every nested condition holds', () => {
    const script: AiScript = [
      {
        condition: { kind: 'and', conditions: [{ kind: 'mp-pct', op: '>', value: 0.5 }, { kind: 'can-cast', skillId: 'heal' }] },
        action: { kind: 'defend' },
      },
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(
      actor('self', 100, 100, { mp: 8, maxMp: 10, skills: ['heal'], skillCosts: { heal: 5 } }),
      [],
      [actor('e', 50, 100)],
    )
    expect(chooseAction(script, field)).toEqual({ kind: 'defend' })
  })

  it('and is false when any nested condition fails', () => {
    const script: AiScript = [
      {
        condition: { kind: 'and', conditions: [{ kind: 'mp-pct', op: '>', value: 0.9 }, { kind: 'always' }] },
        action: { kind: 'defend' },
      },
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(actor('self', 100, 100, { mp: 5, maxMp: 10 }), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'attack', targetId: 'e' })
  })

  it('any is true when at least one nested condition holds', () => {
    const script: AiScript = [
      {
        condition: { kind: 'any', conditions: [{ kind: 'hp-pct', scope: 'any-ally', op: '<', value: 0.5 }, { kind: 'mp-pct', op: '>', value: 0.5 }] },
        action: { kind: 'defend' },
      },
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(actor('self', 100, 100, { mp: 9, maxMp: 10 }), [actor('ally', 40, 100)], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'defend' })
  })

  it('any is false when no nested condition holds', () => {
    const script: AiScript = [
      {
        condition: { kind: 'any', conditions: [{ kind: 'hp-pct', scope: 'any-ally', op: '<', value: 0.5 }, { kind: 'mp-pct', op: '>', value: 0.5 }] },
        action: { kind: 'defend' },
      },
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(actor('self', 100, 100, { mp: 1, maxMp: 10 }), [actor('ally', 90, 100)], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'attack', targetId: 'e' })
  })

  it('nests combinators recursively', () => {
    const script: AiScript = [
      {
        condition: {
          kind: 'and',
          conditions: [
            { kind: 'any', conditions: [{ kind: 'can-cast', skillId: 'heal' }, { kind: 'always' }] },
            { kind: 'mp-pct', op: '>', value: 0.4 },
          ],
        },
        action: { kind: 'defend' },
      },
      { condition: { kind: 'always' }, action: { kind: 'attack', target: { kind: 'lowest-hp-enemy' } } },
    ]
    const field = battle(actor('self', 100, 100, { mp: 6, maxMp: 10 }), [], [actor('e', 50, 100)])
    expect(chooseAction(script, field)).toEqual({ kind: 'defend' })
  })

  it('rejects empty condition lists', () => {
    const field = battle(actor('self', 100, 100), [], [actor('e', 50, 100)])
    expect(() => chooseAction([{ condition: { kind: 'and', conditions: [] }, action: { kind: 'defend' } }], field)).toThrow(/at least one condition/)
    expect(() => chooseAction([{ condition: { kind: 'any', conditions: [] }, action: { kind: 'defend' } }], field)).toThrow(/at least one condition/)
  })
})
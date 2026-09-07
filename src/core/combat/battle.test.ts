import { describe, expect, it } from 'vitest'
import { createCharacter } from '../character'
import { ENEMIES } from '../data'
import { BALANCE } from '../data/balance'
import { createRng } from '../rng/rng'
import type { BattleAction } from './types'
import {
  createBattle,
  chooseEnemyAction,
  choosePartyAction,
  getBattleResult,
  performAction,
} from './battle'
import type { CharacterScript } from '../scripting/types'
import { applyStatus } from './status'
import { chooseScriptedAction, buildScriptContext } from '../scripting/interpreter'
import { BUILT_IN_DPS } from '../data/scripts'

function actNext(battle: ReturnType<typeof createBattle>, action: BattleAction, rng: () => number) {
  const who = battle.queue[0]!.actorId
  return performAction(battle, who, action, rng)
}

describe('battle orchestration (phase 2, M4)', () => {
  it('createBattle seeds actors, queue, and battle state', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    expect(battle.turnCount).toBe(0)
    expect(battle.turnTime).toBe(0)
    expect(battle.status).toBe('ongoing')
    expect(battle.over).toBe(false)
    expect(Object.keys(battle.actors)).toEqual([aria.id, 'slime#0'])
    expect(battle.queue).toHaveLength(2)
    for (const entry of battle.queue) expect(entry.nextAt).toBe(0)
  })

  it('player takes the first turn (initiative)', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    expect(battle.queue[0]!.actorId).toBe(aria.id)
  })

  it('performAction throws when the actor is not at the front of the queue', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    expect(() => performAction(battle, 'slime#0', { kind: 'attack' }, rng)).toThrow(
      /not the next actor/,
    )
  })

  it('performAction throws when the battle is already over', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    battle.over = true
    const rng = createRng(1)
    expect(() => performAction(battle, aria.id, { kind: 'attack' }, rng)).toThrow(
      /battle is already over/,
    )
  })

  it('provides a citizen-facing error for an unknown actor', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const ghostId = 'ghost'
    battle.queue = [{ actorId: ghostId, side: 'player', nextAt: 0 }]
    const rng = createRng(1)
    expect(() => performAction(battle, ghostId, { kind: 'attack' }, rng)).toThrow(/unknown actor/)
  })

  it('attack deals damage, logs a hit, and increments turnCount', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    const slime = battle.actors['slime#0']!
    const before = slime.hp
    const outcome = actNext(battle, { kind: 'attack' }, rng)
    expect(battle.turnCount).toBe(1)
    expect(outcome.action).toEqual({ kind: 'attack' })
    expect(slime.hp).toBeLessThan(before)
    expect(battle.log[0]!.text).toMatch(/hits Slime for \d+\./)
  })

  it('re-inserts the attacker with an action delay based on its spd', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    actNext(battle, { kind: 'attack' }, rng)
    const knightEntry = battle.queue.find((e) => e.actorId === aria.id)!
    const expected = BALANCE.actionDelays.attack * (BALANCE.spdRef / 6)
    expect(knightEntry.nextAt).toBeCloseTo(expected, 3)
  })

  it('keeps a single queue slot per actor across a turn', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    const who = battle.queue[0]!.actorId
    performAction(battle, who, { kind: 'attack' }, rng)
    expect(battle.queue).toHaveLength(2)
    const ids = battle.queue.map((e) => e.actorId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(who)
    expect(battle.queue.find((e) => e.actorId === 'slime#0')!.nextAt).toBe(0)
  })

  it('a KO\'d actor never returns to the queue', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    const slime = battle.actors['slime#0']!
    while (!battle.over) {
      const who = battle.queue[0]!.actorId
      performAction(battle, who, { kind: 'attack' }, rng)
    }
    expect(slime.ko).toBe(true)
    expect(battle.queue.some((e) => e.actorId === slime.id)).toBe(false)
  })

  it('a skill costs MP, deals damage, and shows in the log', () => {
    const zed = createCharacter({ classId: 'mage', name: 'Zed', level: 5 })
    const battle = createBattle([zed], [ENEMIES.slime!], 1)
    battle.actors['slime#0']!.hp = 1000
    const rng = createRng(1)
    const slime = battle.actors['slime#0']!
    const beforeMp = battle.actors[zed.id]!.mp
    const beforeHp = slime.hp
    actNext(battle, { kind: 'skill', skillId: 'fireball' }, rng)
    expect(battle.actors[zed.id]!.mp).toBe(beforeMp - 6)
    expect(slime.hp).toBeLessThan(beforeHp)
    expect(battle.log[0]!.text).toMatch(/hits Slime for \d+\./)
  })

  it('blocks a skill on cooldown without spending MP', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria', level: 3 })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    battle.actors['slime#0']!.hp = 200
    const rng = createRng(1)
    const knight = battle.actors[aria.id]!
    const turn = () => {
      const who = battle.queue[0]!.actorId
      performAction(
        battle,
        who,
        who === aria.id ? { kind: 'skill', skillId: 'shield_bash' } : { kind: 'attack' },
        rng,
      )
      return who
    }
    turn()
    expect(knight.mp).toBe(30 - 5)
    const mpAfterCast = knight.mp
    let turns = 0
    while (!battle.log.some((e) => /on cooldown/.test(e.text)) && turns < 10) {
      turn()
      turns++
    }
    expect(knight.mp).toBe(mpAfterCast)
    expect(battle.log.some((e) => /on cooldown/.test(e.text))).toBe(true)
    while (knight.mp === mpAfterCast && turns < 20) {
      turn()
      turns++
    }
    expect(knight.mp).toBe(30 - 10)
  })

  it('a skill the actor does not know throws', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria', level: 1 })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    expect(() => actNext(battle, { kind: 'skill', skillId: 'fireball' }, rng)).toThrow(
      /does not know skill/,
    )
  })

  it('an item heals its target and costs the item action delay', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const knight = battle.actors[aria.id]!
    knight.hp = 20
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'health_potion', targetId: aria.id }, rng)
    expect(knight.hp).toBe(90)
    expect(battle.log[0]!.text).toContain('recovers 70 HP')
    const knightEntry = battle.queue.find((e) => e.actorId === aria.id)!
    const expected = BALANCE.actionDelays.item * (BALANCE.spdRef / 6)
    expect(knightEntry.nextAt).toBeCloseTo(expected, 3)
  })

  it('M7 — using an item removes it from actor.items (consumption)', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const knight = battle.actors[aria.id]!
    knight.items = ['health_potion', 'health_potion']
    knight.hp = 10
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'health_potion', targetId: aria.id }, rng)
    expect(knight.items).toEqual(['health_potion'])
    expect(knight.hp).toBe(90)
  })

  it('an item with no use effect throws', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    expect(() => actNext(battle, { kind: 'item', itemId: 'iron_sword' }, rng)).toThrow(
      /has no use effect/,
    )
  })

  it('defend marks the actor defending and halves incoming damage', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.earth_golem!], 1)
    const rng = createRng(1)
    const knight = battle.actors[aria.id]!
    const golem = battle.actors['earth_golem#0']!
    actNext(battle, { kind: 'defend' }, rng)
    expect(knight.defending).toBe(true)
    const undefended = 90
    actNext(battle, { kind: 'attack' }, rng)
    expect(knight.defending).toBe(true)
    expect(knight.hp).toBeGreaterThan(undefended - 30)
    expect(battle.log.at(-1)!.text).toMatch(/hits Aria for \d+\./)
    expect(golem.ko).toBe(false)
  })

  it('a sleeping actor skips its turn (action null) and re-enters the queue', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.frost_wraith!], 1)
    const rng = createRng(1)
    const wraith = battle.actors['frost_wraith#0']!
    applyStatus(wraith, { kind: 'sleep', duration: 1 })
    actNext(battle, { kind: 'defend' }, rng)
    const outcome = actNext(battle, { kind: 'attack' }, rng)
    expect(outcome.action).toBeNull()
    expect(battle.log.some((e) => /cannot act/.test(e.text))).toBe(true)
    expect(battle.turnCount).toBe(2)
    expect(wraith.statuses.some((s) => s.kind === 'sleep')).toBe(false)
  })

  it('poison ticks on poisoned actors every poisonInterval turns', () => {
    const zed = createCharacter({ classId: 'mage', name: 'Zed', level: 5 })
    const battle = createBattle([zed], [ENEMIES.slime!], 1)
    const slime = battle.actors['slime#0']!
    const rng = createRng(1)
    applyStatus(slime, { kind: 'poison', power: 5, duration: 3 })
    let steps = 0
    while (!battle.over && steps < 10) {
      const who = battle.queue[0]!.actorId
      performAction(battle, who, { kind: 'attack' }, rng)
      steps += 1
    }
    const poisonTick = battle.log.find((e) => /takes \d+ poison damage\./.test(e.text))
    expect(poisonTick).toBeDefined()
  })

  it('escape ends the battle with status fled', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    actNext(battle, { kind: 'escape' }, rng)
    expect(battle.over).toBe(true)
    expect(battle.status).toBe('fled')
    const result = getBattleResult(battle)
    expect(result.status).toBe('fled')
    expect(result.koIds).toEqual([])
    expect(result.survivors).toEqual([aria.id])
    expect(result.xpAwarded).toEqual({})
    expect(result.drops).toEqual([])
  })

  it('victory yields a BattleResult with survivors and empty xp/drops', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    let steps = 0
    while (!battle.over && steps < 10) {
      const who = battle.queue[0]!.actorId
      performAction(battle, who, { kind: 'attack' }, rng)
      steps += 1
    }
    expect(battle.status).toBe('won')
    const result = getBattleResult(battle)
    expect(result.status).toBe('won')
    expect(result.koIds).toEqual([])
    expect(result.survivors).toEqual([aria.id])
    expect(result.xpAwarded).toEqual({})
    expect(result.drops).toEqual([])
    expect(result.log).toEqual(battle.log)
  })

  it('defeat yields a BattleResult with the party koIds and empty survivors', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.goblin_king!], 1)
    const rng = createRng(1)
    let steps = 0
    while (!battle.over && steps < 50) {
      const who = battle.queue[0]!.actorId
      const side = battle.actors[who]!.side
      const action: BattleAction = side === 'enemy'
        ? chooseEnemyAction(battle, who, rng)
        : { kind: 'attack' }
      performAction(battle, who, action, rng)
      steps += 1
    }
    expect(battle.status).toBe('lost')
    const result = getBattleResult(battle)
    expect(result.status).toBe('lost')
    expect(result.koIds).toEqual([aria.id])
    expect(result.survivors).toEqual([])
  })

  it('getBattleResult throws while the battle is ongoing', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    expect(() => getBattleResult(battle)).toThrow(/not over/)
  })

  it('is deterministic for a given seed', () => {
    const run = (seed: number) => {
      const aria = createCharacter({ classId: 'knight', name: 'Aria', level: 3 })
      aria.id = 'aria'
      const battle = createBattle([aria], [ENEMIES.goblin_king!], seed)
      const rng = createRng(seed)
      let steps = 0
      while (!battle.over && steps < 50) {
        const who = battle.queue[0]!.actorId
        const side = battle.actors[who]!.side
        const action: BattleAction = side === 'enemy'
          ? chooseEnemyAction(battle, who, rng)
          : { kind: 'attack' }
        performAction(battle, who, action, rng)
        steps += 1
      }
      return {
        status: battle.status,
        log: battle.log.map((e) => e.text),
        result: getBattleResult(battle),
      }
    }
    expect(run(42)).toEqual(run(42))
  })
})

describe('scroll items (phase 3, M5)', () => {
  it('a scroll casts its skill with no MP cost, no ownership, and no cooldown', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const slime = battle.actors['slime#0']!
    slime.hp = 1000
    const knight = battle.actors[aria.id]!
    const mpBefore = knight.mp
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'scroll_fireball' }, rng)
    expect(slime.hp).toBeLessThan(1000)
    expect(knight.mp).toBe(mpBefore)
    expect(knight.cooldowns?.['fireball']).toBeUndefined()
    expect(battle.log[0]!.text).toContain('uses Scroll: Fireball')
  })

  it('a scroll of an AoE skill hits every enemy', () => {
    const zed = createCharacter({ classId: 'mage', name: 'Zed', level: 5 })
    const battle = createBattle([zed], [ENEMIES.slime!, ENEMIES.slime!], 1)
    battle.actors['slime#0']!.hp = 1000
    battle.actors['slime#1']!.hp = 1000
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'scroll_flame_wave' }, rng)
    expect(battle.actors['slime#0']!.hp).toBeLessThan(1000)
    expect(battle.actors['slime#1']!.hp).toBeLessThan(1000)
  })

  it("a scroll of a heal skill heals its target, scaled by the user's MAG", () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const knight = battle.actors[aria.id]!
    knight.hp = 20
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'scroll_greater_heal', targetId: aria.id }, rng)
    expect(knight.hp).toBeGreaterThan(20)
  })

  it('a scroll applies the skill status effect', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const slime = battle.actors['slime#0']!
    slime.hp = 1000
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'scroll_poison_blade' }, rng)
    expect(slime.statuses.some((s) => s.kind === 'poison')).toBe(true)
  })

  it('a buff scroll applies statBuff to every ally', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const lena = createCharacter({ classId: 'healer', name: 'Lena', level: 3 })
    const battle = createBattle([aria, lena], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'scroll_battle_anthem' }, rng)
    for (const id of [aria.id, lena.id]) {
      expect(battle.actors[id]!.statuses.some((s) => s.kind === 'statBuff')).toBe(true)
    }
  })

  it('a scroll costs the item action delay', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'scroll_fireball' }, rng)
    const knightEntry = battle.queue.find((e) => e.actorId === aria.id)!
    const expected = BALANCE.actionDelays.item * (BALANCE.spdRef / 6)
    expect(knightEntry.nextAt).toBeCloseTo(expected, 3)
  })

  it('a mana potion restores MP mid-battle', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const knight = battle.actors[aria.id]!
    knight.mp = 10
    const rng = createRng(1)
    actNext(battle, { kind: 'item', itemId: 'mana_potion', targetId: aria.id }, rng)
    expect(knight.mp).toBe(BALANCE.maxMp)
    expect(battle.log[0]!.text).toContain('recovers 20 MP')
  })
})

describe('choosePartyAction (Phase 4 M1)', () => {
  it('resolves the dps preset to a skill at the weakest foe', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    expect(choosePartyAction(battle, aria.id, 'dps')).toEqual({
      kind: 'skill',
      skillId: 'slashing_strike',
      targetId: 'slime#0',
    })
  })

  it('resolves the healer preset to a defend when no ally is hurt', () => {
    const mira = createCharacter({ classId: 'healer', name: 'Mira' })
    const battle = createBattle([mira], [ENEMIES.slime!], 1)
    expect(choosePartyAction(battle, mira.id, 'healer')).toEqual({ kind: 'defend' })
  })

  it('throws a citizen-facing error for an unknown actor', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    expect(() => choosePartyAction(battle, 'ghost', 'dps')).toThrow(/unknown actor/)
  })
})

function reactScript(reactions: CharacterScript['reactions']): CharacterScript {
  return {
    id: 'custom.react',
    name: 'Reactor',
    builtIn: true,
    rootBlock: { id: 'root', depth: 0, lines: [], nested: [] },
    reactions,
    createdAt: 0,
    updatedAt: 0,
  }
}

const reactRule: NonNullable<CharacterScript['reactions']>[number] = {
  id: 'm6.r1',
  gate: { kind: 'attacked', source: 'enemy', target: 'self' },
  target: { kind: 'attacker' },
  action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'thorns' }] },
  delay: 0,
}

describe('battle reactions (phase 4.5.2, M2)', () => {
  it('an enemy attack on the scripted character fires the hired thorns as a reaction', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    aria.loadout = ['thorns']
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    battle.reactionResolver = (characterId) =>
      characterId === aria.id
        ? reactScript([
            {
              id: 'r1',
              gate: { kind: 'attacked', source: 'enemy', target: 'self' },
              target: { kind: 'attacker' },
              action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'thorns' }] },
              delay: 0,
            },
          ])
        : undefined
    const ariaActor = battle.actors[aria.id]!
    const slime = battle.actors['slime#0']!
    const rng = () => 0.5

    const selfHit = actNext(battle, { kind: 'attack', targetId: slime.id }, rng)
    expect(selfHit.log.some((l) => l.text.includes('hits'))).toBe(true)

    battle.queue = [
      { actorId: slime.id, side: 'enemy', nextAt: 0 },
      ...battle.queue.filter((e) => e.actorId !== slime.id),
    ]
    const slimeHpBefore = slime.hp
    const foeHit = actNext(battle, { kind: 'attack', targetId: ariaActor.id }, rng)
    expect(foeHit.log.some((l) => l.text.includes('hits'))).toBe(true)
    expect(slime.hp).toBeLessThan(slimeHpBefore)
    expect(ariaActor.mp).toBe(BALANCE.maxMp - 4)
    expect(battle.pendingEvents).toHaveLength(0)
    expect(battle.reactionQueue).toHaveLength(0)
  })

  it('reactions stay dormant without a resolver', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    aria.loadout = ['thorns']
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const ariaActor = battle.actors[aria.id]!
    const slime = battle.actors['slime#0']!
    const rng = createRng(1)
    actNext(battle, { kind: 'attack', targetId: ariaActor.id }, rng)
    expect(ariaActor.mp).toBe(BALANCE.maxMp)
    expect(slime.statuses).toHaveLength(0)
  })

  it('a delayed reaction queues on the reaction clock and fires on a later pump', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    aria.loadout = ['thorns']
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    battle.reactionResolver = (characterId) =>
      characterId === aria.id
        ? reactScript([
            {
              id: 'slow',
              gate: { kind: 'attacked', source: 'enemy', target: 'self' },
              target: { kind: 'attacker' },
              action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'thorns' }] },
              delay: 120,
            },
          ])
        : undefined
    const ariaActor = battle.actors[aria.id]!
    const slime = battle.actors['slime#0']!
    const rng = () => 0.5

    const selfHit = actNext(battle, { kind: 'attack', targetId: slime.id }, rng)
    expect(selfHit.log.some((l) => l.text.includes('hits'))).toBe(true)

    battle.queue = [
      { actorId: slime.id, side: 'enemy', nextAt: 0 },
      ...battle.queue.filter((e) => e.actorId !== slime.id),
    ]
    const foeHit = actNext(battle, { kind: 'attack', targetId: ariaActor.id }, rng)
    expect(foeHit.log.some((l) => l.text.includes('hits'))).toBe(true)
    expect(battle.reactionQueue).toHaveLength(1)
    expect(battle.reactionQueue[0]!.actorId).toBe(aria.id)
    expect(ariaActor.mp).toBe(BALANCE.maxMp)

    actNext(battle, { kind: 'defend' }, rng)
    actNext(battle, { kind: 'attack', targetId: ariaActor.id }, rng)
    expect(ariaActor.mp).toBe(BALANCE.maxMp - 4)
    expect(battle.reactionQueue).toHaveLength(0)
  })
})

describe('scripted AUTO path (phase 4.5.2, M6)', () => {
  it('a library script resolves the same action as the matching Phase 4 preset', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const id = aria.id
    expect(battle.actors[id]!.ko).toBe(false)
    const fromScript = chooseScriptedAction(BUILT_IN_DPS, buildScriptContext(battle, id), createRng(1))
    const fromPreset = choosePartyAction(battle, id, 'dps', createRng(1))
    expect(fromScript).toEqual(fromPreset)
    expect(fromScript).toEqual({ kind: 'skill', skillId: 'slashing_strike', targetId: 'slime#0' })
  })

  it('the seeded run resolves identically to the dps preset when driven by the library script', () => {
    const drive = (scripted: boolean) => {
      const aria = createCharacter({ classId: 'knight', name: 'Aria' })
      const battle = createBattle([aria], [ENEMIES.slime!], 1)
      const rng = createRng(42)
      const playerId = aria.id
      for (let i = 0; i < 6; i++) {
        const entry = battle.queue[0]!
        if (entry.actorId === playerId) {
          const action = scripted
            ? chooseScriptedAction(BUILT_IN_DPS, buildScriptContext(battle, playerId), rng)
            : choosePartyAction(battle, playerId, 'dps', rng)
          performAction(battle, playerId, action!, rng)
        } else {
          performAction(battle, entry.actorId, chooseEnemyAction(battle, entry.actorId, rng), rng)
        }
        if (battle.over) break
      }
      return battle
    }
    const a = drive(true)
    const b = drive(false)
    const summarize = (battle: ReturnType<typeof createBattle>) =>
      Object.values(battle.actors).map((x) => ({ hp: x.hp, mp: x.mp, ko: x.ko }))
    expect(summarize(a)).toEqual(summarize(b))
    expect(a.turnCount).toEqual(b.turnCount)
  })

  it('reactions from the assigned library script fire on the event bus while AUTO', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    aria.loadout = ['thorns']
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    battle.reactionResolver = (characterId) =>
      characterId === aria.id ? reactScript([reactRule]) : undefined
    const ariaActor = battle.actors[aria.id]!
    const slime = battle.actors['slime#0']!
    const rng = createRng(7)
    battle.queue = [
      { actorId: slime.id, side: 'enemy', nextAt: 0 },
      ...battle.queue.filter((e) => e.actorId !== slime.id),
    ]
    const foeHit = actNext(battle, { kind: 'attack', targetId: ariaActor.id }, rng)
    expect(foeHit.log.some((l) => l.text.includes('hits'))).toBe(true)
    expect(slime.hp).toBeLessThan(slime.stats.hp)
    expect(ariaActor.mp).toBe(BALANCE.maxMp - 4)
  })

  it('reactions still fire while the character is in Manual (mode toggled off)', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    aria.loadout = ['thorns']
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    battle.reactionResolver = (characterId) =>
      characterId === aria.id ? reactScript([reactRule]) : undefined
    const ariaActor = battle.actors[aria.id]!
    const slime = battle.actors['slime#0']!
    const rng = createRng(7)
    battle.queue = [
      { actorId: slime.id, side: 'enemy', nextAt: 0 },
      ...battle.queue.filter((e) => e.actorId !== slime.id),
    ]
    const foeHit = actNext(battle, { kind: 'attack', targetId: ariaActor.id }, rng)
    expect(foeHit.log.some((l) => l.text.includes('hits'))).toBe(true)
    expect(slime.hp).toBeLessThan(slime.stats.hp)
  })

  it('M7 — a reaction item use consumes it from actor.items', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    aria.loadout = ['thorns']
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const reactionScript = reactScript([
      {
        id: 'm7.heal',
        gate: { kind: 'attacked', source: 'enemy', target: 'self' },
        target: { kind: 'self' },
        action: { source: 'items', filters: [{ kind: 'byId', skillId: 'health_potion' }] },
        delay: 0,
      },
    ])
    battle.reactionResolver = (characterId) =>
      characterId === aria.id ? reactionScript : undefined
    const ariaActor = battle.actors[aria.id]!
    ariaActor.items = ['health_potion']
    const slime = battle.actors['slime#0']!
    const rng = createRng(7)
    battle.queue = [
      { actorId: slime.id, side: 'enemy', nextAt: 0 },
      ...battle.queue.filter((e) => e.actorId !== slime.id),
    ]
    actNext(battle, { kind: 'attack', targetId: ariaActor.id }, rng)
    expect(ariaActor.items).toEqual([])
    expect(battle.log.some((l) => l.text.includes('uses Health Potion'))).toBe(true)
  })
})

describe('passives (phase 4.5.2, M2)', () => {
  it('a loadout passive applies its status buff at battle start', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    aria.loadout = ['fortress']
    const battle = createBattle([aria], [ENEMIES.slime!], 1)
    const ariaActor = battle.actors[aria.id]!
    expect(ariaActor.statuses).toEqual([
      expect.objectContaining({ kind: 'statBuff', stat: 'def', power: 1.3 }),
    ])
  })

  it('a party-wide passive fans out to every living ally', () => {
    const aria = createCharacter({ classId: 'knight', name: 'Aria' })
    const lena = createCharacter({ classId: 'healer', name: 'Lena' })
    aria.loadout = ['regen_aura']
    const battle = createBattle([aria, lena], [ENEMIES.slime!], 1)
    for (const id of [aria.id, lena.id]) {
      expect(battle.actors[id]!.statuses.some((s) => s.kind === 'regen')).toBe(true)
    }
  })
})
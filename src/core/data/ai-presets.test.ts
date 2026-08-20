import { describe, expect, it } from 'vitest'
import { createCharacter } from '../character'
import type { AiActorState, AiBattlefield } from '../combat/ai'
import { chooseAction } from '../combat/ai'
import { createRng } from '../rng/rng'
import type { PlayerAiPresetId } from '../types'
import { defaultPresetFor, getPlayerAiScript, PLAYER_AI_SCRIPTS } from './ai-presets'

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

describe('player AI presets (Phase 4 M1)', () => {
  const ids: PlayerAiPresetId[] = ['dps', 'healer']

  it('every preset resolves a valid action for an empty-pocket field', () => {
    for (const id of ids) {
      const field = battle(actor('self', 100, 100), [], [actor('e', 50, 100)])
      const action = chooseAction(PLAYER_AI_SCRIPTS[id], field, createRng(1))
      expect(['attack', 'skill', 'defend']).toContain(action.kind)
    }
  })

  describe('dps', () => {
    const field = (mp: number): AiBattlefield =>
      battle(
        actor('self', 100, 100, { mp, maxMp: 30, skills: ['frost_breath', 'tackle'], skillCosts: { frost_breath: 6, tackle: 4 } }),
        [],
        [actor('a', 60, 100), actor('b', 40, 100)],
      )

    it('casts its primary skill at the weakest foe while affordable', () => {
      expect(chooseAction(PLAYER_AI_SCRIPTS.dps, field(20))).toEqual({ kind: 'skill', skillId: 'frost_breath', targetId: 'b' })
    })

    it('falls back to a basic attack at the weakest foe when MP is spent', () => {
      expect(chooseAction(PLAYER_AI_SCRIPTS.dps, field(1))).toEqual({ kind: 'attack', targetId: 'b' })
    })
  })

  describe('healer', () => {
    const field = (allyHp: number): AiBattlefield =>
      battle(
        actor('self', 100, 100, { mp: 20, maxMp: 30, skills: ['heal', 'tackle'], skillCosts: { heal: 5, tackle: 4 } }),
        [actor('a', allyHp, 100), actor('b', 80, 100)],
        [actor('e', 50, 100)],
      )

    it('heals the lowest-HP ally below 60% when a heal is affordable', () => {
      expect(chooseAction(PLAYER_AI_SCRIPTS.healer, field(30))).toEqual({ kind: 'skill', skillId: 'heal', targetId: 'a' })
    })

    it('defends when every ally is above the threshold', () => {
      expect(chooseAction(PLAYER_AI_SCRIPTS.healer, field(80))).toEqual({ kind: 'defend' })
    })

    it('defends instead of casting when out of MP', () => {
      const empty = battle(
        actor('self', 100, 100, { mp: 0, maxMp: 30, skills: ['heal', 'tackle'], skillCosts: { heal: 5, tackle: 4 } }),
        [actor('a', 30, 100)],
        [actor('e', 50, 100)],
      )
      expect(chooseAction(PLAYER_AI_SCRIPTS.healer, empty)).toEqual({ kind: 'defend' })
    })
  })

  describe('getPlayerAiScript / defaultPresetFor', () => {
    it('returns the canned scripts by id', () => {
      expect(getPlayerAiScript('dps')).toBe(PLAYER_AI_SCRIPTS.dps)
      expect(getPlayerAiScript('healer')).toBe(PLAYER_AI_SCRIPTS.healer)
    })

    it('throws on an unknown preset id', () => {
      expect(() => getPlayerAiScript('ambush' as PlayerAiPresetId)).toThrow(/Unknown player AI preset: "ambush"/)
    })

    it('defaults a healer to the healer preset', () => {
      const mira = createCharacter({ classId: 'healer', name: 'Mira', rng: createRng(2) })
      expect(defaultPresetFor(mira)).toBe('healer')
    })

    it('defaults a knight to the dps preset', () => {
      const aria = createCharacter({ classId: 'knight', name: 'Aria', rng: createRng(3) })
      expect(defaultPresetFor(aria)).toBe('dps')
    })
  })
})
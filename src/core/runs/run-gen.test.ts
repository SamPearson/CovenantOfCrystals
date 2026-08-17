import { describe, expect, it } from 'vitest'
import { BALANCE, ENEMIES, getEnemy } from '../data'
import type { ActiveRun, EnemyDef, RunNode, RunNodeType } from '../types'
import { generateRun, bossMultFor, RUN_LENGTHS } from './run-gen'
import { scaleEnemy } from './enemy-scale'

const ALLOWED_TYPES: RunNodeType[] = ['battle', 'elite', 'rest', 'boss']
const BATTLE_TYPES: RunNodeType[] = ['battle', 'elite', 'boss']

function battleNodes(nodes: RunNode[]): { node: RunNode; battleIndex: number }[] {
  let battleIndex = 0
  const out: { node: RunNode; battleIndex: number }[] = []
  for (const node of nodes) {
    if (BATTLE_TYPES.includes(node.type)) {
      out.push({ node, battleIndex })
      battleIndex += 1
    }
  }
  return out
}

function multFor(type: RunNodeType, length: number): number {
  if (type === 'boss') return bossMultFor(length)
  if (type === 'elite') return BALANCE.run.eliteMult
  return 1
}

/** Total stats of a single enemy — the unit the difficulty curve scales. */
function enemyStats(e: EnemyDef): number {
  return e.stats.hp + e.stats.atk + e.stats.def + e.stats.mag + e.stats.res + e.stats.spd
}

describe('generateRun', () => {
  const PROFILE = 'profile-a'
  const PARTY = ['c1', 'c2', 'c3', 'c4']

  it('throws for lengths outside the starter set', () => {
    for (const bad of [1, 4, 15, 20, 0, -3, 2.5]) {
      expect(() => generateRun(PROFILE, PARTY, bad, 123), `length ${bad}`).toThrow(RangeError)
    }
  })

  it('accepts every starter length', () => {
    for (const length of RUN_LENGTHS) {
      expect(() => generateRun(PROFILE, PARTY, length, 1)).not.toThrow()
    }
  })

  it('snapshots the party ids', () => {
    const run = generateRun(PROFILE, ['x', 'y'], 3, 1)
    expect(run.party).toEqual(['x', 'y'])
  })

  it('produces an identical run for the same seed', () => {
    const a = generateRun(PROFILE, PARTY, 10, 42)
    const b = generateRun(PROFILE, PARTY, 10, 42)
    expect(a).toEqual(b)
  })

  it('produces a different run for a different seed', () => {
    const a = generateRun(PROFILE, PARTY, 10, 42)
    const b = generateRun(PROFILE, PARTY, 10, 43)
    expect(a).not.toEqual(b)
  })

  it('keeps length invariants: battle slots == length, exactly one boss, boss last', () => {
    for (const length of RUN_LENGTHS) {
      const run = generateRun(PROFILE, PARTY, length, 7)
      const battles = battleNodes(run.nodes)
      expect(battles.length, `length ${length}`).toBe(length)
      const bosses = run.nodes.filter((n) => n.type === 'boss')
      expect(bosses.length, `length ${length}`).toBe(1)
      expect(run.nodes[run.nodes.length - 1]!.type, `length ${length}`).toBe('boss')
    }
  })

  it('uses only the known node types', () => {
    for (const length of RUN_LENGTHS) {
      for (const node of generateRun(PROFILE, PARTY, length, 7).nodes) {
        expect(ALLOWED_TYPES).toContain(node.type)
        expect(Number.isInteger(node.index)).toBe(true)
      }
    }
  })

  it('rest cadence: none at length 3, pre-boss at length 5, after #5 at length 10', () => {
    const restCount = (run: ActiveRun) => run.nodes.filter((n) => n.type === 'rest').length

    const run3 = generateRun(PROFILE, PARTY, 3, 9)
    expect(restCount(run3)).toBe(0)

    const run5 = generateRun(PROFILE, PARTY, 5, 9)
    expect(restCount(run5)).toBe(1)
    expect(run5.nodes[run5.nodes.length - 2]!.type).toBe('rest')
    expect(run5.nodes[run5.nodes.length - 1]!.type).toBe('boss')

    const run10 = generateRun(PROFILE, PARTY, 10, 9)
    expect(restCount(run10)).toBe(2)
    expect(run10.nodes[4]!.type).not.toBe('rest')
    expect(run10.nodes[5]!.type).toBe('rest')
    expect(run10.nodes[run10.nodes.length - 2]!.type).toBe('rest')
    expect(run10.nodes[run10.nodes.length - 1]!.type).toBe('boss')
  })

  it('gives every non-boss step 2–3 branching choices; boss has none', () => {
    for (const length of RUN_LENGTHS) {
      for (const node of generateRun(PROFILE, PARTY, length, 11).nodes) {
        if (node.type === 'boss') {
          expect(node.choices).toBeUndefined()
        } else {
          expect(node.choices).toBeDefined()
          expect(node.choices!.length).toBeGreaterThanOrEqual(2)
          expect(node.choices!.length).toBeLessThanOrEqual(3)
          for (const choice of node.choices!) {
            expect(['battle', 'elite', 'rest']).toContain(choice.type)
            expect(choice.label.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('resolves enemy squads on battle/elite/boss nodes and none on rest', () => {
    for (const length of RUN_LENGTHS) {
      const run = generateRun(PROFILE, PARTY, length, 5)
      for (const node of run.nodes) {
        if (node.type === 'rest') {
          expect(node.enemySquad).toBeUndefined()
        } else {
          expect(node.enemySquad).toBeDefined()
          expect(node.enemySquad!.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('squad members match scaleEnemy against the catalog at their node', () => {
    for (const length of RUN_LENGTHS) {
      const run = generateRun(PROFILE, PARTY, length, 5)
      const battles = battleNodes(run.nodes)
      for (const { node, battleIndex } of battles) {
        const mult = multFor(node.type, length)
        for (const member of node.enemySquad!) {
          const base = ENEMIES[member.id]
          expect(base, `length ${length} enemy ${member.id}`).toBeDefined()
          expect(member).toEqual(scaleEnemy(base, battleIndex, length, mult))
        }
      }
    }
  })

  it('scales squads up monotonically across a run', () => {
    for (const length of RUN_LENGTHS) {
      const run = generateRun(PROFILE, PARTY, length, 5)
      const battles = battleNodes(run.nodes)
      for (let i = 1; i < battles.length; i++) {
        const prevIdx = battles[i - 1]!.battleIndex
        const curIdx = battles[i]!.battleIndex
        expect(curIdx).toBe(prevIdx + 1)
      }
    }
  })

  it('boss squad is the peak of the run', () => {
    for (const length of RUN_LENGTHS) {
      const run = generateRun(PROFILE, PARTY, length, 5)
      const battles = battleNodes(run.nodes)
      const bossNode = battles[battles.length - 1]!.node
      expect(bossNode.type).toBe('boss')
      const bossStats = enemyStats(bossNode.enemySquad![0]!)
      for (let i = 0; i < battles.length - 1; i++) {
        for (const e of battles[i]!.node.enemySquad!) {
          expect(bossStats, `length ${length} enemy ${e.id}`).toBeGreaterThan(enemyStats(e))
        }
      }
    }
  })

  it('boss is the single goblin king scaled by the boss multiplier', () => {
    const run = generateRun(PROFILE, PARTY, 10, 5)
    const bossNode = run.nodes[run.nodes.length - 1]!
    expect(bossNode.type).toBe('boss')
    expect(bossNode.enemySquad!.length).toBe(1)
    expect(bossNode.enemySquad![0]!.id).toBe(getEnemy('goblin_king').id)
  })

  it('keeps the 3-battle-run boss in the level 7–10 band', () => {
    for (const seed of [1, 5, 42, 99, 1234]) {
      const run = generateRun(PROFILE, PARTY, 3, seed)
      const boss = run.nodes[run.nodes.length - 1]!
      expect(boss.type).toBe('boss')
      const enemy = boss.enemySquad![0]!
      expect(enemy.level).toBeGreaterThanOrEqual(7)
      expect(enemy.level).toBeLessThanOrEqual(10)
    }
  })
})
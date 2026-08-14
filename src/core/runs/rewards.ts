/**
 * Run reward rolling + banking (Phase 3 M3, `phase-3-run-loop-plan.md` §5).
 * Pure and Phaser-free: every roll is driven by the injected seeded `Rng`, so
 * the same run seed produces the same rewards (reproducible runs, §4).
 */

import { BALANCE, getItem, ITEMS } from '../data'
import { addGear, addItem, createGearInstance } from '../inventory'
import { chance, pick, type Rng } from '../rng/rng'
import type {
  ActiveRun,
  EnemyDef,
  ItemDef,
  PlayerProfile,
  Rarity,
  RewardRoll,
  RunNodeType,
} from '../types'

/** Flat reward banking summary, mirroring the `RunResult` fields it feeds. */
export interface BankingResult {
  goldBanked: number
  itemsBanked: string[]
  /** Permanent GearInstance ids (P3 gear is all-permanent, decision S5). */
  gearBanked: string[]
}

type DropKind = keyof (typeof BALANCE.run)['dropWeights']

const isDropGear = (item: ItemDef): boolean =>
  item.type === 'weapon' || item.type === 'armor'

const GEAR_POOL = Object.values(ITEMS).filter(isDropGear)
const CONSUMABLE_POOL = Object.values(ITEMS).filter(
  (item) => item.type === 'consumable',
)
const SCROLL_POOL = Object.values(ITEMS).filter(
  (item) => item.type === 'scroll' || item.type === 'tome',
)

/** Rarity tiers eligible for drops at a given node index (Phase 5 tunes). */
function allowedRarities(nodeIndex: number): readonly Rarity[] | 'any' {
  if (nodeIndex >= 9) return 'any'
  if (nodeIndex >= 6) return ['common', 'rare', 'epic', 'legendary']
  if (nodeIndex >= 3) return ['common', 'rare', 'epic']
  return ['common', 'rare']
}

function poolFor(kind: DropKind, nodeIndex: number): readonly ItemDef[] {
  const rarities = allowedRarities(nodeIndex)
  const eligible = (item: ItemDef): boolean =>
    rarities === 'any' || rarities.includes(item.rarity)
  if (kind === 'gear') return GEAR_POOL.filter(eligible)
  if (kind === 'consumable') return CONSUMABLE_POOL.filter(eligible)
  return SCROLL_POOL.filter(eligible)
}

/** Rolls one weighted drop (returns the item id, or undefined on miss). */
function rollDrop(rng: Rng, nodeIndex: number): string | undefined {
  if (!chance(rng, BALANCE.run.dropChance)) return undefined
  const weights = BALANCE.run.dropWeights
  const total = weights.gear + weights.consumable + weights.skillItem
  let roll = rng() * total
  let kind: DropKind = 'gear'
  if (roll < weights.gear) {
    kind = 'gear'
  } else {
    roll -= weights.gear
    kind = roll < weights.consumable ? 'consumable' : 'skillItem'
  }
  const pool = poolFor(kind, nodeIndex)
  if (pool.length === 0) return undefined
  return pick(rng, pool).id
}

/**
 * Rolls the reward for a won battle. Node type/index scale drop generosity,
 * the squad's gold/XP provide the bases; every survivor earns the squad's
 * total XP (no leveling, decision S7).
 */
export function rollBattleRewards(
  rng: Rng,
  nodeType: RunNodeType,
  nodeIndex: number,
  survivors: readonly string[],
  squad: readonly EnemyDef[],
): RewardRoll {
  const goldBase = squad.reduce((sum, enemy) => sum + enemy.gold, 0)
  const xpBase = squad.reduce((sum, enemy) => sum + enemy.xp, 0)
  const [lo, hi] = BALANCE.run.goldVariance
  const gold = Math.max(0, Math.round(goldBase * (lo + rng() * (hi - lo))))

  const dropRolls =
    nodeType === 'boss' ? 2 : nodeType === 'elite' ? 2 : 1
  const drops: string[] = []
  for (let i = 0; i < dropRolls; i++) {
    const drop = rollDrop(rng, nodeIndex)
    if (drop !== undefined) drops.push(drop)
  }

  const xp: Record<string, number> = {}
  for (const id of survivors) xp[id] = xpBase

  return { gold, drops, xp }
}

/**
 * Banks a run's accumulated gold + drops into the profile at run resolution.
 * Victory banks everything; failure/abandon bank a partial payout only
 * (full wipe even loses most of it, runs-and-gauntlet.md §5).
 */
export function bankRunRewards(run: ActiveRun, profile: PlayerProfile): BankingResult {
  const ratio =
    run.status === 'active' ? 0 : BALANCE.run.runPayout[run.status]

  const goldBanked = Math.round(run.goldEarned * ratio)
  profile.gold += goldBanked

  const keepCount = Math.floor(run.drops.length * ratio)
  const kept = run.drops.slice(0, keepCount)

  const itemsBanked: string[] = []
  const gearBanked: string[] = []
  for (const itemId of kept) {
    const def = getItem(itemId)
    if (def.type === 'weapon' || def.type === 'armor') {
      const gear = createGearInstance(itemId, { kind: 'permanent' })
      addGear(profile, gear)
      gearBanked.push(gear.id)
    } else {
      addItem(profile, itemId, 1)
      itemsBanked.push(itemId)
    }
  }

  return { goldBanked, itemsBanked, gearBanked }
}
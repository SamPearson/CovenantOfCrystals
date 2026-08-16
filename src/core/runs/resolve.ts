/**
 * Run resolution (Phase 3 M3, `phase-3-run-loop-plan.md` §5). Consumes the
 * battle outcome contract (`docs/combat.md` §7) and applies the run layer:
 * permadeath (combat.md §6), survivor XP accumulation, node advance, and the
 * three run-end states (victory / full wipe / abandon). Pure + Phaser-free.
 */

import type { BattleResult } from '../combat/types'
import { createRng, hashString, type Rng } from '../rng/rng'
import type { ActiveRun, PlayerProfile, RunResult } from '../types'
import { addGear } from '../inventory'
import { findCharacterBox, removeCharacterFromSlot } from '../boxes'
import { bankRunRewards, rollBattleRewards } from './rewards'

/** Seeded rng for a node's reward roll (reproducible per run + node index). */
function rewardRng(run: ActiveRun): Rng {
  return createRng(hashString(`${run.seed}:${run.currentNodeIndex}:rewards`))
}

/**
 * Applies permadeath for one KO'd character (combat.md §6):
 * removed from the party immediately, equipped gear returns to inventory
 * (P3 all-permanent ⇒ always returns), and the roster slot is cleared.
 */
function applyPermadeath(
  run: ActiveRun,
  profile: PlayerProfile,
  characterId: string,
): void {
  const char = profile.characters[characterId]
  if (!char) return
  if (char.gear.weapon) addGear(profile, char.gear.weapon)
  if (char.gear.armor) addGear(profile, char.gear.armor)
  const seat = findCharacterBox(profile, characterId)
  if (seat) removeCharacterFromSlot(profile, seat.boxIndex, seat.slotIndex)
  delete profile.characters[characterId]
  profile.party = profile.party.filter((id) => id !== characterId)
  run.party = run.party.filter((id) => id !== characterId)
}

/** Advances to the next node (which may be a rest node the player resolves). */
function advanceNode(run: ActiveRun): void {
  run.currentNodeIndex += 1
}

function buildResult(
  run: ActiveRun,
  profile: PlayerProfile,
  survivors: string[],
  koIds: string[],
  xpGained: Record<string, number>,
): RunResult {
  const banking = bankRunRewards(run, profile)
  const status = run.status === 'won' ? 'won' : run.status === 'lost' ? 'lost' : 'abandoned'
  return {
    status,
    survivors,
    koIds,
    goldBanked: banking.goldBanked,
    itemsBanked: banking.itemsBanked,
    gearBanked: banking.gearBanked,
    xpGained,
  }
}

/**
 * Resolves a finished battle against the run. Earnings accumulate on the run
 * (gold/drops); on a run-ending result they are banked and a `RunResult`
 * returned, otherwise the function returns null and the run continues.
 */
export function resolveBattleResult(
  run: ActiveRun,
  battleResult: BattleResult,
  profile: PlayerProfile,
): RunResult | null {
  // 1. Permadeath: KO'd characters die immediately (combat.md §6).
  for (const id of battleResult.koIds) {
    applyPermadeath(run, profile, id)
  }

  const node = run.nodes[run.currentNodeIndex]
  const survivors = battleResult.survivors

  // 2. Victory: roll rewards, award XP to survivors.
  if (battleResult.status === 'won') {
    const rng = rewardRng(run)
    const reward = rollBattleRewards(
      rng,
      node.type,
      node.index,
      survivors,
      node.enemySquad ?? [],
    )
    run.goldEarned += reward.gold
    run.drops.push(...reward.drops)
    for (const id of survivors) {
      const char = profile.characters[id]
      if (char) char.xp += reward.xp[id] ?? 0
    }
    if (node.type === 'boss') {
      run.status = 'won'
      return buildResult(run, profile, survivors, battleResult.koIds, reward.xp)
    }
    advanceNode(run)
    return null
  }

  // 3. Lost — full wipe: the entire party is dead; the run ends immediately,
  //    survivors (nobody) carry nothing further.
  if (battleResult.status === 'lost') {
    run.status = 'lost'
    return buildResult(run, profile, [], battleResult.koIds, {})
  }

  // 4. Fled — the party escaped the battle; run ends as abandoned.
  run.status = 'abandoned'
  return buildResult(run, profile, survivors, battleResult.koIds, {})
}

/**
 * Resolves a rest node: party HP/MP restore. The data layer stores no
 * persistent HP/MP (Table scenes rebuild full-HP actors), so restore is a
 * no-op here; the node is simply advanced past.
 */
export function resolveRestNode(run: ActiveRun): void {
  advanceNode(run)
}

/**
 * Durability tick at run resolution. P3 gear is all-permanent (decision S5),
 * so the tick is a no-op — kept as an explicit hook for Phase 5 expiring gear.
 */
export function tickDurability(_profile: PlayerProfile): void {
  // no-op in P3: all durability is 'permanent'
}
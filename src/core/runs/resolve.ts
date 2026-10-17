/**
 * Run resolution (Phase 3 M3, `phase-3-run-loop-plan.md` §5). Consumes the
 * battle outcome contract (`docs/combat.md` §7) and applies the run layer:
 * permadeath (combat.md §6), survivor XP accumulation, node advance, and the
 * three run-end states (victory / full wipe / abandon). Pure + Phaser-free.
 */

import type { BattleResult, BattleLogEntry } from '../combat/types'
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
 *
 * In infinite mode, the character instead has HP clamped to 0 on the
 * Character object and stays in the party so the next battle starts them at
 * HP 0.
 */
function applyPermadeath(
  run: ActiveRun,
  profile: PlayerProfile,
  characterId: string,
): void {
  if (run.infinite) {
    // In infinite mode: keep character in the party but persist HP=0 (and
    // restore MP so they can be healed).
    const char = profile.characters[characterId]
    if (char) {
      char.hp = 0
      char.mp = (char.mp ?? 0) // restore MP on KO
    }
    return
  }
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

/** Advances to the next node (which may be a rest node the player resolves).
 *
 * In infinite mode, wrapping past the end loops back to the start.
 * In normal mode the index may run past the array end (the caller
 * checks node type / status to decide whether the run has ended).
 */
function advanceNode(run: ActiveRun): void {
  run.currentNodeIndex += 1
  if (run.infinite && run.currentNodeIndex >= run.nodes.length) {
    run.currentNodeIndex = 0
    run.loops = (run.loops ?? 0) + 1
  }
}

/**
 * Resets the node map back to index 0 for infinite mode looping.
 * In infinite runs the same node map is replayed; the run continues
 * seamlessly after a full party wipe (characters stay alive at HP 0).
 */
function loopRun(run: ActiveRun): void {
  run.currentNodeIndex = 0
  run.loops = (run.loops ?? 0) + 1
}

function buildResult(
  run: ActiveRun,
  profile: PlayerProfile,
  survivors: string[],
  koIds: string[],
  xpGained: Record<string, number>,
  battleLog?: BattleLogEntry[],
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
    battleLog,
  }
}

/**
 * Resolves a finished battle against the run. Earnings accumulate on the run
 * (gold/drops); on a run-ending result they are banked and a `RunResult`
 * returned, otherwise the function returns null and the run continues.
 *
 * Infinite mode (run.infinite): characters stay alive at HP 0 on defeat, the
 * party never fully wipes, XP/gold continue to accumulate, and when the
 * node map is exhausted the run loops back to the start.
 */
export function resolveBattleResult(
  run: ActiveRun,
  battleResult: BattleResult,
  profile: PlayerProfile,
): RunResult | null {
  // 1. Permadeath: KO'd characters die immediately (combat.md §6).
  //    In infinite mode, KO'd characters stay alive (at HP 0).
  for (const id of battleResult.koIds) {
    applyPermadeath(run, profile, id)
  }

  const node = run.nodes[run.currentNodeIndex]
  const survivors = battleResult.survivors

  // In infinite mode, persist HP/MP for survivors back to their Character.
  if (run.infinite && battleResult.survivorHp) {
    for (const [id, hp] of Object.entries(battleResult.survivorHp)) {
      const char = profile.characters[id]
      if (char) {
        char.hp = hp
        char.mp = Math.min(hp > 0 ? (char.mp ?? 0) : 0, char.mp ?? 0)
      }
    }
  }

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
      return buildResult(run, profile, survivors, battleResult.koIds, reward.xp, battleResult.log)
    }
    advanceNode(run)
    return null
  }

  // 3. Lost — full wipe: the entire party is dead.
  //    In infinite mode, characters stay at HP 0; reset to node 0 and continue.
  if (battleResult.status === 'lost') {
    if (run.infinite) {
      loopRun(run)
      return null
    }
    run.status = 'lost'
    return buildResult(run, profile, [], battleResult.koIds, {}, battleResult.log)
  }

  // 4. Fled — the party escaped the battle; run ends as abandoned.
  run.status = 'abandoned'
  return buildResult(run, profile, survivors, battleResult.koIds, {}, battleResult.log)
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

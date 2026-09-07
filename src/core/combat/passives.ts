import type { BattleState } from './types'
import { getSkill } from '../data'
import { applyStatus } from './status'

/**
 * Phase 4.5.2 — passive skills (S7). A passive is always active at battle start
 * and its effect persists until battle end. It is applied once, here, to each
 * actor whose *loadout* includes it (S10).
 *
 * A passive whose `targets` is `all-allies` fans out to every living actor on
 * the owner's side (party-wide effects like Regen Aura); single-target
 * passives apply to the owner themselves. The effect duration is authored on
 * the skill (seeds use a whole-battle duration).
 *
 * Called from `createBattle` after actors are built.
 */
export function applyPassivesAtBattleStart(battle: BattleState): void {
  for (const actor of Object.values(battle.actors)) {
    if (actor.ko) continue
    for (const skillId of actor.skills ?? []) {
      const skill = getSkill(skillId)
      if (skill.type === 'passive' && skill.effect) {
        if (skill.targets === 'all-allies') {
          const allies = Object.values(battle.actors).filter(
            (a) => a.side === actor.side && !a.ko,
          )
          for (const ally of allies) applyStatus(ally, skill.effect)
        } else {
          applyStatus(actor, skill.effect)
        }
      }
    }
  }
}
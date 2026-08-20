/**
 * Battle orchestration (Phase 2, M4). Wires the timeline, damage, status and
 * AI modules into a complete turn loop per `docs/combat.md` §3, and produces
 * the `BattleResult` outcome contract (§7) for the run layer (Phase 3).
 *
 * The engine never mutates meta state: full-wipe / permadeath is *detected*
 * here (via `getBattleResult`'s `koIds`) and *applied* by the run layer.
 */

import type {
  BattleAction,
  BattleActor,
  BattleLogEntry,
  BattleResult,
  BattleState,
  TurnOutcome,
} from './types'
import type { Character, EnemyDef, PlayerAiPresetId, SkillDef } from '../types'
import { derivedStats } from '../character'
import { getClass, getSkill, getItem, getAiScript, getPlayerAiScript, BALANCE } from '../data'
import { timeToNextTurn, insertActor, removeActor, peekNext } from './timeline'
import {
  physicalDamage,
  magicalDamage,
  finalizeDamage,
  hitCheck,
  rollCrit,
  healMagic,
  itemHeal,
} from './damage'
import {
  tickOwnTurnEffects,
  tickPoison,
  tickDurations,
  isCrowdControlled,
  wakeOnDamage,
  cleanse,
  effectiveModifier,
  effectiveAccuracy,
  applyStatus,
} from './status'
import { chooseAction, type AiBattlefield, type AiActorState } from './ai'
import type { Rng } from '../rng/rng'

const WAITING_DELAY = BALANCE.actionDelays.attack

/** Creates a seeded battle state: party vs. enemy squad on a shared CTB queue. */
export function createBattle(
  partyDefs: Character[],
  enemyDefs: EnemyDef[],
  seed: number,
): BattleState {
  const actors: Record<string, BattleActor> = {}
  const queue: BattleState['queue'] = []

  for (const c of partyDefs) {
    const classDef = getClass(c.classId)
    const stats = derivedStats(c)
    const actor: BattleActor = {
      id: c.id,
      sourceId: c.id,
      side: 'player',
      name: c.name,
      stats,
      hp: stats.hp,
      mp: BALANCE.maxMp,
      statuses: [],
      ko: false,
      element: classDef.element,
      skills: c.loadout.slice(),
      maxMp: BALANCE.maxMp,
      cooldowns: {},
      defending: false,
      ownTurn: 0,
    }
    actors[c.id] = actor
    queue.push({ actorId: actor.id, side: 'player', nextAt: 0 })
  }

  enemyDefs.forEach((def, i) => {
    const id = `${def.id}#${i}`
    const actor: BattleActor = {
      id,
      sourceId: def.id,
      side: 'enemy',
      name: def.name,
      stats: def.stats,
      hp: def.stats.hp,
      mp: 0,
      statuses: [],
      ko: false,
      element: def.element,
      skills: def.skills.slice(),
      maxMp: 0,
      cooldowns: {},
      defending: false,
      ownTurn: 0,
      aiProfile: def.ai,
    }
    actors[id] = actor
    queue.push({ actorId: id, side: 'enemy', nextAt: 0 })
  })

  // Everyone opens on the same clock tick; the sort tie-breaks player-first
  // then by actorId, so the party takes the initiative at battle start.
  queue.sort((a, b) =>
    a.nextAt !== b.nextAt
      ? a.nextAt - b.nextAt
      : a.side !== b.side
        ? a.side === 'player'
          ? -1
          : 1
        : a.actorId.localeCompare(b.actorId),
  )

  return {
    seed,
    actors,
    queue,
    turnTime: 0,
    turnCount: 0,
    log: [],
    status: 'ongoing',
    over: false,
  }
}

/** Resolves one actor's turn. The actor must be the front of the queue. */
export function performAction(
  battle: BattleState,
  actorId: string,
  action: BattleAction,
  rng: Rng,
): TurnOutcome {
  if (battle.over) throw new Error('battle is already over')
  const entry = peekNext(battle.queue)
  if (!entry || entry.actorId !== actorId) {
    throw new Error(`cannot act: ${actorId} is not the next actor in the queue`)
  }
  battle.turnTime = entry.nextAt
  battle.queue = removeActor(battle.queue, actorId)

  battle.turnCount += 1
  const turn = battle.turnCount
  const actor = battle.actors[actorId]
  if (!actor) throw new Error(`unknown actor: ${actorId}`)
  if (actor.ko) throw new Error(`cannot act: ${actorId} is KO'd`)

  actor.ownTurn = (actor.ownTurn ?? 0) + 1
  // Defend halves damage only until the defender's next own turn (§4).
  actor.defending = false
  const cooldowns = actor.cooldowns ?? {}
  for (const key of Object.keys(cooldowns)) {
    if (cooldowns[key]! > 0) cooldowns[key]! -= 1
  }

  const log: BattleLogEntry[] = []
  const push = (text: string, who?: string): void => {
    log.push({ id: battle.log.length, turn, actorId: who, text })
    battle.log.push(log[log.length - 1]!)
  }

  // 1. Own-turn status effects tick first; a lethal tick ends the turn (§3).
  const tick = tickOwnTurnEffects(actor)
  if (tick.burnDamage > 0) push(`${actor.name} burns for ${tick.burnDamage}.`, actor.id)
  if (tick.regenHeal > 0) push(`${actor.name} regenerates ${tick.regenHeal} HP.`, actor.id)
  if (tick.ko) {
    actor.hp = 0
    actor.ko = true
    push(`${actor.name} falls.`, actor.id)
    finishTurn(battle, actor, push)
    return { actorId, action: null, log }
  }

  // 2. Crowd-control check: skip the action, counters tick down (§3).
  if (isCrowdControlled(actor)) {
    push(`${actor.name} cannot act (${ccLabel(actor)}).`, actor.id)
    const expired = tickDurations(actor)
    for (const e of expired) push(`${actor.name}'s ${e.kind} wore off.`, actor.id)
    finishTurn(battle, actor, push, WAITING_DELAY)
    return { actorId, action: null, log }
  }

  // 3. Resolve the action.
  let delay: number
  switch (action.kind) {
    case 'defend':
      actor.defending = true
      push(`${actor.name} defends.`, actor.id)
      delay = BALANCE.actionDelays.defend
      break
    case 'escape':
      battle.status = 'fled'
      battle.over = true
      push(`${actor.name} attempts to flee.`, actor.id)
      return { actorId, action, log }
    case 'attack':
      delay = resolveAttack(battle, actor, action, rng, push)
      break
    case 'skill':
      delay = resolveSkill(battle, actor, action, rng, push)
      break
    case 'item':
      delay = resolveItem(battle, actor, action, rng, push)
      break
  }

  // 4. This actor's own-turn status durations tick down (§3).
  const expired = tickDurations(actor)
  for (const e of expired) push(`${actor.name}'s ${e.kind} wore off.`, actor.id)

  // 5–6. Re-insert, then advance the clock and check battle end.
  finishTurn(battle, actor, push, delay)
  return { actorId, action, log }
}

function resolveAttack(
  battle: BattleState,
  actor: BattleActor,
  action: BattleAction,
  rng: Rng,
  push: (text: string, who?: string) => void,
): number {
  const target = pickTarget(battle, actor, 'enemy', action.targetId)
  const atk = effectiveStat(actor, 'atk')
  const def = effectiveStat(target, 'def')
  const accuracy = effectiveAccuracy(actor, 1)
  if (!hitCheck(accuracy, BALANCE.dodgeRate, rng)) {
    push(`${actor.name}'s attack misses ${target.name}.`, actor.id)
    return BALANCE.actionDelays.attack
  }
  const rating = physicalDamage(BALANCE.basicAttackPower, atk, def)
  const damage = finalizeDamage(rating, {
    attackElement: actor.element ?? 'none',
    defendElement: target.element ?? 'none',
    defending: target.defending,
    varianceRoll: rng(),
    crit: rollCrit(rng, BALANCE.critRate),
  })
  return dealDamage(battle, actor, target, damage, push, BALANCE.actionDelays.attack)
}

function resolveSkill(
  battle: BattleState,
  actor: BattleActor,
  action: BattleAction,
  rng: Rng,
  push: (text: string, who?: string) => void,
): number {
  const skillId = action.skillId
  if (!skillId) throw new Error(`skill action without a skillId for ${actor.id}`)
  const skill = getSkill(skillId)
  if (!(actor.skills ?? []).includes(skillId)) {
    throw new Error(`${actor.name} does not know skill "${skillId}"`)
  }
  const delay = skill.delay ?? BALANCE.actionDelays.skill

  if ((actor.cooldowns ?? {})[skillId]! > 0) {
    push(`${actor.name} tries ${skill.name} but it is on cooldown.`, actor.id)
    return delay
  }
  if (actor.mp < skill.cost) {
    push(`${actor.name} lacks the MP for ${skill.name}.`, actor.id)
    return delay
  }

  actor.mp -= skill.cost
  if (skill.cooldown) (actor.cooldowns ??= {})[skillId] = skill.cooldown
  castSkill(battle, actor, skill, action.targetId, rng, push)

  return delay
}

/**
 * Applies a skill to its resolved targets (damage / heal / utility / status).
 * Shared by the Skill action and scroll items (`resolveItem`), which bypass the
 * MP / cooldown / ownership checks — the "spells in item form" extension
 * `docs/combat.md` §11 reserves.
 */
function castSkill(
  battle: BattleState,
  actor: BattleActor,
  skill: SkillDef,
  targetId: string | undefined,
  rng: Rng,
  push: (text: string, who?: string) => void,
): void {
  const targets = resolveTargets(battle, actor, skill, targetId)

  if (skill.kind === 'damage') {
    const scaling =
      skill.scaling === 'mag' ? effectiveStat(actor, 'mag') : effectiveStat(actor, 'atk')
    for (const target of targets) {
      const defense =
        skill.scaling === 'mag' ? effectiveStat(target, 'res') : effectiveStat(target, 'def')
      const rating =
        skill.scaling === 'mag'
          ? magicalDamage(skill.power, scaling, defense)
          : physicalDamage(skill.power, scaling, defense)
      const damage = finalizeDamage(rating, {
        attackElement: skill.element,
        defendElement: target.element ?? 'none',
        defending: target.defending,
        varianceRoll: rng(),
        crit: rollCrit(rng, BALANCE.critRate),
      })
      dealDamage(battle, actor, target, damage, push)
    }
  } else if (skill.kind === 'heal') {
    const mag = effectiveStat(actor, 'mag')
    for (const target of targets) {
      const amount = healMagic(skill.power, mag)
      const healed = Math.min(target.stats.hp - target.hp, amount)
      target.hp += healed
      push(`${target.name} recovers ${healed} HP.`, actor.id)
    }
  } else if (skill.kind === 'utility') {
    for (const target of targets) {
      const removed = cleanse(target)
      if (removed.length > 0) push(`${target.name} is cleansed.`, actor.id)
    }
  }

  if (skill.effect) {
    for (const target of targets) {
      if (target.ko) continue
      if (applyStatus(target, skill.effect)) {
        push(`${target.name} gets ${skill.effect.kind}.`, actor.id)
      }
    }
  }
}

function resolveItem(
  battle: BattleState,
  actor: BattleActor,
  action: BattleAction,
  rng: Rng,
  push: (text: string, who?: string) => void,
): number {
  if (!action.itemId) throw new Error(`item action without an itemId for ${actor.id}`)
  const item = getItem(action.itemId)

  // Scrolls cast their skill with no MP cost and no cooldown (`docs/combat.md` §11).
  if (item.castSkill) {
    const skill = getSkill(item.castSkill)
    push(`${actor.name} uses ${item.name}.`, actor.id)
    castSkill(battle, actor, skill, action.targetId, rng, push)
    return BALANCE.actionDelays.item
  }

  const use = item.use
  if (!use) throw new Error(`item "${item.id}" has no use effect`)

  if (use.healHp) {
    const target = pickTarget(battle, actor, 'ally', action.targetId)
    const amount = itemHeal(use.healHp)
    const healed = Math.min(target.stats.hp - target.hp, amount)
    target.hp += healed
    push(`${actor.name} uses ${item.name}: ${target.name} recovers ${healed} HP.`, actor.id)
  }
  if (use.healMp) {
    const target = pickTarget(battle, actor, 'ally', action.targetId)
    const maxMp = target.maxMp ?? BALANCE.maxMp
    const amount = itemHeal(use.healMp)
    const recovered = Math.min(maxMp - target.mp, amount)
    target.mp += recovered
    push(`${actor.name} uses ${item.name}: ${target.name} recovers ${recovered} MP.`, actor.id)
  }
  return BALANCE.actionDelays.item
}

function finishTurn(
  battle: BattleState,
  actor: BattleActor,
  push: (text: string, who?: string) => void,
  delay?: number,
): void {
  if (delay !== undefined && !actor.ko && !battle.over) {
    const spd = effectiveStat(actor, 'spd')
    const nextAt = battle.turnTime + timeToNextTurn(spd, delay)
    battle.queue = insertActor(battle.queue, actor.id, actor.side, nextAt)
  }

  // Poison interval fires every N resolved turns, globally (§5).
  if (battle.turnCount % BALANCE.poisonInterval === 0) {
    const living = Object.values(battle.actors).filter((a) => !a.ko)
    for (const tick of tickPoison(living)) {
      const victim = battle.actors[tick.actorId]!
      victim.hp = 0
      victim.ko = true
      battle.queue = removeActor(battle.queue, victim.id)
      const wasSleeping = victim.statuses.some((s) => s.kind === 'sleep')
      if (wasSleeping) wakeOnDamage(victim)
      push(`${victim.name} takes ${tick.damage} poison damage.`, victim.id)
    }
  }

  // Battle-end check — the party side wins ties for simultaneous wipes.
  const partyAlive = Object.values(battle.actors).some((a) => a.side === 'player' && !a.ko)
  const enemiesAlive = Object.values(battle.actors).some((a) => a.side === 'enemy' && !a.ko)
  if (!enemiesAlive) {
    battle.status = 'won'
    battle.over = true
    push('Victory! The enemy party is defeated.')
  } else if (!partyAlive) {
    battle.status = 'lost'
    battle.over = true
    push('Defeat — the party has been wiped out.')
  }
}

function dealDamage(
  battle: BattleState,
  attacker: BattleActor,
  target: BattleActor,
  damage: number,
  push: (text: string, who?: string) => void,
  fallbackDelay?: number,
): number {
  const wasSleeping = target.statuses.some((s) => s.kind === 'sleep')
  if (damage > 0 && wasSleeping) wakeOnDamage(target)
  target.hp = Math.max(0, target.hp - damage)
  if (target.hp === 0) {
    target.ko = true
    battle.queue = removeActor(battle.queue, target.id)
    push(`${target.name} falls.`, attacker.id)
  } else {
    push(`${attacker.name} hits ${target.name} for ${damage}.`, attacker.id)
  }
  return fallbackDelay ?? 0
}

/** Effective stat after statBuff/statDebuff modifiers (§5). */
function effectiveStat(actor: BattleActor, stat: keyof BattleActor['stats']): number {
  const base = actor.stats[stat] ?? 0
  const buff = effectiveModifier(actor, 'statBuff', stat, BALANCE)
  const debuff = effectiveModifier(actor, 'statDebuff', stat, BALANCE)
  return base * buff * debuff
}

/** Living actors on a side; insertion order keeps target picks deterministic. */
function livingActors(battle: BattleState, side: BattleActor['side']): BattleActor[] {
  return Object.values(battle.actors).filter((a) => a.side === side && !a.ko)
}

/** Picks a target: explicit id when given, else the lowest-hp living foe/ally. */
function pickTarget(
  battle: BattleState,
  actor: BattleActor,
  kind: 'enemy' | 'ally',
  targetId?: string,
): BattleActor {
  if (targetId) {
    const target = battle.actors[targetId]
    if (!target) throw new Error(`unknown target: ${targetId}`)
    if (target.ko) throw new Error(`target ${targetId} is KO'd`)
    return target
  }
  const side = kind === 'enemy' ? (actor.side === 'player' ? 'enemy' : 'player') : actor.side
  const pool = livingActors(battle, side)
  if (pool.length === 0) throw new Error(`no living ${kind} to target`)
  return pool.reduce((lowest, a) => (a.hp < lowest.hp ? a : lowest), pool[0]!)
}

/** Skill targets (single → lowest-hp living; self/allies/enemies per def). */
function resolveTargets(
  battle: BattleState,
  actor: BattleActor,
  skill: SkillDef,
  targetId?: string,
): BattleActor[] {
  switch (skill.targets) {
    case 'self':
      return [actor]
    case 'all-allies':
      return livingActors(battle, actor.side)
    case 'all-enemies':
      return livingActors(battle, actor.side === 'player' ? 'enemy' : 'player')
    case 'single':
    default:
      if (targetId) {
        const target = battle.actors[targetId]
        if (!target) throw new Error(`unknown target: ${targetId}`)
        if (target.ko) throw new Error(`target ${targetId} is KO'd`)
        return [target]
      }
      const foe =
        skill.kind === 'heal' || skill.kind === 'utility' || skill.kind === 'buff'
          ? 'ally'
          : 'enemy'
      return [pickTarget(battle, actor, foe)]
  }
}

function ccLabel(actor: BattleActor): string {
  return actor.statuses.some((s) => s.kind === 'freeze') ? 'frozen' : 'asleep'
}

/** Snapshot an actor for the AI interpreter (`src/core/combat/ai.ts`). */
function toAiState(actor: BattleActor): AiActorState {
  const skills = actor.skills ?? []
  const skillCosts: Record<string, number> = {}
  for (const skillId of skills) skillCosts[skillId] = getSkill(skillId).cost
  return {
    id: actor.id,
    hp: actor.hp,
    maxHp: actor.stats.hp,
    mp: actor.mp,
    maxMp: actor.maxMp ?? BALANCE.maxMp,
    statuses: actor.statuses.map((s) => s.kind),
    skills,
    cooldowns: actor.cooldowns,
    skillCosts,
  }
}

/** Builds the AI battlefield view for an actor's turn. */
export function buildAiField(battle: BattleState, actorId: string): AiBattlefield {
  const actor = battle.actors[actorId]!
  const enemySide: BattleActor['side'] = actor.side === 'player' ? 'enemy' : 'player'
  return {
    self: toAiState(actor),
    allies: livingActors(battle, actor.side).map(toAiState),
    enemies: livingActors(battle, enemySide).map(toAiState),
    turn: actor.ownTurn ?? 1,
    turnCount: battle.turnCount,
  }
}

/** Resolves an enemy actor's action from its AI profile script (§8). */
export function chooseEnemyAction(
  battle: BattleState,
  actorId: string,
  rng?: Rng,
): BattleAction {
  const actor = battle.actors[actorId]
  if (!actor) throw new Error(`unknown actor: ${actorId}`)
  const script = getAiScript(actor.aiProfile ?? 'minion')
  return chooseAction(script, buildAiField(battle, actorId), rng)
}

/** Resolves a party actor's action from a Phase 4 autobattle preset script. */
export function choosePartyAction(
  battle: BattleState,
  actorId: string,
  presetId: PlayerAiPresetId,
  rng?: Rng,
): BattleAction {
  const actor = battle.actors[actorId]
  if (!actor) throw new Error(`unknown actor: ${actorId}`)
  return chooseAction(getPlayerAiScript(presetId), buildAiField(battle, actorId), rng)
}

/** The outcome contract (§7). Throws if the battle is not finished. */
export function getBattleResult(battle: BattleState): BattleResult {
  if (!battle.over) throw new Error('battle is not over yet')
  const party = Object.values(battle.actors).filter((a) => a.side === 'player')
  return {
    status: battle.status as BattleResult['status'],
    koIds: party.filter((a) => a.ko).map((a) => a.sourceId),
    survivors: party.filter((a) => !a.ko).map((a) => a.sourceId),
    // EnemyDefs carry no xp/drops yet — shapes are emitted empty (Phase 3/5 fills them).
    xpAwarded: {},
    drops: [],
    log: battle.log,
  }
}

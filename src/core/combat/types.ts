/**
 * Combat engine contract types (`docs/combat.md`, Phase 2 plan §4). These are
 * the shapes the engine produces and consumes — the run layer (Phase 3) reads
 * `BattleResult`; the engine never mutates meta state.
 *
 * They replace the informal `BattleState` / `BattleActor` sketch in
 * `docs/data-model.md` §5: the static `turnOrder`/`round` fields give way to a
 * live CTB queue; no derived state is stored beyond it.
 */

import type { StatBlock, StatKey, Element, AiProfileId } from '../types'

export type CombatantSide = 'player' | 'enemy'

/** A single combatant's slot on the shared CTB timeline. */
export interface TimelineEntry {
  actorId: string
  side: CombatantSide
  /** Absolute battle-clock position at which the actor next acts. */
  nextAt: number
}

export type BattleActionKind = 'attack' | 'skill' | 'item' | 'defend' | 'escape'

/** A combatant's chosen action for a turn (the engine's input, not UI). */
export interface BattleAction {
  kind: BattleActionKind
  skillId?: string
  itemId?: string
  targetId?: string
}

/**
 * Live status kinds. `shield` / `taunt` / `stun` stay in the union as a types
 * stub but are out of the v1 engine (`docs/combat.md` §11).
 */
export type ActiveStatusKind =
  | 'statBuff'
  | 'statDebuff'
  | 'burn'
  | 'poison'
  | 'regen'
  | 'sleep'
  | 'blind'
  | 'freeze'
  | 'shield'
  | 'taunt'
  | 'stun'

/** A live status on an actor. Durations count the affected actor's own turns. */
export interface ActiveStatus {
  kind: ActiveStatusKind
  power?: number
  stat?: StatKey
  /** Remaining affected-actor own turns. */
  duration: number
}

export interface BattleActor {
  /** In-battle instance id (characterId, or a per-battle enemy id). */
  id: string
  /** Source characterId or enemyId (for logs, rewards, permadeath). */
  sourceId: string
  side: CombatantSide
  name: string
  /** Resolved stat block (class + level + gear). */
  stats: StatBlock
  hp: number
  mp: number
  statuses: ActiveStatus[]
  ko: boolean
  /**
   * Battle-time extras — populated by `createBattle` in `battle.ts`. They are
   * optional on the type so unit fixtures (`status.test.ts` etc.) can keep
   * building minimal actors; the engine always sets them.
   */
  /** Attacker element (character class element, or the enemy def's element). */
  element?: Element
  /** Skill ids the actor can cast (character loadout, or enemy skill list). */
  skills?: string[]
  /** MP pool ceiling — needed to clamp heal-item/heal-skill recovery. */
  maxMp?: number
  /** Remaining own-turn cooldowns, keyed by skillId. */
  cooldowns?: Record<string, number>
  /** True while the actor is defending (`docs/combat.md` §4). */
  defending?: boolean
  /** Own turn counter (1-based) driving AI `turns` / `turns-mod` calendars. */
  ownTurn?: number
  /** AI profile for enemy actors (`docs/combat.md` §8). */
  aiProfile?: AiProfileId
}

export interface BattleLogEntry {
  id: number
  /** Global resolved-turn counter at the event. */
  turn: number
  actorId?: string
  text: string
}

export interface TurnOutcome {
  actorId: string
  /** Null when the turn resolved without an action (CC skip, KO tick). */
  action: BattleAction | null
  log: BattleLogEntry[]
}

export type BattleStatus = 'ongoing' | 'won' | 'lost' | 'fled'

export interface BattleState {
  seed: number
  actors: Record<string, BattleActor>
  /** Shared CTB timeline, sorted by `nextAt`; the front entry acts next. */
  queue: TimelineEntry[]
  /** Battle clock — the time of the last resolved turn. */
  turnTime: number
  /** Resolved turns so far (drives the poison interval ticker). */
  turnCount: number
  log: BattleLogEntry[]
  status: BattleStatus
  over: boolean
}

export interface Loot {
  itemId: string
  count: number
}

export type BattleResultStatus = 'won' | 'lost' | 'fled'

/** The outcome contract (`docs/combat.md` §7) — the run layer consumes it. */
export interface BattleResult {
  status: BattleResultStatus
  /** Party character IDs KO'd (→ permadeath). */
  koIds: string[]
  /** Surviving party character IDs. */
  survivors: string[]
  xpAwarded: Record<string, number>
  drops: Loot[]
  log: BattleLogEntry[]
}
/**
 * Pure display-label helpers for the scripting DSL. Kept free of Phaser so
 * they are unit testable (mirrors `format.ts`). Converts every scripting
 * type into a short human-readable string for the Automation Window.
 */

import {
  elementLabel,
  statLabel,
  itemTypeLabel,
  truncate,
} from './format'
import { getSkill, getItem } from '../../core/data'
import type {
  Trigger,
  Condition,
  TargetRule,
  SkillSelector,
  SkillSelectorFilter,
  EventPattern,
  ScriptLine,
  CharacterScript,
  CompareOp,
  ConditionScope,
  ScriptBlock,
} from '../../core/scripting/types'

const OP_GLYPH: Record<CompareOp, string> = {
  '<': '<',
  '<=': '≤',
  '>': '>',
  '>=': '≥',
  '==': '=',
  '!=': '≠',
}

const SCOPE_LABEL: Record<ConditionScope, string> = {
  self: 'Self',
  'any-ally': 'any ally',
  'all-allies': 'all allies',
  'lowest-hp-ally': 'lowest-HP ally',
  'highest-hp-ally': 'highest-HP ally',
  'any-enemy': 'any enemy',
  'all-enemies': 'all enemies',
  'lowest-hp-enemy': 'lowest-HP enemy',
  'highest-hp-enemy': 'highest-HP enemy',
  attacker: 'the attacker',
  'trigger-target': 'the trigger target',
  'previous-trigger-target': 'the previous trigger target',
}

const STATUS_LABEL: Record<string, string> = {
  statBuff: 'a stat buff',
  statDebuff: 'a stat debuff',
  burn: 'burn',
  poison: 'poison',
  regen: 'regen',
  sleep: 'sleep',
  blind: 'blind',
  freeze: 'freeze',
  shield: 'shield',
  taunt: 'taunt',
  stun: 'stun',
}

const RANK_LABEL: Record<string, string> = {
  normal: 'Normal',
  elite: 'Elite',
  boss: 'Boss',
}

function scopePhrase(scope: ConditionScope): string {
  // Capitalize the start of a phrase so "Self has status" reads correctly.
  const s = SCOPE_LABEL[scope]
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function compareText(op: CompareOp, value: number, unit = ''): string {
  return `${OP_GLYPH[op]} ${value}${unit}`
}

export function conditionLabel(c: Condition): string {
  switch (c.kind) {
    case 'always':
      return 'Always'
    case 'never':
      return 'Never'
    case 'hp-pct':
      return `${scopePhrase(c.scope)} HP ${compareText(c.op, c.value, '%')}`
    case 'mp-pct':
      return `${scopePhrase(c.scope)} MP ${compareText(c.op, c.value, '%')}`
    case 'stat-compare': {
      const base = c.ofCurrent ? '' : ' base '
      return `${scopePhrase(c.scope)} ${statLabel(c.stat)}${base}${compareText(c.op, c.value)}`
    }
    case 'has-status': {
      const present = c.present ? 'has' : 'does not have'
      return `${scopePhrase(c.scope)} ${present} ${STATUS_LABEL[c.status] ?? c.status}`
    }
    case 'weak-to':
      return `${scopePhrase(c.scope)} is weak to ${elementLabel(c.element)}`
    case 'enemy-rank': {
      const ranks = c.ranks.map((r) => RANK_LABEL[r] ?? r).join('/')
      return `${scopePhrase(c.scope)} is ${c.present ? '' : 'not '}${ranks}`
    }
    case 'ally-count':
      return `Allies ${compareText(c.op, c.value)}`
    case 'enemy-count':
      return `Enemies ${compareText(c.op, c.value)}`
    case 'turn-count':
      return `Turn count ${compareText(c.op, c.value)}`
    case 'turn-mod':
      return `Turn % ${c.mod} = ${c.equals}`
    case 'cooldown-ready': {
      const skill = c.skillId ? getSkill(c.skillId).name : 'a skill'
      return `${skill} off cooldown`
    }
    case 'can-cast': {
      const skill = c.skillId ? getSkill(c.skillId).name : 'any skill'
      return `Can cast ${skill}`
    }
    case 'has-item':
      return `Has ${getItem(c.itemId).name}`
    case 'and':
      return `(${c.conditions.map(conditionLabel).join(' AND ')})`
    case 'or':
      return `(${c.conditions.map(conditionLabel).join(' OR ')})`
    case 'not':
      return `NOT (${conditionLabel(c.condition)})`
    default: {
      const _exhaustive: never = c
      return String(_exhaustive)
    }
  }
}

export function triggerLabel(t: Trigger | undefined): string {
  if (!t) return 'Always'
  if (t.conditions.length === 0) return 'Always'
  return t.conditions.map(conditionLabel).join(t.operator === 'AND' ? ' AND ' : ' OR ')
}

const TARGET_LABEL: Record<TargetRule['kind'], string> = {
  self: 'Self',
  'lowest-hp-ally': 'Lowest-HP ally',
  'highest-hp-ally': 'Highest-HP ally',
  'random-ally': 'Random ally',
  'all-allies': 'All allies',
  'lowest-hp-enemy': 'Lowest-HP enemy',
  'highest-hp-enemy': 'Highest-HP enemy',
  'random-enemy': 'Random enemy',
  'all-enemies': 'All enemies',
  'highest-threat-enemy': 'Highest-threat enemy',
  attacker: 'The attacker',
  'trigger-target': 'The trigger target',
  'previous-trigger-target': 'The previous trigger target',
}

export function targetLabel(t: TargetRule): string {
  const base = TARGET_LABEL[t.kind]
  if (!t.condition) return base
  return `${base} where ${conditionLabel(t.condition).toLowerCase()}`
}

const TAG_HINT: Record<string, string> = {
  damage: 'damage skills',
  heal: 'heal skills',
  buff: 'buff skills',
  debuff: 'debuff skills',
  utility: 'utility skills',
  attack: 'attack skills',
  defend: 'defend skills',
  fire: 'fire spells',
  water: 'water spells',
  frost: 'frost spells',
  earth: 'earth spells',
  holy: 'holy spells',
  shadow: 'shadow spells',
}

export function filterLabel(f: SkillSelectorFilter): string {
  switch (f.kind) {
    case 'byId': {
      if (f.skillId === 'attack') return 'Basic attack'
      if (f.skillId === 'defend') return 'Basic defend'
      try {
        return getSkill(f.skillId).name
      } catch {
        return f.skillId
      }
    }
    case 'byElement':
      return `${elementLabel(f.element)} skills`
    case 'byKind':
      return `${f.skillKind} skills`
    case 'byTag':
      return TAG_HINT[f.tag] ?? `${f.tag} skills`
    case 'byMpCost': {
      const base = f.ofCurrent ? '' : ' base '
      return `MP cost ${compareText(f.op, f.value)}${base}`
    }
    case 'byCooldownReady':
      return f.ready ? 'off cooldown' : 'on cooldown'
    case 'byCastDelay':
      return `cast delay ${compareText(f.op, f.value)}`
    case 'byPower':
      return `power ${compareText(f.op, f.value)}`
    default: {
      const _exhaustive: never = f
      return String(_exhaustive)
    }
  }
}

export function selectorLabel(s: SkillSelector): string {
  if (s.filters.length === 0) return s.source === 'skills' ? 'a skill' : 'an item'
  const body = s.filters.map(filterLabel).join(' & ')
  return s.source === 'skills' ? body : `item: ${body}`
}

export function eventLabel(e: EventPattern): string {
  const kindText: Record<EventPattern['kind'], string> = {
    attacked: 'hit',
    evaded: 'evades an attack',
    'ally-kod': 'a party member is knocked out',
    'status-applied': 'a status is applied',
    'status-removed': 'a status is removed',
    'enemy-casts': 'an enemy casts',
    'turn-start': 'a turn starts',
    'turn-end': 'a turn ends',
  }
  const parts = [kindText[e.kind]]
  if (e.source) parts.push(`by ${e.source === 'self' ? 'self' : e.source}`)
  if (e.target) parts.push(`on ${e.target === 'self' ? 'self' : e.target}`)
  return `When ${parts.join(' ')}`
}

export function lineLabel(line: ScriptLine): string {
  let t = triggerLabel(line.trigger)
  if (t === 'Always') t = 'Always true'
  return `${t} → ${targetLabel(line.target)} · ${selectorLabel(line.action)}`
}

export function reactionLineLabel(line: Pick<ScriptLine, 'target' | 'action'> & { gate: EventPattern }): string {
  return `${eventLabel(line.gate)} → ${targetLabel(line.target)} · ${selectorLabel(line.action)}`
}

export function scriptSummaryLabel(script: CharacterScript): string {
  const ruleCount = countRules(script.rootBlock)
  const blockCount = countBlocks(script.rootBlock)
  const reactionCount = script.reactions.length
  const parts = [`${ruleCount} rule${ruleCount === 1 ? '' : 's'}`, `${blockCount} block${blockCount === 1 ? '' : 's'}`]
  if (reactionCount > 0) parts.push(`${reactionCount} reaction${reactionCount === 1 ? '' : 's'}`)
  return truncate(parts.join(' · '), 40)
}

function countRules(block: ScriptBlock): number {
  let n = block.lines.length
  for (const sub of block.nested) n += sub.lines.length
  return n
}

function countBlocks(block: ScriptBlock): number {
  return 1 + block.nested.length
}

export function targetOptionsLabel(source: 'skills' | 'items'): string {
  return source === 'skills' ? 'skills' : 'items'
}

/** Human label for an item used in an action selector (`item: Potion`). */
export function itemLabel(id: string): string {
  const item = getItem(id)
  return `${itemTypeLabel(item.type)}: ${item.name}`
}

/**
 * Tooltip descriptive output (docs/specs/tooltips.md).
 *
 * Pure module: no Phaser, no store access. The describe functions translate
 * data-model definitions (items, skills, status effects) into a flat list of
 * styled line payloads that the UI renderer (src/game/ui/tooltip.ts) paints as
 * a hover panel. Keeping description and rendering separate makes every tooltip
 * unit-testable without booting a scene.
 *
 * Derived numbers (damage / heal strength) mirror the engine formulas in
 * `./combat/damage` exactly, evaluated against an owner's stats when one is
 * supplied — the same formulas battle would run.
 */

import type {
  Character,
  Element,
  ItemDef,
  SkillDef,
  SkillTargets,
  StatBlock,
  StatKey,
  StatusEffect,
} from './types'
import { getSkill } from './data'
import { derivedStats } from './character'
import { finalizeDamage, healMagic, magicalDamage, physicalDamage } from './combat/damage'

/** Semantic colors the renderer maps onto THEME colors (spec §Tone). */
export type TooltipTone =
  | 'default'
  | 'good'
  | 'warn'
  | 'bad'
  | 'muted'
  | 'accent'
  | 'gold'
  | 'rarity-common'
  | 'rarity-rare'
  | 'rarity-epic'
  | 'rarity-legendary'

export type TooltipLine =
  | { kind: 'title'; text: string; flare?: 'rarity' }
  | { kind: 'subtitle'; text: string }
  | { kind: 'stat'; key: StatKey; delta: number }
  | { kind: 'effect'; text: string; tone?: TooltipTone }
  | { kind: 'label'; text: string; tone: TooltipTone }
  | { kind: 'divider' }
  | { kind: 'desc'; text: string; tone?: TooltipTone }
  | { kind: 'source'; text: string }

/** Minimum stats needed to derive battle numbers for a skill. */
export interface SkillOwner {
  stats: StatBlock
}

export interface SkillResources {
  /** Current MP pool; drives the affordable/grey-out tint. */
  mp?: number
}

export interface ItemTooltipContext {
  /** Character name to suffix onto equipped gear, e.g. `Iron Sword · worn by Aldric`. */
  equippedBy?: string
}

const STAT_ORDER: StatKey[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd']

const KIND_LABEL: Record<SkillDef['kind'], string> = {
  damage: 'Damage',
  heal: 'Heal',
  buff: 'Buff',
  debuff: 'Debuff',
  utility: 'Utility',
}

const TARGET_LABEL: Record<SkillTargets, string> = {
  single: 'Single target',
  'all-allies': 'All allies',
  'all-enemies': 'All enemies',
  self: 'Self',
}

/** Event-kind → player-facing reaction trigger labels (spec §Items, §Skills). */
const EVENT_LABEL: Record<string, string> = {
  attacked: 'when attacked',
  evaded: 'when you evade',
  'ally-kod': 'when an ally is knocked out',
  'status-applied': 'when a status is applied',
  'status-removed': 'when a status is removed',
  'enemy-casts': 'when an enemy casts',
  'turn-start': 'at the start of a turn',
  'turn-end': 'at the end of a turn',
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function statLabel(key: StatKey): string {
  return key.toUpperCase()
}

function elementLabel(element: Element): string {
  return element === 'none' ? '—' : capitalize(element)
}

function rarityTone(rarity: ItemDef['rarity']): TooltipTone {
  return `rarity-${rarity}` as TooltipTone
}

/** Owner stats when given a character (full derived stats) or raw stat block. */
function ownerStats(owner: Character | SkillOwner): StatBlock {
  return 'stats' in owner ? owner.stats : derivedStats(owner)
}

function reactionsText(patterns: { kind: string }[]): string {
  const labels = patterns.map((p) => EVENT_LABEL[p.kind]).filter(Boolean)
  return labels.length ? `Reacts: ${labels.join(', ')}` : ''
}

/**
 * Describe a status effect: a title line plus a mechanic line (with duration).
 * `statBuff`/`statDebuff` render as percentage changes (`Def +30%`); burn /
 * poison / regen as per-turn values; hard CC as one-line summaries. Duration is
 * always shown as `for N turns` (999 = whole battle).
 */
export function describeStatusEffect(effect: StatusEffect): TooltipLine[] {
  switch (effect.kind) {
    case 'statBuff': {
      const stat = effect.stat ?? 'atk'
      const pct = Math.round(((effect.power ?? 1) - 1) * 100)
      return [describeStatusEffectDuration(effect, `${statLabel(stat)} +${pct}%`)]
    }
    case 'statDebuff': {
      const stat = effect.stat ?? 'atk'
      const pct = Math.round(((effect.power ?? 1) - 1) * 100)
      return [describeStatusEffectDuration(effect, `${statLabel(stat)} ${pct}%`)]
    }
    case 'burn':
      return [describeStatusEffectDuration(effect, `deals ${effect.power} per turn`)]
    case 'poison':
      return [describeStatusEffectDuration(effect, `deals ${effect.power} per turn`)]
    case 'regen':
      return [describeStatusEffectDuration(effect, `heals ${effect.power} per turn`)]
    case 'sleep':
      return [describeStatusEffectDuration(effect, 'cannot act; wakes when damaged')]
    case 'blind':
      return [describeStatusEffectDuration(effect, 'accuracy halved')]
    case 'freeze':
      return [describeStatusEffectDuration(effect, 'cannot act')]
    case 'shield':
      return [describeStatusEffectDuration(effect, 'blocks incoming damage')]
    case 'taunt':
      return [describeStatusEffectDuration(effect, 'draws enemy attacks')]
    case 'stun':
      return [describeStatusEffectDuration(effect, 'cannot act')]
  }
}

function describeStatusEffectDuration(effect: StatusEffect, body: string): TooltipLine {
  const duration = effect.duration
  const suffix = duration != null && duration < 999 ? `for ${duration} turns` : undefined
  return { kind: 'effect', text: suffix ? `${body} ${suffix}` : body }
}

/** Short form of a skill used inside item tooltips (spec §Items). */
function skillShortLines(skill: SkillDef): TooltipLine[] {
  const lines: TooltipLine[] = []

  lines.push({ kind: 'desc', text: KIND_LABEL[skill.kind], tone: 'accent' })
  if (skill.element !== 'none') {
    lines.push({ kind: 'desc', text: elementLabel(skill.element), tone: 'accent' })
  }
  if (skill.targets !== 'self') {
    lines.push({ kind: 'desc', text: TARGET_LABEL[skill.targets] })
  }
  if (skill.effect) {
    lines.push(...describeStatusEffect(skill.effect))
  }
  return lines
}

/**
 * Describe an item. Content depends on the item type (spec §Items):
 * weapons/armor show a rarity chip + stat deltas; consumables show their heal
 * / restore amounts and reactions; scrolls and tomes name and inline the skill
 * they grant; stat-shots list the base-stat increase. Items never show derived
 * battle numbers — those belong to the skill's own tooltip.
 */
export function describeItem(item: ItemDef, context: ItemTooltipContext = {}): TooltipLine[] {
  const lines: TooltipLine[] = []

  lines.push({
    kind: 'title',
    text: item.name,
    flare: item.type === 'stat-shot' ? undefined : 'rarity',
  })

  if (item.type !== 'stat-shot') {
    lines.push({ kind: 'label', text: capitalize(item.rarity), tone: rarityTone(item.rarity) })
  }

  const subtitle =
    item.type === 'stat-shot'
      ? 'Stat shot'
      : item.type === 'weapon' || item.type === 'armor'
        ? `${capitalize(item.type)}${context.equippedBy ? ` · worn by ${context.equippedBy}` : ''}`
        : capitalize(item.type)
  lines.push({ kind: 'subtitle', text: subtitle })

  if (item.type === 'weapon' || item.type === 'armor') {
    if (item.statBonus) {
      for (const key of STAT_ORDER) {
        const delta = item.statBonus[key]
        if (delta) lines.push({ kind: 'stat', key, delta })
      }
    }
  }

  const body: TooltipLine[] = []

  if (item.grantsSkillWhenEquipped) {
    const skill = getSkill(item.grantsSkillWhenEquipped)
    body.push({ kind: 'effect', text: `Grants ${skill.name} while equipped` })
    body.push(...skillShortLines(skill))
  }

  if (item.use?.healHp) {
    body.push({ kind: 'effect', text: `Heals ${item.use.healHp} HP` })
  }
  if (item.use?.healMp) {
    body.push({ kind: 'effect', text: `Restores ${item.use.healMp} MP` })
  }

  if (item.castSkill) {
    const skill = getSkill(item.castSkill)
    body.push({ kind: 'effect', text: `Casts ${skill.name}`, tone: 'warn' })
    body.push(...skillShortLines(skill))
  }

  if (item.grantsSkill) {
    const skill = getSkill(item.grantsSkill)
    body.push({ kind: 'effect', text: `Teaches ${skill.name} (permanent)`, tone: 'warn' })
    body.push(...skillShortLines(skill))
  }

  if (item.boostStat) {
    const { stat, amount } = item.boostStat
    body.push({ kind: 'effect', text: `Increases base ${statLabel(stat)} by ${amount}` })
  }

  if (item.reactionTo?.length) {
    const reacts = reactionsText(item.reactionTo)
    if (reacts) body.push({ kind: 'effect', text: reacts, tone: 'muted' })
  }

  if (body.length) {
    lines.push({ kind: 'divider' })
    lines.push(...body)
  }

  return lines
}

/**
 * Describe a skill (spec §Skills). Active skills show kind / element / MP
 * cost / cooldown / targets plus their status effect; derived damage and heal
 * amounts mirror the engine formulas against the owner's stats when provided
 * (no owner → base power with its scaling label). Passives render as a single
 * effect line.
 */
export function describeSkill(
  skill: SkillDef,
  owner?: Character | SkillOwner,
  resources: SkillResources = {},
): TooltipLine[] {
  const lines: TooltipLine[] = []
  const passive = skill.type === 'passive'

  lines.push({ kind: 'title', text: skill.name })

  const kindLine: TooltipLine = passive
    ? { kind: 'desc', text: 'Passive', tone: 'accent' }
    : { kind: 'desc', text: KIND_LABEL[skill.kind], tone: 'accent' }
  lines.push(kindLine)

  if (!passive && skill.element !== 'none') {
    lines.push({ kind: 'desc', text: elementLabel(skill.element), tone: 'accent' })
  }

  if (!passive) {
    if (skill.cost > 0) {
      const affordable = resources.mp == null || skill.cost <= resources.mp
      lines.push({
        kind: 'effect',
        text: `MP ${skill.cost}`,
        tone: affordable ? undefined : 'warn',
      })
    }
    if (skill.cooldown) {
      lines.push({ kind: 'effect', text: `Cooldown ${skill.cooldown}` })
    }
  }

  if (skill.effect) {
    lines.push(...describeStatusEffect(skill.effect))
  }

  if (!passive && skill.targets !== 'self') {
    lines.push({ kind: 'desc', text: TARGET_LABEL[skill.targets] })
  }

  const derived = deriveSkillNumbers(skill, owner)
  if (derived) {
    lines.push({ kind: 'divider' })
    lines.push(...derived.lines)
  }

  const reacts = skill.reactionTo?.length ? reactionsText(skill.reactionTo) : ''
  if (reacts) {
    lines.push({ kind: 'effect', text: reacts, tone: 'muted' })
  }

  return lines
}

interface DerivedNumbers {
  lines: TooltipLine[]
}

/**
 * Battle numbers for a skill. Mirrors `./combat/damage`: damage is a range over
 * the engine's variance factor at the owner's stats (element-neutral target);
 * healing is exact. With no owner the base power and its scaling label are
 * shown instead.
 */
function deriveSkillNumbers(skill: SkillDef, owner?: Character | SkillOwner): DerivedNumbers | null {
  if (skill.type === 'passive') return null
  if (skill.kind === 'buff' || skill.kind === 'debuff' || skill.kind === 'utility') return null

  const baseFallback: DerivedNumbers | null = !owner ? { lines: describeSkillBase(skill) } : null

  if (!owner) return baseFallback

  const stats = ownerStats(owner)
  const element = skill.element !== 'none' ? skill.element : undefined

  if (skill.kind === 'heal') {
    const healed = healMagic(skill.power, stats.mag)
    const target = skill.targets === 'all-allies' ? ' to all allies' : ''
    return { lines: [{ kind: 'effect', text: `Heals ~${healed} HP${target}` }] }
  }

  // damage
  const rating =
    skill.scaling === 'mag'
      ? magicalDamage(skill.power, stats.mag, stats.res)
      : physicalDamage(skill.power, stats.atk, stats.def)

  const lo = finalizeDamage(rating, { varianceRoll: 0, attackElement: skill.element })
  const hi = finalizeDamage(rating, { varianceRoll: 1, attackElement: skill.element })
  const range = lo === hi ? `${lo}` : `${lo}–${hi}`
  const elementSuffix = element ? ` ${element}` : ''
  const target = skill.targets === 'all-enemies' ? ' to all enemies' : ''
  return { lines: [{ kind: 'effect', text: `Deals ~${range}${elementSuffix} damage${target}` }] }
}

/** Base-power fallback for skills described without an owner (spec §Skills). */
export function describeSkillBase(skill: SkillDef): TooltipLine[] {
  const lines: TooltipLine[] = []
  if (skill.kind === 'damage') {
    lines.push({ kind: 'effect', text: `Damage: ${skill.power} (${skill.scaling} scaling)` })
  } else if (skill.kind === 'heal') {
    lines.push({ kind: 'effect', text: `Heal: ${skill.power} (${skill.scaling} scaling)` })
  }
  return lines
}
import { describe, expect, it } from 'vitest'
import { getItem, getSkill } from './data'
import {
  describeItem,
  describeSkill,
  describeSkillBase,
  describeStatusEffect,
  type TooltipLine,
} from './tooltips'
import type { ItemDef, SkillDef, StatBlock, StatusEffect } from './types'

/** Owner stats fixture: clean ratios so derived numbers are integers. */
const STATS: StatBlock = { hp: 120, atk: 20, def: 10, mag: 40, res: 10, spd: 12 }

function kinds(lines: TooltipLine[]): string[] {
  return lines.map((l) => l.kind)
}

function texts(lines: TooltipLine[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    if (l.kind === 'stat') {
      out.push(`${l.delta >= 0 ? '+' : ''}${l.delta} ${l.key.toUpperCase()}`)
    } else if ('text' in l && typeof l.text === 'string') {
      out.push(l.text)
    }
  }
  return out
}

function item(id: string): ItemDef {
  const def = getItem(id)
  if (!def) throw new Error(`missing item ${id}`)
  return def
}

function skill(id: string): SkillDef {
  const def = getSkill(id)
  if (!def) throw new Error(`missing skill ${id}`)
  return def
}

describe('describeItem', () => {
  it('weapon: title flare, rarity chip, subtitle, stat line (Iron Sword)', () => {
    const lines = describeItem(item('iron_sword'))
    expect(lines[0]).toMatchObject({ kind: 'title', text: 'Iron Sword', flare: 'rarity' })
    expect(texts(lines)).toEqual(['Iron Sword', 'Common', 'Weapon', '+10 ATK'])
    expect(lines).toContainEqual({ kind: 'label', text: 'Common', tone: 'rarity-common' })
    expect(lines).toContainEqual({ kind: 'stat', key: 'atk', delta: 10 })
  })

  it('armor: stats in STAT_ORDER (hp before def) — Chain Mail', () => {
    const lines = describeItem(item('chain_mail'))
    expect(texts(lines)).toEqual(['Chain Mail', 'Rare', 'Armor', '+15 HP', '+12 DEF'])
    expect(lines[3]).toEqual({ kind: 'stat', key: 'hp', delta: 15 })
    expect(lines[4]).toEqual({ kind: 'stat', key: 'def', delta: 12 })
  })

  it('consumable: heals + reaction triggers (Health Potion)', () => {
    const lines = describeItem(item('health_potion'))
    expect(texts(lines)).toEqual([
      'Health Potion',
      'Common',
      'Consumable',
      'Heals 80 HP',
      'Reacts: when attacked, when a status is applied',
    ])
    expect(lines).toContainEqual({ kind: 'effect', text: 'Heals 80 HP' })
    expect(lines).toContainEqual({
      kind: 'effect',
      text: 'Reacts: when attacked, when a status is applied',
      tone: 'muted',
    })
  })

  it('mana potion restores MP', () => {
    expect(texts(describeItem(item('mana_potion')))).toContain('Restores 30 MP')
  })

  it('stat-shot: no rarity chip, permanent base-stat boost', () => {
    const lines = describeItem(item('shot_atk_1'))
    expect(lines[0]).toMatchObject({ kind: 'title', text: 'Vial of Strength' })
    expect((lines[0] as { flare?: string }).flare).toBeUndefined()
    expect(texts(lines)).toEqual(['Vial of Strength', 'Stat shot', 'Increases base ATK by 1'])
    expect(lines).not.toContainEqual(expect.objectContaining({ kind: 'label' }))
  })

  it('gear-granted skill inlined (Staff of Embers)', () => {
    const lines = describeItem(item('flame_staff'))
    expect(texts(lines)).toEqual([
      'Staff of Embers',
      'Rare',
      'Weapon',
      '+12 MAG',
      '+4 RES',
      'Grants Fireball while equipped',
      'Damage',
      'Fire',
      'Single target',
    ])
  })

  it('equipped gear appends the wearer to the subtitle', () => {
    const lines = describeItem(item('flame_staff'), { equippedBy: 'Aldric' })
    expect(texts(lines)).toContain('Weapon · worn by Aldric')
  })

  it('scroll: casts the named skill with an inline short form', () => {
    const lines = describeItem(item('scroll_fireball'))
    expect(texts(lines)).toEqual([
      'Scroll: Fireball',
      'Rare',
      'Scroll',
      'Casts Fireball',
      'Damage',
      'Fire',
      'Single target',
    ])
    expect(lines).toContainEqual({ kind: 'effect', text: 'Casts Fireball', tone: 'warn' })
  })

  it('scroll of an afflicting skill inlines its status effect', () => {
    expect(texts(describeItem(item('scroll_poison_blade')))).toContain('deals 5 per turn for 3 turns')
  })

  it('tome: teaches the skill permanently with an inline short form', () => {
    const lines = describeItem(item('tome_heal'))
    expect(texts(lines)).toEqual([
      'Tome: Heal',
      'Rare',
      'Tome',
      'Teaches Heal (permanent)',
      'Heal',
      'Holy',
      'Single target',
    ])
    expect(lines).toContainEqual({ kind: 'effect', text: 'Teaches Heal (permanent)', tone: 'warn' })
  })

  it('items never expose derived battle numbers', () => {
    for (const id of ['iron_sword', 'health_potion', 'scroll_fireball', 'tome_heal', 'flame_staff']) {
      for (const l of describeItem(item(id))) {
        if ('text' in l) expect(l.text).not.toMatch(/~|\d+–\d+ damages?/)
      }
    }
  })
})

describe('describeSkillBase', () => {
  it('damage skill: base power + scaling label', () => {
    expect(texts(describeSkillBase(skill('fireball')))).toEqual(['Damage: 55 (mag scaling)'])
  })

  it('heal skill: base power + scaling label', () => {
    expect(texts(describeSkillBase(skill('heal')))).toEqual(['Heal: 60 (mag scaling)'])
  })
})

describe('describeSkill — actives', () => {
  it('layout and order (Fireball, no owner): title/kind/element/cost/target/base', () => {
    const lines = describeSkill(skill('fireball'))
    expect(kinds(lines)).toEqual(['title', 'desc', 'desc', 'effect', 'desc', 'divider', 'effect'])
    expect(texts(lines)).toEqual([
      'Fireball',
      'Damage',
      'Fire',
      'MP 6',
      'Single target',
      'Damage: 55 (mag scaling)',
    ])
  })

  it('element none is omitted (Tri-Shot)', () => {
    const lines = describeSkill(skill('tri_shot'))
    expect(texts(lines)).toEqual([
      'Tri-Shot',
      'Damage',
      'MP 4',
      'Single target',
      'Damage: 30 (atk scaling)',
    ])
  })

  it('owner damage: engine range at owner stats', () => {
    const lines = describeSkill(skill('fireball'), { stats: STATS })
    // rating = magicalDamage(55, 40, 10) = 220; lo = 220×0.9 = 198, hi = 220×1.1 = 242
    expect(texts(lines)).toContain('Deals ~198–242 fire damage')
  })

  it('heal with owner: exact heal at owner MAG', () => {
    const lines = describeSkill(skill('heal'), { stats: STATS })
    // healMagic(60, 40) = round(60 × 40/20) = 120
    expect(texts(lines)).toContain('Heals ~120 HP')
  })

  it('aoe damage appends "to all enemies" (Flame Wave)', () => {
    const lines = describeSkill(skill('flame_wave'), { stats: STATS })
    // rating = magicalDamage(40, 40, 10) = 160; 160×0.9 = 144, 160×1.1 = 176
    expect(texts(lines)).toContain('Deals ~144–176 fire damage to all enemies')
  })

  it('unaffordable MP tints the cost line warn', () => {
    const lines = describeSkill(skill('fireball'), { stats: STATS }, { mp: 3 })
    expect(lines).toContainEqual({ kind: 'effect', text: 'MP 6', tone: 'warn' })
  })

  it('affordable MP leaves the cost line untinted', () => {
    const lines = describeSkill(skill('fireball'), { stats: STATS }, { mp: 20 })
    expect(lines).toContainEqual({ kind: 'effect', text: 'MP 6' })
  })

  it('cooldown shown when present (Berserk Strike)', () => {
    expect(texts(describeSkill(skill('berserk_strike')))).toContain('Cooldown 1')
  })

  it('statDebuff effect with duration (Shield Bash)', () => {
    const lines = describeSkill(skill('shield_bash'))
    expect(texts(lines)).toContain('DEF -20% for 2 turns')
  })

  it('poison effect (Poison Blade)', () => {
    expect(texts(describeSkill(skill('poison_blade')))).toContain('deals 5 per turn for 3 turns')
  })

  it('all-allies buff has no derived numbers (Battle Anthem)', () => {
    const lines = describeSkill(skill('battle_anthem'))
    expect(kinds(lines)).toEqual(['title', 'desc', 'desc', 'effect', 'effect', 'effect', 'desc'])
    expect(texts(lines)).toEqual([
      'Battle Anthem',
      'Buff',
      'Frost',
      'MP 6',
      'Cooldown 3',
      'ATK +20% for 3 turns',
      'All allies',
    ])
    expect(texts(lines)).not.toContain('Damage:')
    expect(texts(lines)).not.toContain('Heals ~')
  })

  it("reaction-capable active shows its trigger (Guardian's Vow)", () => {
    const lines = describeSkill(skill('guardians_vow'))
    expect(lines).toContainEqual({ kind: 'effect', text: 'Reacts: when attacked', tone: 'muted' })
  })
})

describe('describeSkill — passives', () => {
  it('renders a single effect line, no cost/cooldown/target/derived', () => {
    const lines = describeSkill(skill('fortress'))
    expect(texts(lines)).toEqual(['Fortress', 'Passive', 'DEF +30%'])
    expect(kinds(lines)).toEqual(['title', 'desc', 'effect'])
  })

  it('duration 999 (whole battle) omits the turn count', () => {
    const lines = describeSkill(skill('reckless'))
    expect(texts(lines)).toEqual(['Reckless', 'Passive', 'ATK +25%'])
  })

  it('regen aura heals per turn, whole battle', () => {
    const lines = describeSkill(skill('regen_aura'))
    expect(texts(lines)).toEqual(['Regen Aura', 'Passive', 'heals 5 per turn'])
  })
})

describe('describeStatusEffect', () => {
  const cases: [StatusEffect, string][] = [
    [{ kind: 'statBuff', stat: 'def', power: 1.3, duration: 3 }, 'DEF +30% for 3 turns'],
    [{ kind: 'statDebuff', stat: 'spd', power: 0.7, duration: 2 }, 'SPD -30% for 2 turns'],
    [{ kind: 'statDebuff', stat: 'atk', power: 0.8, duration: 2 }, 'ATK -20% for 2 turns'],
    [{ kind: 'burn', power: 5, duration: 3 }, 'deals 5 per turn for 3 turns'],
    [{ kind: 'poison', power: 4, duration: 3 }, 'deals 4 per turn for 3 turns'],
    [{ kind: 'regen', power: 5, duration: 999 }, 'heals 5 per turn'],
    [{ kind: 'sleep', duration: 1 }, 'cannot act; wakes when damaged for 1 turns'],
    [{ kind: 'blind', duration: 2 }, 'accuracy halved for 2 turns'],
    [{ kind: 'freeze', duration: 999 }, 'cannot act'],
    [{ kind: 'stun', duration: 1 }, 'cannot act for 1 turns'],
  ]
  for (const [effect, expected] of cases) {
    it(`describes ${effect.kind} → "${expected}"`, () => {
      expect(texts(describeStatusEffect(effect))).toEqual([expected])
    })
  }

  it('statBuff without a stat defaults to atk', () => {
    expect(texts(describeStatusEffect({ kind: 'statBuff', power: 1.25, duration: 3 }))).toEqual([
      'ATK +25% for 3 turns',
    ])
  })
})
/**
 * Script Editor (M4) — a DOM overlay for building / editing player scripts
 * without writing code. Phaser has no native text / number / select inputs, so
 * the editor (like Theme Studio) is a styled HTML panel layered above the
 * canvas (z-index) and driven entirely by the core scripting store.
 *
 * Visual reference: `docs/script_window_template/template_002` — numbered rule
 * cards in priority order, an expandable editor per rule (trigger conditions +
 * operator, target, action), nested blocks to depth 2, and the locked ∞
 * fallback. Reactions carry a gate (event + source/target filters) whose
 * action picker is restricted to skills whose `reactionTo` matches the gate.
 *
 * The overlay is a module singleton that survives scene restarts, matching the
 * Theme Studio pattern. Every edit mutates the working draft and persists via
 * `updateScript` (live edits, S15); built-in scripts are opened as an editable
 * copy (`duplicateScript`) and never mutated directly (S14).
 */

import { THEME, colorHex } from './theme'
import { getScript, updateScript, duplicateScript } from '../../core/store'
import { uuid } from '../../core/id'
import { PLAYER_SKILL_IDS } from '../../core/data/skill-items'
import { CLASSES, ENEMIES, getSkill, getItem, ITEMS, ELEMENTS } from '../../core/data'
import { createCharacter } from '../../core/character'
import { createRng } from '../../core/rng/rng'
import { BASIC_ACTION_IDS } from '../../core/scripting/types'
import {
  applyDryRunMocks,
  createDryRunBattle,
  dryRunCheckReactions,
  dryRunChooseAction,
} from '../../core/scripting/dry-run'
import type { ReactionPlan } from '../../core/scripting/dry-run'
import type {
  CharacterScript,
  ScriptLine,
  ScriptBlock,
  Trigger,
  Condition,
  ConditionScope,
  EventPattern,
  EventKind,
  ActorFilter,
  TargetRule,
  TargetRuleKind,
  SkillSelector,
  SkillSelectorFilter,
  ReactionRule,
  CompareOp,
} from '../../core/scripting/types'
import type { StatKey, SkillKind, Element } from '../../core/types'
import type { ActiveStatusKind, BattleAction, BattleEvent, BattleState } from '../../core/combat/types'
import { lineLabel, reactionLineLabel, targetLabel } from './script-labels'

let root: HTMLDivElement | null = null
let backdrop: HTMLDivElement | null = null
let bodyEl: HTMLDivElement | null = null
let draft: CharacterScript | null = null
/** Rule / reaction body expansion state, keyed by id, preserved across re-renders. */
const expandedRules = new Set<string>()

export function showScriptEditor(id: string): void {
  const script = getScript(id)
  if (!script) return
  // Built-ins are read-only (S14): always edit a copy.
  const source = script.builtIn ? duplicateScript(id) : script
  draft = JSON.parse(JSON.stringify(source)) as CharacterScript
  if (!draft.fallback) {
    draft.fallback = {
      id: uuid(),
      target: { kind: 'lowest-hp-enemy' },
      action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] },
    }
  }
  const el = ensureRoot()
  applyCssVars()
  el.classList.remove('hidden')
  if (backdrop) backdrop.classList.remove('hidden')
  render()
}

export function hideScriptEditor(): void {
  if (root) root.classList.add('hidden')
  if (backdrop) backdrop.classList.add('hidden')
}

export function isScriptEditorVisible(): boolean {
  return !!root && !root.classList.contains('hidden')
}

function ensureRoot(): HTMLDivElement {
  if (root) return root

  backdrop = document.createElement('div')
  backdrop.id = 'script-editor-backdrop'
  backdrop.classList.add('hidden')
  backdrop.addEventListener('click', hideScriptEditor)
  document.body.appendChild(backdrop)

  root = document.createElement('div')
  root.id = 'script-editor'
  root.classList.add('hidden')
  root.innerHTML = `
    <div class="se-header">
      <h2 class="se-title">Script Editor</h2>
      <input class="se-name" data-field="name" maxlength="40" placeholder="Script name" />
      <button class="se-close" type="button" title="Close">✕</button>
    </div>
    <div class="se-body"></div>
    <div class="se-footer">
      <span class="se-saved-msg"></span>
      <button class="se-btn" data-act="done" type="button">Done</button>
    </div>`
  document.body.appendChild(root)

  bodyEl = root.querySelector('.se-body')
  const nameEl = root.querySelector('.se-name') as HTMLInputElement
  nameEl.addEventListener('change', () => {
    if (!draft) return
    const v = nameEl.value.trim()
    if (!v) {
      nameEl.value = draft.name
      return
    }
    draft.name = v
    persist()
  })
  root.querySelector('.se-close')!.addEventListener('click', hideScriptEditor)
  root.querySelector('[data-act="done"]')!.addEventListener('click', hideScriptEditor)
  document.addEventListener('keydown', onKeyDown)

  applyCssVars()
  return root
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (e.target instanceof HTMLSelectElement) return
  if (e.defaultPrevented) return
  hideScriptEditor()
}

function persist(): void {
  if (!draft) return
  updateScript(draft)
}

function applyCssVars(): void {
  if (!root) return
  const c = THEME.colors
  const set = (name: string, value: string) => root!.style.setProperty(name, value)
  set('--se-bg', colorHex(c.bg))
  set('--se-panel', colorHex(c.panel))
  set('--se-face', colorHex(c.face))
  set('--se-border', colorHex(c.border))
  set('--se-borderLight', colorHex(c.borderLight))
  set('--se-accent', colorHex(c.accent))
  set('--se-hover', colorHex(c.hover))
  set('--se-gold', colorHex(c.gold))
  set('--se-bad', c.bad)
  set('--se-good', c.good)
  set('--se-disabled', colorHex(c.disabled))
  set('--se-text', c.text)
  set('--se-textMuted', c.textMuted)
  set('--se-textDim', c.textDim)
  set('--se-textOnAccent', c.textOnAccent)
}

// ---------------------------------------------------------------------------
// Vocabularies for pickers.
// ---------------------------------------------------------------------------

const SCOPE_LABEL: Record<ConditionScope, string> = {
  self: 'Self',
  'any-ally': 'Any ally',
  'all-allies': 'All allies',
  'lowest-hp-ally': 'Lowest-HP ally',
  'highest-hp-ally': 'Highest-HP ally',
  'any-enemy': 'Any enemy',
  'all-enemies': 'All enemies',
  'lowest-hp-enemy': 'Lowest-HP enemy',
  'highest-hp-enemy': 'Highest-HP enemy',
  attacker: 'The attacker',
  'trigger-target': 'The trigger target',
  'previous-trigger-target': 'The previous trigger target',
}
const OPS: CompareOp[] = ['<', '<=', '>', '>=', '==', '!=']
const STAT_KEY: StatKey[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd']
const SKILL_KIND: SkillKind[] = ['damage', 'heal', 'buff', 'debuff', 'utility']
const STATUS: ActiveStatusKind[] = [
  'statBuff',
  'statDebuff',
  'burn',
  'poison',
  'regen',
  'sleep',
  'blind',
  'freeze',
  'shield',
  'taunt',
  'stun',
]
const RANK_LIST = ['normal', 'elite', 'boss'] as const
const EVENTS: EventKind[] = [
  'attacked',
  'evaded',
  'ally-kod',
  'status-applied',
  'status-removed',
  'enemy-casts',
  'turn-start',
  'turn-end',
]
const EVENT_LABEL: Record<EventKind, string> = {
  attacked: 'Hit',
  evaded: 'Evades an attack',
  'ally-kod': 'A party member is KO\u2019d',
  'status-applied': 'A status is applied',
  'status-removed': 'A status is removed',
  'enemy-casts': 'An enemy casts',
  'turn-start': 'A turn starts',
  'turn-end': 'A turn ends',
}
const ACTORS: ActorFilter[] = ['self', 'ally', 'enemy']
const TARGET_SEL: Record<TargetRuleKind, string> = {
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
const FILTER_KINDS: SkillSelectorFilter['kind'][] = [
  'byId',
  'byElement',
  'byKind',
  'byTag',
  'byMpCost',
  'byCooldownReady',
  'byCastDelay',
  'byPower',
]
const FILTER_LABEL: Record<SkillSelectorFilter['kind'], string> = {
  byId: 'Specific skill/item',
  byElement: 'Element',
  byKind: 'Skill kind',
  byTag: 'Tag',
  byMpCost: 'MP cost',
  byCooldownReady: 'Cooldown',
  byCastDelay: 'Cast delay',
  byPower: 'Power',
}
const TAG_CHOICES = [
  'damage',
  'heal',
  'buff',
  'debuff',
  'utility',
  'attack',
  'defend',
  'fire',
  'water',
  'frost',
  'earth',
  'holy',
  'shadow',
]
const CONDITION_KINDS: { kind: Condition['kind']; label: string; hasParams: boolean }[] = [
  { kind: 'always', label: 'Always', hasParams: false },
  { kind: 'never', label: 'Never', hasParams: false },
  { kind: 'hp-pct', label: 'Ally/enemy HP %', hasParams: true },
  { kind: 'mp-pct', label: 'MP %', hasParams: true },
  { kind: 'stat-compare', label: 'Stat compare', hasParams: true },
  { kind: 'has-status', label: 'Has / lacks status', hasParams: true },
  { kind: 'weak-to', label: 'Weak to element', hasParams: true },
  { kind: 'enemy-rank', label: 'Enemy rank', hasParams: true },
  { kind: 'ally-count', label: 'Ally count', hasParams: true },
  { kind: 'enemy-count', label: 'Enemy count', hasParams: true },
  { kind: 'turn-count', label: 'Turn count', hasParams: true },
  { kind: 'turn-mod', label: 'Turn % =', hasParams: true },
  { kind: 'cooldown-ready', label: 'Skill off cooldown', hasParams: true },
  { kind: 'can-cast', label: 'Can cast skill', hasParams: true },
  { kind: 'has-item', label: 'Has item', hasParams: true },
  { kind: 'and', label: 'All of the following', hasParams: true },
  { kind: 'or', label: 'Any of the following', hasParams: true },
  { kind: 'not', label: 'Not', hasParams: true },
]

// ---------------------------------------------------------------------------
// Small DOM builders.
// ---------------------------------------------------------------------------

function div(className: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className
  return el
}

function text(labelText: string): HTMLSpanElement {
  const el = document.createElement('span')
  el.textContent = labelText
  return el
}

function button(labelText: string, className: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  el.textContent = labelText
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return el
}

function makeSelect(
  options: string[],
  current: string,
  onChange: (v: string) => void,
  labelArc?: (v: string) => string,
): HTMLSelectElement {
  const sel = document.createElement('select')
  for (const opt of options) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = labelArc ? labelArc(opt) : opt
    sel.appendChild(o)
  }
  sel.value = current
  sel.addEventListener('change', () => onChange(sel.value))
  return sel
}

// ---------------------------------------------------------------------------
// Condition editor.
// ---------------------------------------------------------------------------

function defaultCondition(kind: Condition['kind']): Condition {
  switch (kind) {
    case 'always':
    case 'never':
      return { kind }
    case 'hp-pct':
    case 'mp-pct':
      return { kind, scope: 'self', op: '<', value: 0.5 }
    case 'stat-compare':
      return { kind, scope: 'self', stat: 'atk', op: '>', value: 0 }
    case 'has-status':
      return { kind, scope: 'self', status: 'burn', present: true }
    case 'weak-to':
      return { kind, scope: 'self', element: 'fire' }
    case 'enemy-rank':
      return { kind, scope: 'any-enemy', ranks: ['elite'], present: true }
    case 'ally-count':
    case 'enemy-count':
    case 'turn-count':
      return { kind, op: '>', value: 0 }
    case 'turn-mod':
      return { kind, mod: 2, equals: 0 }
    case 'cooldown-ready': {
      const first = PLAYER_SKILL_IDS[0]
      return { kind, skillId: first ?? '' }
    }
    case 'can-cast':
      return { kind, skillId: PLAYER_SKILL_IDS[0] }
    case 'has-item': {
      const first = Object.keys(ITEMS)[0]
      return { kind, itemId: first }
    }
    case 'and':
    case 'or':
      return { kind, conditions: [defaultCondition('hp-pct')] }
    case 'not':
      return { kind, condition: defaultCondition('hp-pct') }
    default: {
      const _x: never = kind
      return _x
    }
  }
}

/** Builds the params row for a condition; returns [rowEl, update]. */
function conditionParams(c: Condition): HTMLElement {
  const row = div('se-p-params')
  switch (c.kind) {
    case 'always':
    case 'never':
      break
    case 'hp-pct':
    case 'mp-pct':
      row.appendChild(labelScope(c))
      row.appendChild(makeSelect([...OPS], c.op, (v) => { c.op = v as CompareOp; onPersist() }))
      row.appendChild(pctInput(() => c.value, (v) => { c.value = v; onPersist() }))
      break
    case 'stat-compare': {
      row.appendChild(labelScope(c))
      row.appendChild(
        makeSelect([...STAT_KEY], c.stat, (v) => { c.stat = v as StatKey; onPersist() }, (s) => s.toUpperCase()),
      )
      row.appendChild(makeSelect([...OPS], c.op, (v) => { c.op = v as CompareOp; onPersist() }))
      row.appendChild(numInput(() => c.value, (v) => { c.value = v; onPersist() }))
      const cb = ofCurrentBox(c)
      row.appendChild(cb)
      break
    }
    case 'has-status':
      row.appendChild(labelScope(c))
      row.appendChild(statusSelect(c))
      row.appendChild(presentToggle(c, () => (c.present = !c.present)))
      break
    case 'weak-to':
      row.appendChild(labelScope(c))
      row.appendChild(
        makeSelect([...ELEMENTS], c.element as string, (v) => { c.element = v as Element; onPersist() }),
      )
      break
    case 'enemy-rank':
      row.appendChild(labelScope(c))
      row.appendChild(rankChips(c))
      row.appendChild(presentToggle(c, () => (c.present = !c.present)))
      break
    case 'ally-count':
    case 'enemy-count':
    case 'turn-count':
      row.appendChild(makeSelect([...OPS], c.op, (v) => { c.op = v as CompareOp; onPersist() }))
      row.appendChild(numInput(() => c.value, (v) => { c.value = v; onPersist() }))
      break
    case 'turn-mod':
      row.appendChild(numInput(() => c.mod, (v) => { c.mod = v; onPersist() }))
      row.appendChild(text('='))
      row.appendChild(numInput(() => c.equals, (v) => { c.equals = v; onPersist() }))
      break
    case 'cooldown-ready':
      row.appendChild(skillPickers(c))
      break
    case 'can-cast':
      row.appendChild(skillPickers(c))
      break
    case 'has-item':
      row.appendChild(itemPicker(c))
      break
    case 'and':
    case 'or':
    case 'not':
      row.appendChild(conditionGroup(c))
      break
    default: {
      const _x: never = c
      return _x
    }
  }
  return row
}

function labelScope(c: Extract<Condition, { scope: ConditionScope }>): HTMLSpanElement {
  return text(SCOPE_LABEL[c.scope])
}

function pctInput(get: () => number, set: (v: number) => void): HTMLInputElement {
  const inp = document.createElement('input')
  inp.type = 'number'
  inp.className = 'se-num'
  inp.min = '0'
  inp.max = '100'
  inp.step = '5'
  inp.value = String(Math.round(get() * 100))
  inp.title = 'Percent'
  inp.addEventListener('change', () => {
    const v = parseFloat(inp.value)
    if (Number.isNaN(v)) {
      inp.value = String(Math.round(get() * 100))
      return
    }
    set(Math.max(0, Math.min(1, v / 100)))
  })
  return inp
}

function numInput(get: () => number, set: (v: number) => void): HTMLInputElement {
  const inp = document.createElement('input')
  inp.type = 'number'
  inp.className = 'se-num'
  inp.value = String(get())
  inp.addEventListener('change', () => {
    const v = parseFloat(inp.value)
    if (Number.isNaN(v)) {
      inp.value = String(get())
      return
    }
    set(v)
  })
  return inp
}

function ofCurrentBox(c: Extract<Condition, { ofCurrent?: boolean }>): HTMLSpanElement {
  const wrap = document.createElement('label')
  wrap.className = 'se-check'
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.checked = !!c.ofCurrent
  cb.addEventListener('change', () => { c.ofCurrent = cb.checked; onPersist() })
  wrap.appendChild(cb)
  wrap.appendChild(text(' of base'))
  return wrap
}

function statusSelect(c: Extract<Condition, { status: ActiveStatusKind }>): HTMLSelectElement {
  const map: Record<ActiveStatusKind, string> = {
    statBuff: 'stat buff',
    statDebuff: 'stat debuff',
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
  const sel = makeSelect([...STATUS], c.status, (v) => { c.status = v as ActiveStatusKind; onPersist() }, (v) => map[v as ActiveStatusKind] ?? v)
  return sel
}

function presentToggle(c: Extract<Condition, { present: boolean }>, toggle: () => void): HTMLElement {
  const btn = button(c.present ? 'is' : 'is not', 'se-mini', () => { toggle(); onPersist(); })
  btn.title = 'Toggle presence'
  return btn
}

function rankChips(c: Extract<Condition, { ranks: string[] }>): HTMLElement {
  const wrap = div('se-chips')
  for (const r of RANK_LIST) {
    const active = c.ranks.includes(r)
    const chip = button(r[0].toUpperCase() + r.slice(1), `se-chip${active ? ' on' : ''}`, () => {
      const next = active ? c.ranks.filter((x) => x !== r) : [...c.ranks, r]
      c.ranks = next
      onPersist()
      wrap.replaceChildren(...RANK_LIST.map((rr) => {
        const a = c.ranks.includes(rr)
        const ch = button(rr[0].toUpperCase() + rr.slice(1), `se-chip${a ? ' on' : ''}`, () => {
          const n = a ? c.ranks.filter((x) => x !== rr) : [...c.ranks, rr]
          c.ranks = n
          onPersist()
        })
        return ch
      }))
    })
    wrap.appendChild(chip)
  }
  return wrap
}

function skillPickers(
  c: Extract<Condition, { skillId?: string }>,
): HTMLSelectElement {
  const sel = makeSelect(
    [...PLAYER_SKILL_IDS],
    c.skillId ?? PLAYER_SKILL_IDS[0],
    (v) => { c.skillId = v; onPersist() },
    skillName,
  )
  return sel
}

function itemPicker(c: Extract<Condition, { itemId: string }>): HTMLSelectElement {
  const ids = Object.keys(ITEMS)
  const sel = makeSelect(ids, c.itemId, (v) => { c.itemId = v; onPersist() }, itemName)
  return sel
}

function conditionGroup(c: Extract<Condition, { conditions?: Condition[]; condition?: Condition }>): HTMLElement {
  const wrap = div('se-cond-group')
  if (c.kind === 'not') {
    wrap.appendChild(conditionRow(c.condition as Condition, (next) => { c.condition = next; onPersist() }))
    return wrap
  }
  const list = div('se-cond-list')
  ;(c.conditions ?? []).forEach((sub, i) => {
    const item = div('se-cond-item')
    item.appendChild(conditionRow(sub, (next) => {
      ;(c.conditions as Condition[])[i] = next
      onPersist()
    }))
    const rm = button('✕', 'se-mini rm', () => {
      ;(c.conditions as Condition[]) = (c.conditions as Condition[]).filter((_, j) => j !== i)
      onPersist()
    })
    item.appendChild(rm)
    list.appendChild(item)
  })
  const add = button('+ add', 'se-mini add', () => {
    ;(c.conditions as Condition[]).push(defaultCondition('hp-pct'))
    onPersist()
  })
  wrap.append(list, add)
  return wrap
}

// ---------------------------------------------------------------------------
// The single condition row used everywhere.
// ---------------------------------------------------------------------------

function conditionRow(cond: Condition, onChange: (next: Condition) => void): HTMLElement {
  const row = div('se-c-row')
  const kindSel = makeSelect(
    CONDITION_KINDS.map((k) => k.kind),
    cond.kind,
    (v) => {
      if (v === cond.kind) return
      const next = defaultCondition(v as Condition['kind'])
      onChange(next)
    },
    (k) => CONDITION_KINDS.find((x) => x.kind === k)?.label ?? k,
  )
  row.appendChild(kindSel)
  row.appendChild(conditionParams(cond))
  return row
}

// ---------------------------------------------------------------------------
// Trigger, target, action editors.
// ---------------------------------------------------------------------------

function triggerEditor(t: Trigger | undefined, setTrigger: (t: Trigger | undefined) => void): HTMLElement {
  const wrap = div('se-sec')
  const head = div('se-sec-head')
  head.textContent = 'TRIGGER'
  wrap.appendChild(head)
  const opsRow = div('se-ops')
  const opBtn = (op: 'AND' | 'OR', labelText: string) => {
    const active = (t?.operator ?? 'AND') === op
    const b = button(labelText, `se-chip${active ? ' on' : ''}`, () => {
      const next: Trigger = { ...(t ?? { conditions: [] }), operator: op }
      setTrigger(next)
    })
    return b
  }
  opsRow.append(opBtn('AND', 'AND'), opBtn('OR', 'OR'))
  wrap.appendChild(opsRow)

  const list = div('se-cond-list')
  const conds = t?.conditions ?? []
  if (conds.length === 0) {
    const hint = text('(always true when no conditions)')
    hint.className = 'se-dim'
    list.appendChild(hint)
  } else {
    conds.forEach((c, i) => {
      const item = div('se-cond-item')
      item.appendChild(conditionRow(c, (next) => {
        const nc = [...conds]
        nc[i] = next
        setTrigger({ operator: t?.operator ?? 'AND', conditions: nc })
      }))
      const rm = button('✕', 'se-mini rm', () => {
        setTrigger({ operator: t?.operator ?? 'AND', conditions: conds.filter((_, j) => j !== i) })
      })
      item.appendChild(rm)
      list.appendChild(item)
    })
  }
  wrap.appendChild(list)
  const add = button('+ condition', 'se-mini add', () => {
    if (conds.length >= 3) return
    setTrigger({ operator: t?.operator ?? 'AND', conditions: [...conds, defaultCondition('hp-pct')] })
  })
  add.disabled = conds.length >= 3
  wrap.appendChild(add)
  return wrap
}

function targetEditor(tr: TargetRule, setTarget: (t: TargetRule) => void): HTMLElement {
  const wrap = div('se-sec')
  const head = div('se-sec-head')
  head.textContent = 'TARGET'
  wrap.appendChild(head)
  const row = div('se-target-row')
  row.appendChild(
    makeSelect([...Object.keys(TARGET_SEL)], tr.kind, (v) => setTarget({ ...tr, kind: v as TargetRuleKind }), (v) => TARGET_SEL[v as TargetRuleKind]),
  )
  if (tr.condition) {
    const item = div('se-cond-item')
    item.appendChild(conditionRow(tr.condition, (next) => setTarget({ ...tr, condition: next })))
    const rm = button('✕', 'se-mini rm', () => { const { condition: _c, ...rest } = tr; setTarget(rest) })
    item.appendChild(rm)
    row.appendChild(item)
  } else {
    const add = button('+ narrowing condition', 'se-mini add', () => setTarget({ ...tr, condition: defaultCondition('hp-pct') }))
    row.appendChild(add)
  }
  wrap.appendChild(row)
  return wrap
}

function actionEditor(a: SkillSelector, setAction: (a: SkillSelector) => void, reactionGate: EventPattern | null): HTMLElement {
  const wrap = div('se-sec')
  const head = div('se-sec-head')
  head.textContent = 'ACTION'
  wrap.appendChild(head)
  const srcRow = div('se-ops')
  for (const src of ['skills', 'items'] as const) {
    const active = a.source === src
    const b = button(src, `se-chip${active ? ' on' : ''}`, () => { setAction({ ...a, source: src }) })
    srcRow.appendChild(b)
  }
  wrap.appendChild(srcRow)

  const list = div('se-cond-list')
  a.filters.forEach((f, i) => {
    const item = div('se-cond-item')
    item.appendChild(filterRow(f, (next) => {
      const nf = [...a.filters]
      nf[i] = next
      setAction({ ...a, filters: nf })
    }, a.source, reactionGate))
    const rm = button('✕', 'se-mini rm', () => {
      setAction({ ...a, filters: a.filters.filter((_, j) => j !== i) })
    })
    item.appendChild(rm)
    list.appendChild(item)
  })
  if (a.filters.length === 0) {
    const hint = text(a.source === 'skills' ? 'any skill the hero knows' : 'any usable item')
    hint.className = 'se-dim'
    list.appendChild(hint)
  }
  wrap.appendChild(list)
  const add = button('+ filter', 'se-mini add', () => {
    setAction({ ...a, filters: [...a.filters, defaultFilter('byId', a.source)] })
  })
  wrap.appendChild(add)
  return wrap
}

function filterRow(
  f: SkillSelectorFilter,
  setFilter: (f: SkillSelectorFilter) => void,
  source: 'skills' | 'items',
  reactionGate: EventPattern | null,
): HTMLElement {
  const row = div('se-filter-row')
  row.innerHTML = `<select class="se-fk"></select>`
  const sel = row.querySelector('.se-fk') as HTMLSelectElement
  for (const k of FILTER_KINDS) {
    const o = document.createElement('option')
    o.value = k
    o.textContent = FILTER_LABEL[k]
    sel.appendChild(o)
  }
  sel.value = f.kind
  sel.addEventListener('change', () => {
    const next = defaultFilter(sel.value as SkillSelectorFilter['kind'], source)
    setFilter(next)
  })

  const params = div('se-f-params')
  row.appendChild(params)
  renderFilterParams(f, params, setFilter, source, reactionGate)
  return row
}

function renderFilterParams(
  f: SkillSelectorFilter,
  params: HTMLElement,
  setFilter: (f: SkillSelectorFilter) => void,
  source: 'skills' | 'items',
  reactionGate: EventPattern | null,
): void {
  params.replaceChildren()
  switch (f.kind) {
    case 'byId': {
      const choices = source === 'skills' ? [...BASIC_ACTION_IDS, ...reactionSkFor(reactionGate)] : Object.keys(ITEMS)
      params.appendChild(makeSelect(choices, f.skillId, (v) => setFilter({ ...f, skillId: v }), (v) => (source === 'skills' ? skillName(v) : itemName(v))))
      break
    }
    case 'byElement':
      params.appendChild(makeSelect([...ELEMENTS], f.element as string, (v) => setFilter({ ...f, element: v as Element })))
      break
    case 'byKind':
      params.appendChild(makeSelect([...SKILL_KIND], f.skillKind, (v) => setFilter({ ...f, skillKind: v as SkillKind }), (v) => v))
      break
    case 'byTag':
      params.appendChild(makeSelect([...TAG_CHOICES], f.tag, (v) => setFilter({ ...f, tag: v })))
      break
    case 'byMpCost':
      params.appendChild(makeSelect([...OPS], f.op, (v) => setFilter({ ...f, op: v as CompareOp })))
      params.appendChild(numInput(() => f.value, (v) => setFilter({ ...f, value: v })))
      {
        const wrap = document.createElement('label')
        wrap.className = 'se-check'
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.checked = !!f.ofCurrent
        cb.addEventListener('change', () => setFilter({ ...f, ofCurrent: cb.checked }))
        wrap.appendChild(cb)
        wrap.appendChild(text(' of max'))
        params.appendChild(wrap)
      }
      break
    case 'byCooldownReady':
      {
        const b = button(f.ready ? 'off cooldown' : 'on cooldown', 'se-mini', () => setFilter({ ...f, ready: !f.ready }))
        params.appendChild(b)
      }
      break
    case 'byCastDelay':
      params.appendChild(makeSelect([...OPS], f.op, (v) => setFilter({ ...f, op: v as CompareOp })))
      params.appendChild(numInput(() => f.value, (v) => setFilter({ ...f, value: v })))
      break
    case 'byPower':
      params.appendChild(makeSelect([...OPS], f.op, (v) => setFilter({ ...f, op: v as CompareOp })))
      params.appendChild(numInput(() => f.value, (v) => setFilter({ ...f, value: v })))
      break
    default: {
      const _x: never = f
      void _x
    }
  }
}

function defaultFilter(kind: SkillSelectorFilter['kind'], source: 'skills' | 'items'): SkillSelectorFilter {
  switch (kind) {
    case 'byId':
      return { kind, skillId: source === 'skills' ? PLAYER_SKILL_IDS[0] : Object.keys(ITEMS)[0] }
    case 'byElement':
      return { kind, element: ELEMENTS[0] }
    case 'byKind':
      return { kind, skillKind: 'damage' }
    case 'byTag':
      return { kind, tag: 'damage' }
    case 'byMpCost':
      return { kind, op: '<', value: 0.5, ofCurrent: false }
    case 'byCooldownReady':
      return { kind, ready: true }
    case 'byCastDelay':
      return { kind, op: '<', value: 50 }
    case 'byPower':
      return { kind, op: '>', value: 0 }
    default: {
      const _x: never = kind
      return _x
    }
  }
}

/** Skills whose reactionTo matches a reaction gate kind. */
function reactionSkFor(gate: EventPattern | null): string[] {
  if (!gate) return [...PLAYER_SKILL_IDS]
  const matches = PLAYER_SKILL_IDS.filter((id) => {
    try {
      const def = getSkill(id)
      return (def.reactionTo ?? []).some((p) => p.kind === gate.kind)
    } catch {
      return false
    }
  })
  return matches.length > 0 ? matches : [...PLAYER_SKILL_IDS]
}

// ---------------------------------------------------------------------------
// Reaction editor.
// ---------------------------------------------------------------------------

function reactionEditor(r: ReactionRule, setReaction: (r: ReactionRule) => void): HTMLElement {
  const wrap = div('se-sec')
  const head = div('se-sec-head')
  head.textContent = 'WHEN'
  wrap.appendChild(head)
  const gateRow = div('se-ops')
  gateRow.appendChild(
    makeSelect([...EVENTS], r.gate.kind, (v) => setReaction({ ...r, gate: { ...r.gate, kind: v as EventKind } }), (v) => EVENT_LABEL[v as EventKind]),
  )
  const sourceSel = makeSelect(['any', ...ACTORS], r.gate.source ?? 'any', (v) => setReaction({ ...r, gate: { ...r.gate, source: v === 'any' ? undefined : (v as ActorFilter) } }))
  const targetSel = makeSelect(['any', ...ACTORS], r.gate.target ?? 'any', (v) => setReaction({ ...r, gate: { ...r.gate, target: v === 'any' ? undefined : (v as ActorFilter) } }))
  sourceSel.title = 'Source filter'
  targetSel.title = 'Target filter'
  gateRow.append(text('source'), sourceSel, text('target'), targetSel)
  wrap.appendChild(gateRow)

  const ifList = div('se-cond-list')
  ;(r.conditions ?? []).forEach((c, i) => {
    const item = div('se-cond-item')
    item.appendChild(conditionRow(c, (next) => {
      const nc = [...(r.conditions ?? [])]
      nc[i] = next
      setReaction({ ...r, conditions: nc })
    }))
    const rm = button('✕', 'se-mini rm', () => {
      setReaction({ ...r, conditions: (r.conditions ?? []).filter((_, j) => j !== i) })
    })
    item.appendChild(rm)
    ifList.appendChild(item)
  })
  if ((r.conditions ?? []).length === 0) {
    const hint = text('no extra conditions')
    hint.className = 'se-dim'
    ifList.appendChild(hint)
  }
  const addCond = button('+ condition', 'se-mini add', () => {
    setReaction({ ...r, conditions: [...(r.conditions ?? []), defaultCondition('hp-pct')] })
  })
  const ifSec = div('se-sec')
  const ifHead = div('se-sec-head')
  ifHead.textContent = 'IF'
  ifSec.append(ifHead, ifList, addCond)
  wrap.appendChild(ifSec)

  wrap.appendChild(targetEditor(r.target, (t) => setReaction({ ...r, target: t })))
  wrap.appendChild(actionEditor(r.action, (a) => setReaction({ ...r, action: a }), r.gate))

  const delayRow = div('se-ops')
  delayRow.appendChild(text('Delay (CTB turns, 0 = instant)'))
  delayRow.appendChild(numInput(() => r.delay ?? 0, (v) => setReaction({ ...r, delay: v })))
  wrap.appendChild(delayRow)
  return wrap
}

// ---------------------------------------------------------------------------
// Rule card builder (block line).
// ---------------------------------------------------------------------------

function ruleCard(line: ScriptLine, index: number, block: ScriptBlock): HTMLElement {
  const card = div('se-rule')
  const head = div('se-rule-head')
  const prio = text(String(index + 1).padStart(2, '0'))
  prio.className = 'se-prio'
  const summary = text(lineLabel(line))
  summary.className = 'se-summary'
  head.append(prio, summary)
  card.appendChild(head)

  const open = expandedRules.has(line.id)
  const body = div(open ? 'se-rule-body' : 'se-rule-body hidden')
  body.appendChild(triggerEditor(line.trigger, (t) => { line.trigger = t; onPersist() }))
  body.appendChild(targetEditor(line.target, (t) => { line.target = t; onPersist() }))
  body.appendChild(actionEditor(line.action, (a) => { line.action = a; onPersist() }, null))

  const actions = div('se-rule-actions')
  const toggle = button(open ? '▾' : '▸', 'se-toggle', () => {
    const nowOpen = body.classList.toggle('hidden')
    toggle.textContent = nowOpen ? '▸' : '▾'
    if (nowOpen) expandedRules.delete(line.id)
    else expandedRules.add(line.id)
  })
  const up = button('↑', 'se-mini', () => moveLine(block, index, -1))
  const down = button('↓', 'se-mini', () => moveLine(block, index, 1))
  const del = button('✕', 'se-mini rm', () => {
    block.lines = block.lines.filter((l) => l.id !== line.id)
    expandedRules.delete(line.id)
    onPersist()
  })
  up.title = 'Move up'
  down.title = 'Move down'
  del.title = 'Delete rule'
  actions.append(toggle, up, down, del)
  card.append(actions, body)
  return card
}

function moveLine(block: ScriptBlock, index: number, dir: -1 | 1): void {
  const next = index + dir
  if (next < 0 || next >= block.lines.length) return
  const lines = [...block.lines]
  ;[lines[index], lines[next]] = [lines[next], lines[index]]
  block.lines = lines
  onPersist()
}

// ---------------------------------------------------------------------------
// Block + script render.
// ---------------------------------------------------------------------------

function render(): void {
  if (!root || !draft) return
  const nameEl = root.querySelector('.se-name') as HTMLInputElement
  nameEl.value = draft.name
  bodyEl!.replaceChildren()
  bodyEl!.append(
    blockEditor(draft.rootBlock, 0),
    fallbackEditor(draft),
    reactionsEditor(draft),
    previewEditor(),
  )
}

function blockEditor(block: ScriptBlock, level: 0 | 1 | 2): HTMLElement {
  const wrap = div('se-block')
  if (level > 0) {
    const head = div('se-block-head')
    head.textContent = `BLOCK LEVEL ${level}`
    wrap.appendChild(head)
    wrap.appendChild(triggerEditor(block.trigger, (t) => { block.trigger = t; onPersist() }))
  } else {
    const head = div('se-block-head')
    head.textContent = 'RULES'
    wrap.appendChild(head)
  }
  block.lines.forEach((line, i) => wrap.appendChild(ruleCard(line, i, block)))

  const add = button('+ add rule', 'se-mini add', () => {
    block.lines.push(emptyLine())
    onPersist()
  })
  wrap.appendChild(add)

  if (level < 2) {
    const nested = div('se-nested')
    block.nested.forEach((sub) => nested.appendChild(blockEditor(sub, (level + 1) as 0 | 1 | 2)))
    const addNested = button('+ nested block', 'se-mini add', () => {
      block.nested.push({ id: uuid(), depth: (level + 1) as 0 | 1 | 2, trigger: undefined, lines: [], nested: [] })
      onPersist()
    })
    nested.appendChild(addNested)
    wrap.appendChild(nested)
  }
  return wrap
}

function emptyLine(): ScriptLine {
  return {
    id: uuid(),
    target: { kind: 'lowest-hp-enemy' },
    action: { source: 'skills', filters: [] },
  }
}

function fallbackEditor(script: CharacterScript): HTMLElement {
  const wrap = div('se-sec')
  const head = div('se-sec-head')
  head.textContent = 'FALLBACK (locked, always last)'
  wrap.appendChild(head)
  const fb = script.fallback as ScriptLine
  const summary = text(`→ attacks ${targetLabel(fb.target)}`)
  summary.className = 'se-summary'
  wrap.appendChild(summary)
  wrap.appendChild(targetEditor(fb.target, (t) => { fb.target = t; onPersist() }))
  wrap.appendChild(actionEditor(fb.action, (a) => { fb.action = a; onPersist() }, null))
  return wrap
}

function reactionsEditor(script: CharacterScript): HTMLElement {
  const wrap = div('se-block')
  const head = div('se-block-head')
  head.textContent = 'REACTIONS'
  wrap.appendChild(head)
  script.reactions.forEach((r, i) => {
    const card = div('se-rule')
    const headEl = div('se-rule-head')
    const prio = text('R')
    prio.className = 'se-prio'
    const summary = text(reactionLineLabel(r))
    summary.className = 'se-summary'
    headEl.append(prio, summary)
    card.appendChild(headEl)
    const open = expandedRules.has(r.id)
    const body = div(open ? 'se-rule-body' : 'se-rule-body hidden')
    body.appendChild(reactionEditor(r, (next) => { script.reactions[i] = next; onPersist() }))
    const actions = div('se-rule-actions')
    const toggle = button(open ? '▾' : '▸', 'se-toggle', () => {
      const nowOpen = body.classList.toggle('hidden')
      toggle.textContent = nowOpen ? '▸' : '▾'
      if (nowOpen) expandedRules.delete(r.id)
      else expandedRules.add(r.id)
    })
    const del = button('✕', 'se-mini rm', () => {
      script.reactions = script.reactions.filter((x) => x.id !== r.id)
      expandedRules.delete(r.id)
      onPersist()
    })
    actions.append(toggle, del)
    card.append(actions, body)
    wrap.appendChild(card)
  })
  const add = button('+ reaction', 'se-mini add', () => {
    script.reactions.push({
      id: uuid(),
      gate: { kind: 'attacked' },
      target: { kind: 'trigger-target' },
      action: { source: 'skills', filters: [{ kind: 'byId', skillId: 'attack' }] },
    })
    onPersist()
  })
  wrap.appendChild(add)
  return wrap
}

// ---------------------------------------------------------------------------
// M5 Dry-run preview.
// ---------------------------------------------------------------------------

const ALL_ITEM_IDS = Object.keys(ITEMS)

interface PreviewState {
  heroClass: string
  hp: number
  mp: number
  turnCount: number
  statuses: ActiveStatusKind[]
  eventKind: EventKind
  eventSource: 'hero' | 'enemy0' | 'enemy1'
  eventTarget: 'hero' | 'enemy0' | 'enemy1'
  lastResult: ReturnType<typeof dryRunChooseAction> | null
  lastReactions: ReactionPlan[] | null
}

const preview: PreviewState = {
  heroClass: 'knight',
  hp: 0.5,
  mp: 0.5,
  turnCount: 1,
  statuses: [],
  eventKind: 'attacked',
  eventSource: 'enemy0',
  eventTarget: 'hero',
  lastResult: null,
  lastReactions: null,
}

function heroClassDef(): { id: string; name: string } | undefined {
  return CLASSES.find((c) => c.id === preview.heroClass)
}

function buildPreviewBattle(): { battle: BattleState; heroId: string; enemyIds: string[] } {
  const hero = createCharacter({ classId: preview.heroClass, name: heroClassDef()?.name ?? preview.heroClass, level: 5 })
  hero.loadout = [...PLAYER_SKILL_IDS]
  const battle = createDryRunBattle([hero], [ENEMIES.slime!, ENEMIES.goblin!], 7)
  const heroId = hero.id
  const enemyIds = Object.values(battle.actors)
    .filter((a) => a.side === 'enemy')
    .map((a) => a.id)
    .sort()
  applyDryRunMocks(battle, {
    [heroId]: {
      hpFraction: preview.hp,
      mpFraction: preview.mp,
      statuses: preview.statuses.length > 0 ? [...preview.statuses] : undefined,
      items: [...ALL_ITEM_IDS],
      turnCount: preview.turnCount,
    },
  })
  return { battle, heroId, enemyIds }
}

function runPreview(): void {
  if (!draft) return
  const { battle, heroId } = buildPreviewBattle()
  preview.lastResult = dryRunChooseAction(battle, heroId, draft, createRng(battle.seed))
  preview.lastReactions = null
  renderPreviewResult()
  renderPreviewReactions()
}

function applyPreviewEvent(): void {
  if (!draft) return
  const { battle, heroId, enemyIds } = buildPreviewBattle()
  const keyToId = (k: string): string => (k === 'hero' ? heroId : enemyIds[k === 'enemy1' ? 1 : 0])
  const event: BattleEvent = {
    kind: preview.eventKind,
    actorId: keyToId(preview.eventTarget),
    sourceId: keyToId(preview.eventSource),
  }
  preview.lastReactions = dryRunCheckReactions(battle, event, undefined, (cid) => (cid === heroId ? draft ?? undefined : undefined))
  preview.lastResult = null
  renderPreviewResult()
  renderPreviewReactions()
}

function actionLabel(a: BattleAction): string {
  let what: string
  if (a.kind === 'skill') what = skillName(a.skillId ?? '')
  else if (a.kind === 'item') what = itemName(a.itemId ?? '')
  else if (a.kind === 'attack') what = 'basic attack'
  else what = 'basic defend'
  return a.targetId ? `${what} \u2192 ${a.targetId}` : what
}

function renderPreviewResult(): void {
  if (!root) return
  const box = root.querySelector<HTMLElement>('[data-preview-result]')
  if (!box) return
  box.replaceChildren()
  if (!preview.lastResult) {
    box.appendChild(text('Press Run to walk the turn rules.'))
    return
  }
  const r = preview.lastResult
  if (!r.action) {
    box.appendChild(text('No action — script is empty or all rules evaluate false.'))
    return
  }
  const prefix = r.fromFallback ? 'Fallback' : `Rule ${String(r.ruleIndex + 1).padStart(2, '0')}`
  const rule = r.line ? ` \u00B7 ${lineLabel(r.line)}` : ''
  const depth = r.blockDepth > 0 ? ` (depth ${r.blockDepth})` : ''
  const consume = r.wouldConsumeItemId ? ` \u2014 consumes ${itemName(r.wouldConsumeItemId)}` : ''
  box.appendChild(text(`${prefix}${rule}${depth} \u2192 ${actionLabel(r.action)}${consume}`))
}

function renderPreviewReactions(): void {
  if (!root) return
  const box = root.querySelector<HTMLElement>('[data-preview-events]')
  if (!box) return
  box.replaceChildren()
  if (!preview.lastReactions) {
    box.appendChild(text('Fire an event to see reactions.'))
    return
  }
  if (preview.lastReactions.length === 0) {
    box.appendChild(text('No reactions fire for that event.'))
    return
  }
  for (const p of preview.lastReactions) {
    const what = p.kind === 'skill' ? skillName(p.skillId ?? '') : p.kind === 'item' ? itemName(p.itemId ?? '') : p.kind
    const tgt = p.targetId ? ` \u2192 ${p.targetId}` : ''
    box.appendChild(text(`${p.id} \u00B7 ${what}${tgt} (+${p.delay} CTB)`))
  }
}

function previewEditor(): HTMLElement {
  const wrap = div('se-preview')
  const head = div('se-sec-head')
  head.textContent = 'DRY-RUN PREVIEW'
  wrap.appendChild(head)

  const hint = text('Mock profile: every player skill + all items. Run walks the turn rules; Apply fires a mocked event for reactions.')
  hint.className = 'se-dim'
  wrap.appendChild(hint)

  const mockRow = div('se-preview-mock')

  const classSel = makeSelect(
    CLASSES.map((c) => c.id),
    preview.heroClass,
    (v) => { preview.heroClass = v },
    (v) => heroClassDef()?.name ?? v,
  )
  const classRow = div('se-p-row')
  classRow.append(text('Class'), classSel)
  mockRow.appendChild(classRow)

  const hpRow = fracSlider('HP', () => preview.hp, (v) => { preview.hp = v })
  mockRow.appendChild(hpRow)
  const mpRow = fracSlider('MP', () => preview.mp, (v) => { preview.mp = v })
  mockRow.appendChild(mpRow)

  const turnRow = div('se-p-row')
  turnRow.append(text('Turn'), numInput(() => preview.turnCount, (v) => { preview.turnCount = Math.max(0, Math.round(v)) }))
  mockRow.appendChild(turnRow)

  const statusRow = div('se-preview-statuses')
  statusRow.appendChild(text('Statuses'))
  const chips = div('se-chips')
  const rebuildChips = () => {
    chips.replaceChildren(
      ...STATUS.map((ss) => {
        const a = preview.statuses.includes(ss)
        return button(ss, `se-chip${a ? ' on' : ''}`, () => {
          preview.statuses = a ? preview.statuses.filter((x) => x !== ss) : [...preview.statuses, ss]
          rebuildChips()
        })
      }),
    )
  }
  rebuildChips()
  statusRow.appendChild(chips)
  mockRow.appendChild(statusRow)
  wrap.appendChild(mockRow)

  const btnRow = div('se-preview-btns')
  btnRow.appendChild(button('Run', 'se-btn', runPreview))
  btnRow.appendChild(button('Reset', 'se-btn ghost', () => {
    Object.assign(preview, { hp: 0.5, mp: 0.5, turnCount: 1, statuses: [], lastResult: null, lastReactions: null })
    render()
  }))
  wrap.appendChild(btnRow)

  const resultBox = div('se-preview-result')
  resultBox.dataset.previewResult = '1'
  wrap.appendChild(resultBox)

  const evtHead = div('se-sec-head')
  evtHead.textContent = 'EVENT MOCK (reactions)'
  wrap.appendChild(evtHead)
  const evtRow = div('se-preview-evt')
  const actorKeys = ['hero', 'enemy0', 'enemy1']
  const actorLabels = ['The hero', 'Enemy #1', 'Enemy #2']
  evtRow.appendChild(makeSelect([...EVENTS], preview.eventKind, (v) => { preview.eventKind = v as EventKind }, (v) => EVENT_LABEL[v as EventKind]))
  evtRow.appendChild(makeSelect(actorKeys, preview.eventSource, (v) => { preview.eventSource = v as PreviewState['eventSource'] }, (k) => actorLabels[actorKeys.indexOf(k)] ?? k))
  evtRow.appendChild(makeSelect(actorKeys, preview.eventTarget, (v) => { preview.eventTarget = v as PreviewState['eventTarget'] }, (k) => actorLabels[actorKeys.indexOf(k)] ?? k))
  evtRow.appendChild(button('Apply', 'se-btn', applyPreviewEvent))
  wrap.appendChild(evtRow)

  const reactBox = div('se-preview-events')
  reactBox.dataset.previewEvents = '1'
  wrap.appendChild(reactBox)

  return wrap
}

function fracSlider(label: string, get: () => number, set: (v: number) => void): HTMLElement {
  const row = div('se-p-row')
  row.appendChild(text(label))
  const val = text(`${Math.round(get() * 100)}%`)
  const inp = document.createElement('input')
  inp.type = 'range'
  inp.min = '0'
  inp.max = '100'
  inp.step = '5'
  inp.value = String(Math.round(get() * 100))
  inp.addEventListener('input', () => {
    const pct = parseInt(inp.value, 10)
    set(Math.max(0, Math.min(1, pct / 100)))
    val.textContent = `${pct}%`
  })
  row.append(inp, val)
  return row
}

// ---------------------------------------------------------------------------

function skillName(id: string): string {
  if (id === 'attack') return 'Basic attack'
  if (id === 'defend') return 'Basic defend'
  try {
    return getSkill(id).name
  } catch {
    return id
  }
}

function itemName(id: string): string {
  try {
    return getItem(id).name
  } catch {
    return id
  }
}

function onPersist(): void {
  persist()
  render()
}
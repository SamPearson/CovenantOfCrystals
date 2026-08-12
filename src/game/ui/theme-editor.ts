/**
 * Theme Studio — a DOM overlay for creating / editing / activating / saving /
 * loading / deleting color profiles. Phaser has no native text/color inputs,
 * so the editor is a styled HTML panel layered above the canvas (z-index),
 * driven entirely by the core theme store (`core/themes.ts`).
 *
 * The overlay is a module singleton that survives scene restarts (which happen
 * when the active theme changes), so focus/input state is preserved while the
 * player edits colors live. The left column lists profiles; the right column
 * edits the selected profile's colors with native color pickers.
 */

import { THEME, colorHex } from './theme'
import {
  getThemeProfiles,
  getActiveProfile,
  createProfileFrom,
  renameProfile,
  updateProfileColors,
  updateProfileRarity,
  deleteProfile,
  activateProfile,
  persistThemes,
  subscribeThemes,
  isPresetProfile,
  THEME_COLOR_KEYS,
  RARITY_KEYS,
  type ThemeProfile,
  type ThemeColorKey,
  type ThemeRarityKey,
  type ThemeColorPatch,
} from '../../core/themes'

let root: HTMLDivElement | null = null
let listEl: HTMLDivElement | null = null
let editorEl: HTMLDivElement | null = null
let editingId: string | null = null
let editorBuiltFor: string | null = null

export function showThemeEditor(): void {
  const el = ensureRoot()
  el.classList.remove('hidden')
  render()
}

export function hideThemeEditor(): void {
  if (root) root.classList.add('hidden')
}

export function isThemeEditorVisible(): boolean {
  return !!root && !root.classList.contains('hidden')
}

function ensureRoot(): HTMLDivElement {
  if (root) return root

  root = document.createElement('div')
  root.id = 'theme-editor'
  root.classList.add('hidden')
  root.innerHTML = `
    <div class="te-header">
      <h2 class="te-title">Theme Studio</h2>
      <button class="te-close" type="button" title="Close">✕</button>
    </div>
    <div class="te-body">
      <div class="te-list"></div>
      <div class="te-editor"></div>
    </div>
    <div class="te-footer">
      <span class="te-saved-msg"></span>
      <button class="te-btn ghost" data-act="new" type="button">New profile</button>
      <button class="te-btn" data-act="save" type="button">Save</button>
    </div>`
  document.body.appendChild(root)

  listEl = root.querySelector('.te-list')
  editorEl = root.querySelector('.te-editor')
  root.querySelector('.te-close')!.addEventListener('click', hideThemeEditor)
  root.querySelector('[data-act="new"]')!.addEventListener('click', onNewProfile)
  root.querySelector('[data-act="save"]')!.addEventListener('click', onSave)

  subscribeThemes(() => {
    if (!root || root.classList.contains('hidden')) return
    applyCssVars()
    renderList()
    ensureEditorFor(editingId)
  })

  document.addEventListener('keydown', onKeyDown)
  return root
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') hideThemeEditor()
}

function render(): void {
  applyCssVars()
  renderList()
  ensureEditorFor(editingId)
}

function applyCssVars(): void {
  const c = THEME.colors
  const set = (name: string, value: string) => root!.style.setProperty(name, value)
  set('--te-bg', colorHex(c.bg))
  set('--te-panel', colorHex(c.panel))
  set('--te-face', colorHex(c.face))
  set('--te-border', colorHex(c.border))
  set('--te-borderLight', colorHex(c.borderLight))
  set('--te-accent', colorHex(c.accent))
  set('--te-hover', colorHex(c.hover))
  set('--te-gold', colorHex(c.gold))
  set('--te-bad', c.bad)
  set('--te-good', c.good)
  set('--te-disabled', colorHex(c.disabled))
  set('--te-text', c.text)
  set('--te-textMuted', c.textMuted)
  set('--te-textDim', c.textDim)
  set('--te-textOnAccent', c.textOnAccent)
}

// --- Profile list ----------------------------------------------------------

function renderList(): void {
  const active = getActiveProfile()
  const profiles = getThemeProfiles()
  listEl!.replaceChildren()

  for (const p of profiles) {
    const isActive = p.id === active.id
    const row = document.createElement('div')
    row.className = `te-row${isActive ? ' active' : ''}`

    const head = document.createElement('div')
    head.className = 'te-row-head'
    const name = document.createElement('div')
    name.className = 'te-row-name'
    name.textContent = p.name
    const badge = document.createElement('span')
    badge.className = 'te-row-badge'
    badge.textContent = isActive ? 'ACTIVE' : isPresetProfile(p.id) ? 'PRESET' : ''
    head.append(name, badge)

    const swatches = document.createElement('div')
    swatches.className = 'te-swatches'
    for (const k of ['bg', 'panel', 'accent', 'gold'] as const) {
      const s = document.createElement('span')
      s.className = 'te-swatch'
      s.style.background = colorHex(p.colors[k])
      swatches.appendChild(s)
    }

    const actions = document.createElement('div')
    actions.className = 'te-row-actions'
    const activate = document.createElement('button')
    activate.type = 'button'
    activate.className = 'te-btn'
    activate.textContent = isActive ? 'Active' : 'Activate'
    activate.disabled = isActive
    activate.title = isActive ? 'This theme is active' : 'Apply this theme'
    activate.addEventListener('click', () => activateProfile(p.id))

    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'te-btn'
    edit.textContent = 'Edit'
    edit.title = isPresetProfile(p.id) ? 'Duplicates the preset so you can customize it' : 'Edit colors'
    edit.addEventListener('click', () => {
      if (isPresetProfile(p.id)) {
        const copy = createProfileFrom(p.id, `${p.name} copy`)
        editingId = copy.id
      } else {
        editingId = p.id
      }
      render()
    })

    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'te-btn danger'
    del.textContent = 'Delete'
    del.disabled = isPresetProfile(p.id)
    del.title = isPresetProfile(p.id) ? 'Built-in themes cannot be deleted' : 'Delete this theme'
    del.addEventListener('click', () => {
      if (editingId === p.id) editingId = null
      deleteProfile(p.id)
      render()
    })

    actions.append(activate, edit, del)
    row.append(head, swatches, actions)
    listEl!.appendChild(row)
  }
}

// --- Editor ----------------------------------------------------------------

function ensureEditorFor(id: string | null): void {
  if (editorBuiltFor === id) return
  editorBuiltFor = id
  renderEditor(id)
}

function renderEditor(id: string | null): void {
  const p = id ? getThemeProfiles().find((x) => x.id === id) : undefined
  if (!p) {
    editorEl!.replaceChildren(emptyEditor('Select a profile to edit its colors.'))
    return
  }
  editorEl!.replaceChildren(buildEditor(p))
}

function emptyEditor(text: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'te-editor-empty'
  el.textContent = text
  return el
}

function buildEditor(p: ThemeProfile): HTMLElement {
  const frag = document.createElement('div')

  const head = document.createElement('div')
  head.className = 'te-edit-head'
  const name = document.createElement('input')
  name.type = 'text'
  name.className = 'te-name-input'
  name.value = p.name
  name.maxLength = 40
  name.addEventListener('change', () => {
    const v = name.value.trim()
    if (!v) {
      name.value = p.name
      return
    }
    try {
      renameProfile(p.id, v)
    } catch {
      name.value = p.name
    }
  })
  head.appendChild(name)
  frag.appendChild(head)

  const grouped = new Map<string, { key: ThemeColorKey; kind: 'num' | 'str'; label: string }[]>()
  for (const meta of THEME_COLOR_KEYS) {
    const arr = grouped.get(meta.group) ?? []
    arr.push({ key: meta.key, kind: meta.kind, label: meta.label })
    grouped.set(meta.group, arr)
  }
  for (const [group, rows] of grouped) {
    const g = document.createElement('div')
    g.className = 'te-group'
    const h = document.createElement('h4')
    h.textContent = group
    g.appendChild(h)
    for (const r of rows) g.appendChild(colorRow(r.key, r.kind, r.label, p))
    frag.appendChild(g)
  }

  const g = document.createElement('div')
  g.className = 'te-group'
  const h = document.createElement('h4')
  h.textContent = 'Rarity'
  g.appendChild(h)
  for (const r of RARITY_KEYS) g.appendChild(rarityRow(r.key, r.label, p))
  frag.appendChild(g)

  return frag
}

function colorValue(p: ThemeProfile, key: ThemeColorKey, kind: 'num' | 'str'): string {
  const v = p.colors[key]
  return kind === 'num' ? colorHex(v as number) : (v as string)
}

function colorRow(key: ThemeColorKey, kind: 'num' | 'str', label: string, p: ThemeProfile): HTMLElement {
  const row = document.createElement('div')
  row.className = 'te-color-row'

  const lab = document.createElement('label')
  lab.textContent = label
  lab.htmlFor = `te-color-${key}`

  const color = document.createElement('input')
  color.type = 'color'
  color.id = `te-color-${key}`
  color.value = colorValue(p, key, kind)
  color.addEventListener('input', () => applyColor(key, kind, color.value))

  const hex = document.createElement('input')
  hex.type = 'text'
  hex.className = 'te-hex'
  hex.value = colorValue(p, key, kind)
  hex.addEventListener('change', () => {
    const v = hex.value.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      hex.classList.remove('invalid')
      applyColor(key, kind, v)
    } else {
      hex.classList.add('invalid')
      hex.value = colorValue(p, key, kind)
    }
  })

  row.append(lab, color, hex)
  return row
}

function rarityRow(key: ThemeRarityKey, label: string, p: ThemeProfile): HTMLElement {
  const row = document.createElement('div')
  row.className = 'te-color-row'

  const lab = document.createElement('label')
  lab.textContent = label
  lab.htmlFor = `te-rarity-${key}`

  const color = document.createElement('input')
  color.type = 'color'
  color.id = `te-rarity-${key}`
  color.value = colorHex(p.rarity[key])
  color.addEventListener('input', () => applyRarity(key, color.value))

  const hex = document.createElement('input')
  hex.type = 'text'
  hex.className = 'te-hex'
  hex.value = colorHex(p.rarity[key])
  hex.addEventListener('change', () => {
    const v = hex.value.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      hex.classList.remove('invalid')
      applyRarity(key, v)
    } else {
      hex.classList.add('invalid')
      hex.value = colorHex(p.rarity[key])
    }
  })

  row.append(lab, color, hex)
  return row
}

function applyColor(key: ThemeColorKey, kind: 'num' | 'str', cssHex: string): void {
  if (!editingId) return
  const patch: ThemeColorPatch = kind === 'num' ? { [key]: parseInt(cssHex.slice(1), 16) } : { [key]: cssHex }
  try {
    updateProfileColors(editingId, patch)
  } catch {
    // editingId no longer exists — drop silently
  }
}

function applyRarity(key: ThemeRarityKey, cssHex: string): void {
  if (!editingId) return
  try {
    updateProfileRarity(editingId, { [key]: parseInt(cssHex.slice(1), 16) })
  } catch {
    // drop silently
  }
}

// --- Footer actions --------------------------------------------------------

function onNewProfile(): void {
  const p = createProfileFrom(getActiveProfile().id)
  editingId = p.id
  render()
}

function onSave(): void {
  persistThemes()
  const msg = root!.querySelector('.te-saved-msg')
  msg!.textContent = 'Saved'
  window.setTimeout(() => {
    msg!.textContent = ''
  }, 1500)
}

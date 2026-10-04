/**
 * Shared character detail view used by the Boxes and Party panels. Renders
 * into two horizontally split scrollable zones:
 *   1. Left scroll — identity, septagon, stats, gear
 *   2. Right scroll — skills, auto-battle script selector, action buttons
 */

import Phaser from 'phaser'
import { THEME } from '../theme'
import { uiText, makeButton, makeBadge, makeScrollRegion } from '../widgets'
import { showTooltip, hideTooltip } from '../tooltip'
import {
  durabilityLabel,
  statLabel,
  statList,
  roleLabel,
  elementLabel,
} from '../format'
import { getProfile, getScripts, assignScript, mutate } from '../../../core/store'
import { getClass, getItem, getSkill, derivedStats, getSkillPool } from '../../../core'
import { describeItem, describeSkill } from '../../../core/tooltips'
import type { TooltipLine } from '../../../core/tooltips'
import { drawSeptagon } from '../septagon'

interface HoverBand {
  top: number
  bottom: number
  payload: () => TooltipLine[]
  onClick?: () => void
}

export interface DetailAction {
  label: string
  onClick: () => void
  disabled?: boolean
  color?: number
}

export function buildCharacterDetail(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  charId: string,
  actions: DetailAction[],
): void {
  const profile = getProfile()
  const c = profile.characters[charId]
  if (!c) return

  const cls = getClass(c.classId)
  const stats = derivedStats(c)
  const pad = THEME.spacing.pad
  const textMuted = THEME.colors.textMuted
  const heading = THEME.colors.accentBlue
  const gap = 8 // gap between the two scroll regions

  // ── Layout ──────────────────────────────────────────────────────────────
  // Split the available width into two scroll regions:
  //   Left:  50% of width (identity + septagon + stats + gear)
  //   Right: 50% of width (skills + script + actions)
  // A small gap separates them.

  const leftW = Math.floor((w - gap) / 2)
  const rightW = w - leftW - gap
  const leftX = x
  const rightX = x + leftW + gap

  // ── LEFT SCROLL REGION ──────────────────────────────────────────────────
  // Contains: name, badges, class info, septagon, stats list, gear
  const leftScroll = makeScrollRegion(scene, parent, leftX, y, leftW, h, {
    fillColor: THEME.colors.face,
    strokeColor: THEME.colors.border,
  })
  const leftView = leftScroll.content

  let leftY = pad
  const hoverBandsLeft: HoverBand[] = []

  // Name
  const nameText = uiText(scene, pad, leftY, c.name, { size: 'lg' }, leftView)
  // Pencil edit button next to name
  const pencilText = uiText(scene, pad + nameText.width + 8, leftY, '✎', { size: 'lg', color: textMuted }, leftView)
  pencilText.setInteractive({ useHandCursor: true })
  hoverBandsLeft.push({
    top: leftY,
    bottom: leftY + nameText.height,
    payload: () => [],
    onClick: () => editCharacterName(charId),
  })
  leftY += nameText.height + 12

  // Badges row
  const badges = [
    { label: roleLabel(cls.role), color: textMuted },
    { label: elementLabel(cls.element), color: textMuted },
    {
      label: durabilityLabel(c.durability),
      color: c.durability.kind === 'expires' ? THEME.colors.warn : THEME.colors.good,
    },
  ]
  let bx = pad
  for (const b of badges) {
    const badge = makeBadge(scene, bx, leftY, b.label, b.color, {}, leftView)
    bx += badge.width + 6
  }
  leftY += 26

  // Meta line
  const metaText = uiText(
    scene,
    pad,
    leftY,
    `${cls.name} · Lv ${c.level} · XP ${c.xp}`,
    { size: 'sm', color: textMuted },
    leftView,
  )
  leftY += metaText.height + 16

  // Septagon — centered in the left panel
  const septagonRadius = Math.min(80, (leftW - pad * 2) / 2)
  const septX = leftW / 2
  const septY = leftY + septagonRadius + 10

  drawSeptagon(scene, {
    x: septX,
    y: septY,
    radius: septagonRadius,
    stats,
    classId: c.classId,
    parent: leftView,
  })

  // Position stats list below septagon
  leftY = septY + septagonRadius + 16

  // STATS label and list
  uiText(scene, pad, leftY, 'STATS', { size: 'xs', color: heading }, leftView)
  leftY += 16
  for (const s of statList(stats)) {
    uiText(scene, pad, leftY, statLabel(s.key), { size: 'sm', color: textMuted }, leftView)
    uiText(scene, leftW - pad, leftY, String(s.value), { size: 'sm' }, leftView).setOrigin(1, 0)
    leftY += 19
  }
  leftY += 16

  // GEAR
  uiText(scene, pad, leftY, 'GEAR', { size: 'xs', color: heading }, leftView)
  leftY += 16
  for (const slot of ['weapon', 'armor'] as const) {
    const g = c.gear[slot]
    if (g) {
      const item = getItem(g.itemId)
      const color = THEME.rarity[item.rarity]
      uiText(scene, pad, leftY, `${slot.toUpperCase()}  `, { size: 'sm', color: textMuted }, leftView)
      const itemText = uiText(scene, pad + 70, leftY, item.name, { size: 'sm', color }, leftView)
      uiText(
        scene,
        pad + 70 + itemText.width + 8,
        leftY,
        `(${durabilityLabel(g.durability)})`,
        { size: 'xs', color: textMuted },
        leftView,
      )
      hoverBandsLeft.push({
        top: leftY,
        bottom: leftY + 20,
        payload: () => describeItem(item),
      })
    } else {
      uiText(scene, pad, leftY, `${slot.toUpperCase()}  —`, { size: 'sm', color: textMuted }, leftView)
    }
    leftY += 20
  }

  leftScroll.setContentHeight(leftY + pad)

  // Hover tooltips for left scroll region
  let activeBandLeft: HoverBand | null = null
  let hoverTimerLeft: Phaser.Time.TimerEvent | null = null

  const bandAtLeft = (contentY: number): HoverBand | null =>
    hoverBandsLeft.find((b) => contentY >= b.top && contentY < b.bottom) ?? null

  leftScroll.layer.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    const contentY = leftScroll.worldToContentY(pointer.worldY)
    const band = bandAtLeft(contentY)
    if (band === activeBandLeft) return
    activeBandLeft = band
    if (hoverTimerLeft) hoverTimerLeft.remove(false)
    hoverTimerLeft = null
    if (!band) {
      hideTooltip(scene)
      return
    }
    hoverTimerLeft = scene.time.delayedCall(150, () => {
      hoverTimerLeft = null
      const lines = band.payload()
      if (lines.length > 0) showTooltip(scene, pointer.worldX, pointer.worldY, lines)
    })
  })

  leftScroll.layer.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    const contentY = leftScroll.worldToContentY(pointer.worldY)
    const band = bandAtLeft(contentY)
    if (band?.onClick) {
      band.onClick()
    }
  })

  leftScroll.layer.on('pointerout', () => {
    if (hoverTimerLeft) hoverTimerLeft.remove(false)
    hoverTimerLeft = null
    activeBandLeft = null
    hideTooltip(scene)
  })

  // ── RIGHT SCROLL REGION ─────────────────────────────────────────────────
  // Contains: skills, auto-battle script selector, action buttons
  const rightScroll = makeScrollRegion(scene, parent, rightX, y, rightW, h, {
    fillColor: THEME.colors.face,
    strokeColor: THEME.colors.border,
  })
  const rightView = rightScroll.content

  let rightY = pad

  // SKILLS
  uiText(scene, pad, rightY, 'SKILLS', { size: 'xs', color: heading }, rightView)
  rightY += 16
  const pool = getSkillPool(c)
  const hoverBandsRight: HoverBand[] = []
  if (pool.length === 0) {
    const none = uiText(scene, pad, rightY, '—', { size: 'xs', color: textMuted }, rightView)
    rightY += none.height + 8
  } else {
    for (const entry of pool) {
      const sourceTag =
        entry.source === 'native' ? 'native' : entry.source === 'learned' ? 'learned' : 'gear'
      uiText(scene, pad, rightY, getSkill(entry.skillId).name, { size: 'xs', color: textMuted }, rightView)
      const tag = makeBadge(
        scene,
        pad + 110,
        rightY - 2,
        sourceTag,
        entry.source === 'gear'
          ? THEME.colors.warn
          : entry.source === 'learned'
            ? THEME.colors.good
            : THEME.colors.textDim,
        {},
        rightView,
      )
      const rowH = Math.max(18, tag.height + 6)
      hoverBandsRight.push({
        top: rightY,
        bottom: rightY + rowH,
        payload: () => describeSkill(getSkill(entry.skillId), { stats }, {}),
      })
      rightY += rowH
    }
    rightY += 8
  }

  // AUTO BATTLE section
  uiText(
    scene,
    pad,
    rightY,
    'AUTO BATTLE: how this hero fights. Manual = choose every turn.',
    { size: 'xs', color: textMuted, wordWrap: rightW - pad * 2 },
    rightView,
  )
  rightY += 20

  const scripts = getScripts()
  const options: (string | undefined)[] = [undefined, ...scripts.map((s) => s.id)]
  const curScript = c.scriptId !== undefined && scripts.some((s) => s.id === c.scriptId) ? c.scriptId : undefined
  const label = curScript === undefined ? 'Manual' : scripts.find((s) => s.id === curScript)?.name ?? 'Manual'

  uiText(scene, pad, rightY, 'AUTO BATTLE', { size: 'xs', color: heading }, rightView)
  rightY += 16
  const scriptName = uiText(scene, pad + 26 + 6, rightY, label, {
    size: 'sm',
    color: curScript === undefined ? THEME.colors.textMuted : THEME.colors.text,
  }, rightView)

  const cycle = (delta: number): void => {
    const idx = options.indexOf(curScript)
    const next = options[(idx + delta + options.length) % options.length]
    assignScript(charId, next)
    // Refresh the whole panel to reflect the change
    // Note: the parent panel will need to call refresh after this
  }
  makeButton(scene, pad, rightY - 6, '‹', () => cycle(-1), { width: 26, height: 28, fontSize: 'sm' }, rightView)
  makeButton(scene, pad + 26 + 6 + scriptName.width + 6, rightY - 6, '›', () => cycle(1), { width: 26, height: 28, fontSize: 'sm' }, rightView)
  rightY += 36

  // Footer action buttons
  rightY += 8
  let ax = pad
  for (const action of actions) {
    const button = makeButton(
      scene,
      ax,
      rightY,
      action.label,
      action.onClick,
      { width: 112, height: 32, color: action.color, fontSize: 'sm' },
      rightView,
    )
    if (action.disabled) button.setDisabled(true)
    ax += 120
  }
  rightY += 40

  rightScroll.setContentHeight(rightY + pad)

  // Hover tooltips for right scroll region
  let activeBandRight: HoverBand | null = null
  let hoverTimerRight: Phaser.Time.TimerEvent | null = null

  const bandAtRight = (contentY: number): HoverBand | null =>
    hoverBandsRight.find((b) => contentY >= b.top && contentY < b.bottom) ?? null

  rightScroll.layer.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    const contentY = rightScroll.worldToContentY(pointer.worldY)
    const band = bandAtRight(contentY)
    if (band === activeBandRight) return
    activeBandRight = band
    if (hoverTimerRight) hoverTimerRight.remove(false)
    hoverTimerRight = null
    if (!band) {
      hideTooltip(scene)
      return
    }
    hoverTimerRight = scene.time.delayedCall(150, () => {
      hoverTimerRight = null
      const lines = band.payload()
      if (lines.length > 0) showTooltip(scene, pointer.worldX, pointer.worldY, lines)
    })
  })

  rightScroll.layer.on('pointerout', () => {
    if (hoverTimerRight) hoverTimerRight.remove(false)
    hoverTimerRight = null
    activeBandRight = null
    hideTooltip(scene)
  })

  function editCharacterName(id: string): void {
    const profile = getProfile()
    const ch = profile.characters[id]
    if (!ch) return

    const input = document.createElement('input')
    input.type = 'text'
    input.value = ch.name
    input.maxLength = 16
    input.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      padding: 8px 12px; font-size: 14px; border: 2px solid #c9b896;
      background: #1a1612; color: #e8dfc8; border-radius: 4px; z-index: 10000;
    `
    document.body.appendChild(input)
    input.focus()
    input.select()

    const submit = () => {
      const name = input.value.trim()
      input.remove()
      if (name && name !== ch.name) {
        mutate((p) => { p.characters[id].name = name })
        // The parent panel (PartyPanel or BoxesPanel) will refresh on store notify
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit()
      if (e.key === 'Escape') { input.remove() }
    })
    input.addEventListener('blur', submit)
  }
}

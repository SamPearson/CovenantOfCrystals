/**
 * Shared character detail view used by the Boxes and Party panels. Renders
 * into two distinct zones:
 *   1. Fixed header — name, badges, septagon (non-scrolling)
 *   2. Scrollable body — gear, stats, skills, autobattle selector
 *
 * The septagon is drawn directly in the scene (not inside the scroll region),
 * so it is never clipped by the scroll texture.
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
import { getProfile, getScripts, assignScript } from '../../../core/store'
import { getClass, getItem, getSkill, derivedStats, getSkillPool } from '../../../core'
import { describeItem, describeSkill } from '../../../core/tooltips'
import type { TooltipLine } from '../../../core/tooltips'
import { drawSeptagon } from '../septagon'

interface HoverBand {
  top: number
  bottom: number
  payload: () => TooltipLine[]
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

  // ── Layout ──────────────────────────────────────────────────────────────
  // The detail panel is split into two vertical zones:
  //   FIXED header zone (non-scrolling, draws septagon + character identity)
  //   SCROLL body zone (scrollable gear, stats, skills, autobattle)
  //
  // The septagon is drawn at scene-level coordinates (parent + header offset)
  // so the scroll region's texture never clips it.

  const fixedHeaderH = 180 // pixels reserved for fixed header
  const scrollTopY = y + fixedHeaderH // Y where scroll region starts (in parent coords)

  // ── Fixed header zone ──────────────────────────────────────────────────
  // Drawn directly into the parent (scene-relative via parent coords).
  // This sits at (x, y) within the detail panel.

  // Name
  const nameY = y + pad
  const nameText = uiText(scene, x + pad, nameY, c.name, { size: 'lg' }, parent)
  const nameH = nameText.height
  let scrollHeadY = nameY + nameH + 12

  // Badges row
  const badges = [
    { label: roleLabel(cls.role), color: textMuted },
    { label: elementLabel(cls.element), color: textMuted },
    {
      label: durabilityLabel(c.durability),
      color: c.durability.kind === 'expires' ? THEME.colors.warn : THEME.colors.good,
    },
  ]
  let bx = x + pad
  for (const b of badges) {
    const badge = makeBadge(scene, bx, scrollHeadY, b.label, b.color, {}, parent)
    bx += badge.width + 6
  }
  scrollHeadY += 26

  // Meta line
  const metaText = uiText(
    scene,
    x + pad,
    scrollHeadY,
    `${cls.name} · Lv ${c.level} · XP ${c.xp}`,
    { size: 'sm', color: textMuted },
    parent,
  )
  scrollHeadY += metaText.height + 8

  // Septagon — drawn at scene-level Y so the scroll texture won't cover it.
  // Positioned in the right half of the fixed header zone.
  const septagonRadius = Math.min(80, (w - pad * 2) / 2 - 20)
  const septX = x + pad + septagonRadius + 10
  const septY = scrollHeadY - 10
  drawSeptagon(scene, {
    x: septX,
    y: septY,
    radius: septagonRadius,
    stats,
    classId: c.classId,
    parent,
  })

  // ── Scrollable body ───────────────────────────────────────────────────
  const scrollRegion = makeScrollRegion(scene, parent, x, scrollTopY, w, h - fixedHeaderH, {
    fillColor: THEME.colors.face,
    strokeColor: THEME.colors.border,
  })
  const view = scrollRegion.content

  let scY = pad

  const hoverBands: HoverBand[] = []

  // GEAR
  uiText(scene, pad, scY, 'GEAR', { size: 'xs', color: heading }, view)
  scY += 16
  for (const slot of ['weapon', 'armor'] as const) {
    const g = c.gear[slot]
    if (g) {
      const item = getItem(g.itemId)
      const color = THEME.rarity[item.rarity]
      uiText(scene, pad, scY, `${slot.toUpperCase()}  `, { size: 'sm', color: textMuted }, view)
      const itemText = uiText(scene, pad + 70, scY, item.name, { size: 'sm', color }, view)
      uiText(
        scene,
        pad + 70 + itemText.width + 8,
        scY,
        `(${durabilityLabel(g.durability)})`,
        { size: 'xs', color: textMuted },
        view,
      )
      hoverBands.push({
        top: scY,
        bottom: scY + 20,
        payload: () => describeItem(item),
      })
    } else {
      uiText(scene, pad, scY, `${slot.toUpperCase()}  —`, { size: 'sm', color: textMuted }, view)
    }
    scY += 20
  }
  scY += 8

  // STATS
  uiText(scene, pad, scY, 'STATS', { size: 'xs', color: heading }, view)
  scY += 16
  for (const s of statList(stats)) {
    uiText(scene, pad, scY, statLabel(s.key), { size: 'sm', color: textMuted }, view)
    uiText(scene, w - pad, scY, String(s.value), { size: 'sm' }, view).setOrigin(1, 0)
    scY += 19
  }
  scY += 8

  // SKILLS
  uiText(scene, pad, scY, 'SKILLS', { size: 'xs', color: heading }, view)
  scY += 16
  const pool = getSkillPool(c)
  if (pool.length === 0) {
    const none = uiText(scene, pad, scY, '—', { size: 'xs', color: textMuted }, view)
    scY += none.height + 8
  } else {
    for (const entry of pool) {
      const sourceTag =
        entry.source === 'native' ? 'native' : entry.source === 'learned' ? 'learned' : 'gear'
      uiText(scene, pad, scY, getSkill(entry.skillId).name, { size: 'xs', color: textMuted }, view)
      const tag = makeBadge(
        scene,
        pad + 110,
        scY - 2,
        sourceTag,
        entry.source === 'gear'
          ? THEME.colors.warn
          : entry.source === 'learned'
            ? THEME.colors.good
            : THEME.colors.textDim,
        {},
        view,
      )
      const rowH = Math.max(18, tag.height + 6)
      hoverBands.push({
        top: scY,
        bottom: scY + rowH,
        payload: () => describeSkill(getSkill(entry.skillId), { stats }, {}),
      })
      scY += rowH
    }
    scY += 4
  }

  uiText(
    scene,
    pad,
    scY,
    `Runs ${c.earned.runs} · Wins ${c.earned.wins}`,
    { size: 'xs', color: textMuted },
    view,
  )
  scY += 12

  uiText(
    scene,
    pad,
    scY,
    'AUTO BATTLE: how this hero fights. Manual = choose every turn.',
    { size: 'xs', color: textMuted, wordWrap: w - pad * 2 },
    view,
  )
  scY += 16

  // AUTO BATTLE selector — pinned in scroll region's live layer
  const abY = (h - fixedHeaderH) - 86
  uiText(scene, pad, abY, 'AUTO BATTLE', { size: 'xs', color: heading }, scrollRegion.container)

  const scripts = getScripts()
  const options: (string | undefined)[] = [undefined, ...scripts.map((s) => s.id)]
  const curScript = c.scriptId !== undefined && scripts.some((s) => s.id === c.scriptId) ? c.scriptId : undefined
  const label = curScript === undefined ? 'Manual' : scripts.find((s) => s.id === curScript)?.name ?? 'Manual'
  const scriptName = uiText(scene, pad + 26 + 6, abY + 16, label, {
    size: 'sm',
    color: curScript === undefined ? THEME.colors.textMuted : THEME.colors.text,
  }, scrollRegion.container)

  const cycle = (delta: number): void => {
    const idx = options.indexOf(curScript)
    const next = options[(idx + delta + options.length) % options.length]
    assignScript(charId, next)
  }
  makeButton(scene, pad, abY + 10, '‹', () => cycle(-1), { width: 26, height: 28, fontSize: 'sm' }, scrollRegion.container)
  makeButton(scene, pad + 26 + 6 + scriptName.width + 6, abY + 10, '›', () => cycle(1), { width: 26, height: 28, fontSize: 'sm' }, scrollRegion.container)

  // Footer action buttons
  const ay = (h - fixedHeaderH) - 44
  let ax = pad
  for (const action of actions) {
    const button = makeButton(
      scene,
      ax,
      ay,
      action.label,
      action.onClick,
      { width: 112, height: 32, color: action.color, fontSize: 'sm' },
      scrollRegion.container,
    )
    if (action.disabled) button.setDisabled(true)
    ax += 120
  }

  scrollRegion.setContentHeight(scY + 92)

  // Hover tooltips for baked scroll content
  let activeBand: HoverBand | null = null
  let hoverTimer: Phaser.Time.TimerEvent | null = null

  const bandAt = (contentY: number): HoverBand | null =>
    hoverBands.find((b) => contentY >= b.top && contentY < b.bottom) ?? null

  scrollRegion.layer.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    const contentY = scrollRegion.worldToContentY(pointer.worldY)
    const band = bandAt(contentY)
    if (band === activeBand) return
    activeBand = band
    if (hoverTimer) hoverTimer.remove(false)
    hoverTimer = null
    if (!band) {
      hideTooltip(scene)
      return
    }
    hoverTimer = scene.time.delayedCall(150, () => {
      hoverTimer = null
      const lines = band.payload()
      if (lines.length > 0) showTooltip(scene, pointer.worldX, pointer.worldY, lines)
    })
  })

  scrollRegion.layer.on('pointerout', () => {
    if (hoverTimer) hoverTimer.remove(false)
    hoverTimer = null
    activeBand = null
    hideTooltip(scene)
  })
}

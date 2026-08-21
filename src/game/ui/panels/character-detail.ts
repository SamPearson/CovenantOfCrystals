/**
 * Shared character detail view used by the Boxes and Party panels. Renders
 * into a scrollable region so long content (stats, skills) never overflows
 * the panel. Action buttons are pinned to the bottom of the region.
 */

import { THEME } from '../theme'
import { uiText, makeButton, makeBadge, makeScrollRegion } from '../widgets'
import {
  durabilityLabel,
  statLabel,
  statList,
  roleLabel,
  elementLabel,
} from '../format'
import { getProfile, setAutobattle } from '../../../core/store'
import { getClass, getItem, getSkill, derivedStats } from '../../../core'
import type { PlayerAiPresetId } from '../../../core/types'

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

  const region = makeScrollRegion(scene, parent, x, y, w, h, {
    fillColor: THEME.colors.face,
    strokeColor: THEME.colors.border,
  })
  const view = region.content

  let yy = pad

  const name = uiText(scene, pad, yy, c.name, { size: 'lg' }, view)
  yy += name.height + 8

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
    const badge = makeBadge(scene, bx, yy, b.label, b.color, {}, view)
    bx += badge.width + 6
  }
  yy += 26

  const meta = uiText(
    scene,
    pad,
    yy,
    `${cls.name} · Lv ${c.level} · XP ${c.xp}`,
    { size: 'sm', color: textMuted },
    view,
  )
  yy += meta.height + 12

  uiText(scene, pad, yy, 'GEAR', { size: 'xs', color: heading }, view)
  yy += 16
  for (const slot of ['weapon', 'armor'] as const) {
    const g = c.gear[slot]
    if (g) {
      const item = getItem(g.itemId)
      const color = THEME.rarity[item.rarity]
      uiText(scene, pad, yy, `${slot.toUpperCase()}  `, { size: 'sm', color: textMuted }, view)
      const itemText = uiText(scene, pad + 70, yy, item.name, { size: 'sm', color }, view)
      uiText(
        scene,
        pad + 70 + itemText.width + 8,
        yy,
        `(${durabilityLabel(g.durability)})`,
        { size: 'xs', color: textMuted },
        view,
      )
    } else {
      uiText(scene, pad, yy, `${slot.toUpperCase()}  —`, { size: 'sm', color: textMuted }, view)
    }
    yy += 20
  }
  yy += 8

  uiText(scene, pad, yy, 'STATS', { size: 'xs', color: heading }, view)
  yy += 16
  for (const s of statList(stats)) {
    uiText(scene, pad, yy, statLabel(s.key), { size: 'sm', color: textMuted }, view)
    uiText(scene, w - pad, yy, String(s.value), { size: 'sm' }, view).setOrigin(1, 0)
    yy += 19
  }
  yy += 8

  uiText(scene, pad, yy, 'SKILLS', { size: 'xs', color: heading }, view)
  yy += 16
  const loadout =
    c.loadout.length > 0 ? c.loadout.map((id) => getSkill(id).name).join(', ') : '—'
  const skills = uiText(
    scene,
    pad,
    yy,
    loadout,
    { size: 'xs', color: textMuted, wordWrap: w - pad * 2 },
    view,
  )
  yy += skills.height + 8

  uiText(
    scene,
    pad,
    yy,
    `Runs ${c.earned.runs} · Wins ${c.earned.wins}`,
    { size: 'xs', color: textMuted },
    view,
  )
  yy += 12

  uiText(
    scene,
    pad,
    yy,
    'AUTO BATTLE: how this hero fights. Off = manual · DPS/Healer use battle AI.',
    { size: 'xs', color: textMuted, wordWrap: w - pad * 2 },
    view,
  )
  yy += 16

  // The selector must live in the LIVE `region.container` layer — `content`
  // (view) is rendered into a texture and is non-interactive, so any buttons
  // placed there are not clickable. Pinned just above the footer so it stays put
  // while the stats/skills content scrolls.
  const abY = h - 86
  uiText(scene, pad, abY, 'AUTO BATTLE', { size: 'xs', color: heading }, region.container)
  const aiOpts: { id: PlayerAiPresetId | undefined; label: string }[] = [
    { id: undefined, label: 'Off' },
    { id: 'dps', label: 'DPS' },
    { id: 'healer', label: 'Healer' },
  ]
  let aiX = pad
  for (const opt of aiOpts) {
    const selected = c.autobattle === opt.id
    const btn = makeButton(
      scene,
      aiX,
      abY + 16,
      opt.label,
      () => setAutobattle(charId, opt.id),
      {
        width: 84,
        height: 28,
        fontSize: 'sm',
        color: selected ? THEME.colors.accentBlue : THEME.colors.accent,
      },
      region.container,
    )
    if (selected) btn.setDisabled(true)
    aiX += 90
  }

  // Footer: action buttons pinned to the bottom of the region (fixed layer).
  const ay = h - 44
  let ax = pad
  for (const action of actions) {
    const button = makeButton(
      scene,
      ax,
      ay,
      action.label,
      action.onClick,
      { width: 112, height: 32, color: action.color, fontSize: 'sm' },
      region.container,
    )
    if (action.disabled) button.setDisabled(true)
    ax += 120
  }

  // Reserve room below the content so the last line can scroll clear of the
  // pinned AUTO BATTLE selector and footer.
  region.setContentHeight(yy + 92)
}

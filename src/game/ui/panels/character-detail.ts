/**
 * Shared character detail view used by the Boxes and Party panels. Renders
 * into a parent container at local coordinates — no nested containers.
 */

import Phaser from 'phaser'
import { THEME } from '../theme'
import { uiText, makeButton, makeBadge, makeSubpanel } from '../widgets'
import {
  durabilityLabel,
  statLabel,
  statList,
  roleLabel,
  elementLabel,
} from '../format'
import { getProfile } from '../../../core/store'
import { getClass, getItem, getSkill, derivedStats } from '../../../core'

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
  const accent = THEME.colors.accent

  makeSubpanel(scene, parent, x, y, w, h, { fillColor: THEME.colors.panel })

  let yy = y + pad

  const name = uiText(scene, x + pad, yy, c.name, { size: 'lg' }, parent)
  yy += name.height + 8

  let bx = x + pad
  const badges = [
    { label: roleLabel(cls.role), color: textMuted },
    { label: elementLabel(cls.element), color: textMuted },
    {
      label: durabilityLabel(c.durability),
      color: c.durability.kind === 'expires' ? THEME.colors.warn : THEME.colors.good,
    },
  ]
  for (const b of badges) {
    const badge = makeBadge(scene, bx, yy, b.label, b.color, { width: 74, height: 20 }, parent)
    bx += badge.width + 6
  }
  yy += 26

  const meta = uiText(
    scene,
    x + pad,
    yy,
    `${cls.name} · Lv ${c.level} · XP ${c.xp}`,
    { size: 'sm', color: textMuted },
    parent,
  )
  yy += meta.height + 12

  uiText(scene, x + pad, yy, 'GEAR', { size: 'xs', color: accent }, parent)
  yy += 16
  for (const slot of ['weapon', 'armor'] as const) {
    const g = c.gear[slot]
    if (g) {
      const item = getItem(g.itemId)
      const color = THEME.rarity[item.rarity]
      uiText(scene, x + pad, yy, `${slot.toUpperCase()}  `, { size: 'sm', color: textMuted }, parent)
      const itemText = uiText(scene, x + pad + 70, yy, item.name, { size: 'sm', color }, parent)
      uiText(
        scene,
        x + pad + 70 + itemText.width + 8,
        yy,
        `(${durabilityLabel(g.durability)})`,
        { size: 'xs', color: textMuted },
        parent,
      )
    } else {
      uiText(scene, x + pad, yy, `${slot.toUpperCase()}  —`, { size: 'sm', color: textMuted }, parent)
    }
    yy += 20
  }
  yy += 8

  uiText(scene, x + pad, yy, 'STATS', { size: 'xs', color: accent }, parent)
  yy += 16
  for (const s of statList(stats)) {
    uiText(scene, x + pad, yy, statLabel(s.key), { size: 'sm', color: textMuted }, parent)
    uiText(scene, x + w - pad, yy, String(s.value), { size: 'sm' }, parent).setOrigin(1, 0)
    yy += 19
  }
  yy += 8

  uiText(scene, x + pad, yy, 'SKILLS', { size: 'xs', color: accent }, parent)
  yy += 16
  const loadout =
    c.loadout.length > 0 ? c.loadout.map((id) => getSkill(id).name).join(', ') : '—'
  const skills = uiText(
    scene,
    x + pad,
    yy,
    loadout,
    { size: 'xs', color: textMuted, wordWrap: w - pad * 2 },
    parent,
  )
  yy += skills.height + 8

  uiText(
    scene,
    x + pad,
    yy,
    `Runs ${c.earned.runs} · Wins ${c.earned.wins}`,
    { size: 'xs', color: textMuted },
    parent,
  )

  let ax = x + pad
  const ay = y + h - 46
  for (const action of actions) {
    const button = makeButton(
      scene,
      ax,
      ay,
      action.label,
      action.onClick,
      { width: 112, height: 32, color: action.color, fontSize: 'sm' },
      parent,
    )
    if (action.disabled) button.setDisabled(true)
    ax += 120
  }
}

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
import { getProfile, getScripts, assignScript } from '../../../core/store'
import { getClass, getItem, getSkill, derivedStats, getSkillPool } from '../../../core'

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
  const pool = getSkillPool(c)
  if (pool.length === 0) {
    const none = uiText(scene, pad, yy, '—', { size: 'xs', color: textMuted }, view)
    yy += none.height + 8
  } else {
    for (const entry of pool) {
      const sourceTag =
        entry.source === 'native' ? 'native' : entry.source === 'learned' ? 'learned' : 'gear'
      uiText(scene, pad, yy, getSkill(entry.skillId).name, { size: 'xs', color: textMuted }, view)
      const tag = makeBadge(
        scene,
        pad + 110,
        yy - 2,
        sourceTag,
          entry.source === 'gear'
            ? THEME.colors.warn
            : entry.source === 'learned'
              ? THEME.colors.good
              : THEME.colors.textDim,
        {},
        view,
      )
      yy += Math.max(18, tag.height + 6)
    }
    yy += 4
  }

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
    'AUTO BATTLE: how this hero fights. Manual = choose every turn.',
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

  // Library-backed script selector: Manual + every script in the library.
  // A cycle (< / >) keeps the pinned row compact no matter how many scripts
  // exist. The displayed name resolves via the profile library.
  const scripts = getScripts()
  const options: (string | undefined)[] = [undefined, ...scripts.map((s) => s.id)]
  const curScript = c.scriptId !== undefined && scripts.some((s) => s.id === c.scriptId) ? c.scriptId : undefined
  const label = curScript === undefined ? 'Manual' : scripts.find((s) => s.id === curScript)?.name ?? 'Manual'
  const scriptName = uiText(scene, pad + 26 + 6, abY + 16, label, {
    size: 'sm',
    color: curScript === undefined ? THEME.colors.textMuted : THEME.colors.text,
  }, region.container)

  const cycle = (delta: number): void => {
    const idx = options.indexOf(curScript)
    const next = options[(idx + delta + options.length) % options.length]
    assignScript(charId, next)
  }
  makeButton(scene, pad, abY + 10, '‹', () => cycle(-1), { width: 26, height: 28, fontSize: 'sm' }, region.container)
  makeButton(scene, pad + 26 + 6 + scriptName.width + 6, abY + 10, '›', () => cycle(1), { width: 26, height: 28, fontSize: 'sm' }, region.container)

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

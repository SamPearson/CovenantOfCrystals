/**
 * Level-up screen — shown as an overlay when a character has enough XP.
 * Displays current level, XP progress, and 7 flasks to assign across
 * the 7 stats with a live septagon preview.
 */

import Phaser from 'phaser'
import { THEME } from '../theme'
import { uiText, makeButton, makePanel } from '../widgets'
import { drawSeptagon } from '../septagon'
import { getProfile, levelUpCharacter } from '../../../core/store'
import { derivedStats } from '../../../core'
import {
  xpToNext,
  flaskValue,
  FLASKS_PER_LEVEL,
  LEVEL_STATS,
} from '../../../core/leveling'
import type { StatKey, StatBlock } from '../../../core/types'

const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  mp: 'MP',
  atk: 'STR',
  def: 'DEF',
  mag: 'MAG',
  res: 'RES',
  spd: 'SPD',
}

export interface LevelUpResult {
  leveled: boolean
  error?: string
}

/**
 * Shows the level-up screen for a character. Returns a function to close it.
 */
export function showLevelUpScreen(
  scene: Phaser.Scene,
  characterId: string,
  onComplete: (result: LevelUpResult) => void,
): () => void {
  const profile = getProfile()
  const c = profile.characters[characterId]
  if (!c) return () => {}

  const stats = derivedStats(c)
  const nextLevel = c.level + 1
  const cost = xpToNext(c.level)
  const potency = flaskValue(c.level)

  // Overlay container
  const overlay = scene.add.container(0, 0)
  overlay.setDepth(1000)

  // Background dimmer
  const bg = scene.add.rectangle(480, 270, 960, 540, 0x000000, 0.7)
  bg.setInteractive()
  overlay.add(bg)

  // Main panel
  const panelW = 700
  const panelH = 480
  const panelX = (960 - panelW) / 2
  const panelY = (540 - panelH) / 2
  const panel = makePanel(scene, panelX, panelY, panelW, panelH)
  overlay.add(panel)

  const pad = 20
  let yy = panelY + pad

  // Title
  const title = uiText(scene, panelX + panelW / 2, yy, `${c.name} — Level Up!`, {
    size: 'xl',
    family: 'display',
    align: 'center',
  })
  title.setOrigin(0.5, 0)
  overlay.add(title)
  yy += 40

  // Level info
  const levelInfo = uiText(
    scene,
    panelX + panelW / 2,
    yy,
    `Level ${c.level} → ${nextLevel}  ·  XP: ${c.xp - cost} / ${xpToNext(nextLevel)} (next level)  ·  Flask potency: +${potency}`,
    { size: 'sm', color: THEME.colors.textMuted, align: 'center' },
  )
  levelInfo.setOrigin(0.5, 0)
  overlay.add(levelInfo)
  yy += 30

  // Flasks remaining
  let flasksRemaining = FLASKS_PER_LEVEL
  const flasksLabel = uiText(
    scene,
    panelX + panelW / 2,
    yy,
    `Flasks remaining: ${flasksRemaining}`,
    { size: 'md', color: THEME.colors.gold, align: 'center' },
  )
  flasksLabel.setOrigin(0.5, 0)
  overlay.add(flasksLabel)
  yy += 30

  // Stat assignment rows
  const assignments: Partial<Record<StatKey, number>> = {}

  for (const key of LEVEL_STATS) {
    const rowY = yy
    const row = scene.add.container(panelX + pad, rowY)
    overlay.add(row)

    const label = uiText(scene, 0, 0, STAT_LABELS[key], { size: 'sm', color: THEME.colors.textMuted })
    row.add(label)

    const valueText = uiText(scene, 60, 0, '0', { size: 'sm' })
    row.add(valueText)

    const minusBtn = makeButton(scene, 100, -4, '-', () => {
      const current = assignments[key] ?? 0
      if (current > 0) {
        assignments[key] = current - 1
        flasksRemaining++
        valueText.setText(String(current - 1))
        flasksLabel.setText(`Flasks remaining: ${flasksRemaining}`)
      }
    }, { width: 28, height: 28, fontSize: 'sm' })
    row.add(minusBtn.container)

    const plusBtn = makeButton(scene, 140, -4, '+', () => {
      const current = assignments[key] ?? 0
      if (flasksRemaining > 0) {
        assignments[key] = current + 1
        flasksRemaining--
        valueText.setText(String(current + 1))
        flasksLabel.setText(`Flasks remaining: ${flasksRemaining}`)
      }
    }, { width: 28, height: 28, fontSize: 'sm' })
    row.add(plusBtn.container)

    // Show current stat value
    const currentVal = uiText(scene, 200, 0, `Current: ${stats[key]}`, { size: 'xs', color: THEME.colors.textDim })
    row.add(currentVal)

    yy += 30
  }

  yy += 10

  // Septagon preview — show what stats will look like after level-up
  const previewStats: StatBlock = { ...stats }
  for (const key of LEVEL_STATS) {
    const points = assignments[key] ?? 0
    if (points > 0) {
      previewStats[key] += points * potency
    }
  }

  const septagonRadius = 80
  const septagonX = panelX + panelW - septagonRadius - pad - 40
  const septagonY = yy + septagonRadius + 10
  drawSeptagon(scene, {
    x: septagonX,
    y: septagonY,
    radius: septagonRadius,
    stats: previewStats,
    classId: c.classId,
    parent: overlay,
  })

  // Preview label
  const previewLabel = uiText(
    scene,
    septagonX,
    septagonY + septagonRadius + 10,
    'Preview',
    { size: 'xs', color: THEME.colors.textMuted, align: 'center' },
  )
  previewLabel.setOrigin(0.5, 0)
  overlay.add(previewLabel)

  // Buttons
  const btnY = panelY + panelH - 50
  const confirmBtn = makeButton(scene, panelX + panelW / 2 - 120, btnY, 'Confirm', () => {
    const result = levelUpCharacter(characterId, assignments)
    onComplete({ leveled: result.ok, error: result.error })
    overlay.destroy(true)
  }, { width: 100, height: 36, fontSize: 'sm' })
  overlay.add(confirmBtn.container)

  const cancelBtn = makeButton(scene, panelX + panelW / 2 + 20, btnY, 'Cancel', () => {
    onComplete({ leveled: false })
    overlay.destroy(true)
  }, { width: 100, height: 36, fontSize: 'sm' })
  overlay.add(cancelBtn.container)

  // Return cleanup function
  return () => {
    overlay.destroy(true)
  }
}

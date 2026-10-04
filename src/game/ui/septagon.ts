/**
 * Septagon stat visualization widget — a 7-vertex radar chart showing the
 * character's stats as a shape. Physical stats (HP, STR, SPD, DEF) on the
 * right side, magic stats (MP, MAG, RES) on the left side.
 *
 * Each vertex is independently normalized against the class's natural stat
 * at level 10, so a level 10 character has a full shape and flask/gear
 * investments show as vertices extending beyond the natural proportions.
 */

import Phaser from 'phaser'
import { THEME } from './theme'
import { uiText } from './widgets'
import type { StatBlock, StatKey } from '../../core/types'
import { getClass } from '../../core/data'

/** The 7 stats in display order: top, then clockwise. */
const SEPTAGON_STATS: { key: StatKey; label: string; side: 'phys' | 'mag' }[] = [
  { key: 'hp', label: 'HP', side: 'phys' },
  { key: 'atk', label: 'STR', side: 'phys' },
  { key: 'spd', label: 'SPD', side: 'phys' },
  { key: 'def', label: 'DEF', side: 'phys' },
  { key: 'res', label: 'RES', side: 'mag' },
  { key: 'mag', label: 'MAG', side: 'mag' },
  { key: 'mp', label: 'MP', side: 'mag' },
]

/** Reference level for normalization — a level 10 character has a full shape. */
const REFERENCE_LEVEL = 10

/**
 * Calculate the reference value for each stat: the class's natural stat
 * at the reference level. Used as the denominator for normalization.
 */
function referenceStats(classId: string): StatBlock {
  const cls = getClass(classId)
  const mult = REFERENCE_LEVEL - 1
  return {
    hp: cls.baseStats.hp + cls.growth.hp * mult,
    mp: cls.baseStats.mp + cls.growth.mp * mult,
    atk: cls.baseStats.atk + cls.growth.atk * mult,
    def: cls.baseStats.def + cls.growth.def * mult,
    mag: cls.baseStats.mag + cls.growth.mag * mult,
    res: cls.baseStats.res + cls.growth.res * mult,
    spd: cls.baseStats.spd + cls.growth.spd * mult,
  }
}

/** Normalize a stat value against its reference, clamped to [0, 1.5]. */
function normalize(value: number, ref: number): number {
  if (ref <= 0) return 0
  return Math.min(value / ref, 1.5)
}

export interface SeptagonConfig {
  /** Center X of the septagon. */
  x: number
  /** Center Y of the septagon. */
  y: number
  /** Radius of the septagon (distance from center to vertex). */
  radius: number
  /** The character's derived stats to display. */
  stats: StatBlock
  /** The character's class ID (for normalization reference). */
  classId: string
  /** Optional parent container. */
  parent?: Phaser.GameObjects.Container
}

/**
 * Draw a septagon stat visualization into the scene.
 * Returns the container holding all game objects.
 */
export function drawSeptagon(
  scene: Phaser.Scene,
  config: SeptagonConfig,
): Phaser.GameObjects.Container {
  const { x, y, radius, stats, classId, parent } = config
  const container = scene.add.container(x, y)
  if (parent) parent.add(container)

  const t = THEME.colors
  const ref = referenceStats(classId)

  // Colors for physical vs magic sides
  const physColor = t.accentBlue
  const magColor = t.gold
  const gridColor = t.border

  // Draw background grid (concentric heptagons at 25%, 50%, 75%, 100%)
  const graphics = scene.add.graphics()
  container.add(graphics)

  for (let i = 1; i <= 4; i++) {
    const r = (radius * i) / 4
    graphics.lineStyle(1, gridColor, 0.3)
    graphics.beginPath()
    for (let j = 0; j < 7; j++) {
      const angle = -Math.PI / 2 + (j * 2 * Math.PI) / 7
      const px = Math.cos(angle) * r
      const py = Math.sin(angle) * r
      if (j === 0) graphics.moveTo(px, py)
      else graphics.lineTo(px, py)
    }
    graphics.closePath()
    graphics.strokePath()
  }

  // Draw axis lines from center to each vertex
  for (let j = 0; j < 7; j++) {
    const angle = -Math.PI / 2 + (j * 2 * Math.PI) / 7
    const px = Math.cos(angle) * radius
    const py = Math.sin(angle) * radius
    graphics.lineStyle(1, gridColor, 0.4)
    graphics.beginPath()
    graphics.moveTo(0, 0)
    graphics.lineTo(px, py)
    graphics.strokePath()
  }

  // Draw the stat polygon
  const points: { x: number; y: number }[] = []
  for (let j = 0; j < 7; j++) {
    const { key } = SEPTAGON_STATS[j]!
    const value = stats[key]
    const normalized = normalize(value, ref[key])
    const angle = -Math.PI / 2 + (j * 2 * Math.PI) / 7
    const r = normalized * radius
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
  }

  // Fill the stat polygon
  graphics.fillStyle(physColor, 0.12)
  graphics.beginPath()
  for (let j = 0; j < 7; j++) {
    const p = points[j]!
    if (j === 0) graphics.moveTo(p.x, p.y)
    else graphics.lineTo(p.x, p.y)
  }
  graphics.closePath()
  graphics.fillPath()

  // Stroke the stat polygon with per-vertex colors
  for (let j = 0; j < 7; j++) {
    const { side } = SEPTAGON_STATS[j]!
    const color = side === 'phys' ? physColor : magColor
    const p1 = points[j]!
    const p2 = points[(j + 1) % 7]!
    graphics.lineStyle(2, color, 0.9)
    graphics.beginPath()
    graphics.moveTo(p1.x, p1.y)
    graphics.lineTo(p2.x, p2.y)
    graphics.strokePath()
  }

  // Draw vertex dots
  for (let j = 0; j < 7; j++) {
    const { side } = SEPTAGON_STATS[j]!
    const color = side === 'phys' ? physColor : magColor
    const p = points[j]!
    graphics.fillStyle(color, 1)
    graphics.fillCircle(p.x, p.y, 3)
  }

  // Draw labels at each vertex
  for (let j = 0; j < 7; j++) {
    const { key, label, side } = SEPTAGON_STATS[j]!
    const angle = -Math.PI / 2 + (j * 2 * Math.PI) / 7
    const labelR = radius + 18
    const lx = Math.cos(angle) * labelR
    const ly = Math.sin(angle) * labelR
    const color = side === 'phys' ? physColor : magColor
    const value = stats[key]
    const text = uiText(scene, lx, ly, `${label} ${value}`, {
      size: 'xs',
      color,
      align: 'center',
    })
    text.setOrigin(0.5, 0.5)
    container.add(text)
  }

  return container
}

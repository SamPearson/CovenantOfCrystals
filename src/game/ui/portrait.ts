/**
 * Character portrait slot: reserves a fixed display area for character art
 * and draws a placeholder (element-tinted frame + glyph) until real assets
 * exist. Swap the placeholder for a Phaser image when art lands — the slot
 * geometry stays the same.
 *
 * Asset spec for sourcing/creating art:
 * - Square PNG, designed at PORTRAIT_SOURCE × PORTRAIT_SOURCE (256×256, hi-dpi).
 * - Full-frame sprite, head/face kept within the center ~60% so it survives
 *   any future cropping (e.g. a smaller battle-card slot).
 * - Rendered on screen at PORTRAIT_SLOT × PORTRAIT_SLOT (56×56 on the party
 *   menu cards today).
 */
import Phaser from 'phaser'
import { elementColor, hexColor } from './theme'
import { uiText } from './widgets'
import type { Element } from '../../core/types'

export const PORTRAIT_SOURCE = 256
export const PORTRAIT_SLOT = 56

export function makePortraitSlot(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  element: Element,
  glyph: string,
  size: number = PORTRAIT_SLOT,
): Phaser.GameObjects.Container {
  const color = elementColor(element)

  const slot = scene.add.container(x, y)
  const bg = scene.add
    .rectangle(size / 2, size / 2, size, size, 0x000000, 0.3)
    .setRounded(8)
  const tint = scene.add
    .rectangle(size / 2, size / 2, size - 8, size - 8, 0x000000, 0)
    .setStrokeStyle(1, hexColor(color), 0.7)
    .setRounded(6)
  const text = uiText(scene, 0, 0, glyph, { size: 'lg', color, family: 'display', align: 'center' })
  text.setOrigin(0.5).setPosition(size / 2, size / 2)

  slot.add([bg, tint, text])
  slot.setSize(size, size)
  if (parent) parent.add(slot)
  return slot
}
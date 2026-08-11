/**
 * Reusable UI widgets built on Phaser GameObjects. All styling comes from
 * `theme.ts` — no hardcoded colors or sizes here.
 *
 * Coordinate conventions:
 * - widgets are anchored top-left unless noted;
 * - every widget accepts an optional `parent` container: when given,
 *   coordinates are relative to that container and the widget is added to it.
 */

import Phaser from 'phaser'
import { THEME, hexColor, colorHex } from './theme'

export interface UiTextOpts {
  size?: keyof typeof THEME.fonts.size
  color?: string | number
  align?: Phaser.Types.GameObjects.Text.TextStyle['align']
  wordWrap?: number
}

export function uiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  opts: UiTextOpts = {},
  parent?: Phaser.GameObjects.Container,
): Phaser.GameObjects.Text {
  const color =
    opts.color === undefined
      ? THEME.colors.text
      : typeof opts.color === 'number'
        ? colorHex(opts.color)
        : opts.color
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: THEME.fonts.family,
    fontSize: `${THEME.fonts.size[opts.size ?? 'md']}px`,
    color,
  }
  if (opts.align) style.align = opts.align
  if (opts.wordWrap) style.wordWrap = { width: opts.wordWrap }
  const text = scene.add.text(x, y, str, style)
  if (parent) parent.add(text)
  return text
}

/** A rounded panel frame: filled background + border. Top-left anchored. */
export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fillColor?: number; fillAlpha?: number } = {},
  parent?: Phaser.GameObjects.Container,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)
  const bg = scene.add
    .rectangle(w / 2, h / 2, w, h, opts.fillColor ?? THEME.colors.panel, opts.fillAlpha ?? THEME.panel.alpha)
    .setRounded(10)
  const border = scene.add
    .rectangle(w / 2, h / 2, w, h, 0x000000, 0)
    .setStrokeStyle(THEME.panel.borderWidth, THEME.colors.border)
    .setRounded(10)
  container.add([bg, border])
  if (parent) parent.add(container)
  return container
}

/** A flat sub-panel drawn directly into a container (no nested container). */
export function makeSubpanel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fillColor?: number; strokeColor?: number } = {},
): void {
  const bg = scene.add
    .rectangle(x + w / 2, y + h / 2, w, h, opts.fillColor ?? THEME.colors.panelAlt, 0.6)
    .setRounded(8)
  const border = scene.add
    .rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0)
    .setStrokeStyle(1, opts.strokeColor ?? THEME.colors.border)
    .setRounded(8)
  parent.add([bg, border])
}

export interface Button {
  container: Phaser.GameObjects.Container
  setDisabled(disabled: boolean): void
  destroy(): void
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: {
    width?: number
    height?: number
    color?: number
    labelColor?: string
    fontSize?: keyof typeof THEME.fonts.size
  } = {},
  parent?: Phaser.GameObjects.Container,
): Button {
  const width = opts.width ?? THEME.button.width
  const height = opts.height ?? THEME.button.height
  const baseColor = opts.color ?? THEME.colors.accent
  const labelColor = opts.labelColor ?? THEME.colors.textOnAccent
  const fontSize = opts.fontSize ?? 'sm'

  const container = scene.add.container(x, y)
  const rect = scene.add.rectangle(width / 2, height / 2, width, height, baseColor).setRounded(THEME.button.radius)
  const text = uiText(scene, 0, 0, label, { size: fontSize, color: labelColor, align: 'center' })
  text.setOrigin(0.5, 0.5).setPosition(width / 2, height / 2)

  container.add([rect, text])
  if (parent) parent.add(container)

  let disabled = false

  function applyDisabled(): void {
    if (disabled) {
      rect.setFillStyle(THEME.colors.disabled)
      text.setColor(THEME.colors.textDim)
      rect.disableInteractive()
    } else {
      rect.setFillStyle(baseColor)
      text.setColor(labelColor)
      rect.setInteractive({ useHandCursor: true })
    }
  }

  rect
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => {
      if (!disabled) rect.setFillStyle(THEME.colors.hover)
    })
    .on('pointerout', () => {
      if (!disabled) rect.setFillStyle(baseColor)
    })
    .on('pointerdown', () => {
      if (!disabled) onClick()
    })

  applyDisabled()

  return {
    container,
    setDisabled(value: boolean) {
      disabled = value
      applyDisabled()
    },
    destroy() {
      container.destroy(true)
    },
  }
}

/** A small pill-shaped label (durability badges, rarity tags, etc.). */
export function makeBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: string,
  opts: { width?: number; height?: number; size?: keyof typeof THEME.fonts.size } = {},
  parent?: Phaser.GameObjects.Container,
): Phaser.GameObjects.Container {
  const width = opts.width ?? 96
  const height = opts.height ?? 20
  const container = scene.add.container(x, y)
  const bg = scene.add
    .rectangle(width / 2, height / 2, width, height, 0x000000, 0.25)
    .setStrokeStyle(1, hexColor(color))
    .setRounded(height / 2)
  const text = uiText(scene, 0, 0, label, { size: opts.size ?? 'xs', color })
  text.setOrigin(0.5, 0.5).setPosition(width / 2, height / 2)
  container.add([bg, text])
  if (parent) parent.add(container)
  return container
}

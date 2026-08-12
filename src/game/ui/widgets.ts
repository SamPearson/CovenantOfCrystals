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
import { roundedFaceTextureKey } from './textures'

export interface UiTextOpts {
  size?: keyof typeof THEME.fonts.size
  color?: string | number
  align?: Phaser.Types.GameObjects.Text.TextStyle['align']
  wordWrap?: number
  /** 'display' for ornate serif titles, 'body' (default) for content. */
  family?: 'display' | 'body'
  letterSpacing?: number
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
    fontFamily: THEME.fonts[opts.family ?? 'body'],
    fontSize: `${THEME.fonts.size[opts.size ?? 'md']}px`,
    color,
  }
  if (opts.align) style.align = opts.align
  if (opts.wordWrap) style.wordWrap = { width: opts.wordWrap }
  const text = scene.add.text(x, y, str, style)
  if (opts.letterSpacing !== undefined) text.setLetterSpacing(opts.letterSpacing)
  if (parent) parent.add(text)
  return text
}

/**
 * A carved stone panel frame: drop shadow, dark outer frame, a textured stone
 * face (rounded-masked), a bone inner edge, and diamond studs at the corners.
 * Top-left anchored.
 */
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
  const t = THEME.colors
  const { radius, inset } = THEME.panel
  const cx = w / 2
  const cy = h / 2
  const fillColor = opts.fillColor ?? t.panel
  const fillAlpha = opts.fillAlpha ?? THEME.panel.alpha

  const shadow = scene.add.rectangle(cx, cy + 2, w, h, 0x000000, 0.3).setRounded(radius + 2)
  const frame = scene.add.rectangle(cx, cy, w, h, fillColor, fillAlpha).setRounded(radius)
  const frameBorder = scene.add
    .rectangle(cx, cy, w, h, 0x000000, 0)
    .setStrokeStyle(THEME.panel.borderWidth, t.border)
    .setRounded(radius)

  const faceW = w - inset * 2
  const faceH = h - inset * 2
  const faceKey = roundedFaceTextureKey(scene, faceW, faceH, Math.max(2, radius - 2))
  const face = scene.add.image(cx, cy, faceKey)

  const innerEdge = scene.add
    .rectangle(cx, cy, faceW, faceH, 0x000000, 0)
    .setStrokeStyle(1, t.borderLight, 0.5)
    .setRounded(Math.max(2, radius - 2))

  container.add([shadow, frame, frameBorder, face, innerEdge])

  const stud = 3
  const sx = w / 2 - 9
  const sy = h / 2 - 9
  for (const [px, py] of [
    [-sx, -sy],
    [sx, -sy],
    [-sx, sy],
    [sx, sy],
  ]) {
    const s = scene.add.rectangle(cx + px, cy + py, stud * 2, stud * 2, t.borderLight, 0.9).setRotation(Math.PI / 4)
    container.add(s)
  }

  if (parent) parent.add(container)
  return container
}

/** A carved inset well drawn directly into a container (no nested container). */
export function makeSubpanel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fillColor?: number; strokeColor?: number } = {},
): void {
  const t = THEME.colors
  const radius = 4
  const bg = scene.add
    .rectangle(x + w / 2, y + h / 2, w, h, opts.fillColor ?? t.panelAlt, 0.92)
    .setRounded(radius)
  const border = scene.add
    .rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0)
    .setStrokeStyle(1, opts.strokeColor ?? t.border)
    .setRounded(radius)
  const highlight = scene.add.rectangle(x + w / 2, y + 1.5, w - 10, 1, t.borderLight, 0.16)
  parent.add([bg, border, highlight])
}

export interface Button {
  container: Phaser.GameObjects.Container
  setDisabled(disabled: boolean): void
  destroy(): void
}

/** A raised stone plaque button with a bone edge. */
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
  const border = scene.add
    .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
    .setStrokeStyle(1, THEME.colors.borderLight, 0.6)
    .setRounded(THEME.button.radius)
  const text = uiText(scene, 0, 0, label, { size: fontSize, color: labelColor, family: 'display', align: 'center' })
  text.setOrigin(0.5, 0.5).setPosition(width / 2, height / 2)

  container.add([rect, border, text])
  if (parent) parent.add(container)

  let disabled = false

  function applyDisabled(): void {
    if (disabled) {
      rect.setFillStyle(THEME.colors.disabled)
      text.setColor(THEME.colors.textDim)
      border.setStrokeStyle(1, THEME.colors.border, 0.4)
      rect.disableInteractive()
    } else {
      rect.setFillStyle(baseColor)
      text.setColor(labelColor)
      border.setStrokeStyle(1, THEME.colors.borderLight, 0.6)
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
  const height = opts.height ?? 20
  const text = uiText(scene, 0, 0, label, { size: opts.size ?? 'xs', color })
  const width = opts.width ?? Math.ceil(text.width) + 20
  const container = scene.add.container(x, y)
  const bg = scene.add
    .rectangle(width / 2, height / 2, width, height, 0x000000, 0.25)
    .setStrokeStyle(1, hexColor(color))
    .setRounded(height / 2)
  text.setOrigin(0.5, 0.5).setPosition(width / 2, height / 2)
  container.add([bg, text])
  container.setSize(width, height)
  if (parent) parent.add(container)
  return container
}

export interface ScrollRegion {
  /** Top-left anchored container positioned at (x, y) in the parent. */
  container: Phaser.GameObjects.Container
  /** Scrolling content — add children here. Non-interactive; it is drawn into the viewport texture. */
  content: Phaser.GameObjects.Container
  /** Tells the region the full height of its content so it can clamp + size the thumb. */
  setContentHeight(height: number): void
  destroy(): void
}

/**
 * A scrollable, wheel+drag-aware viewport. Content children are rendered into a
 * DynamicTexture the exact size of the viewport, so anything outside the region
 * is hard-clipped by the texture bounds in both WebGL and Canvas (Phaser's
 * geometry masks are WebGL-unsupported, so they can't be relied on). The
 * `content` container is kept in the tree but invisible — it exists only as the
 * redraw source, which is why its children must be non-interactive.
 * `setContentHeight` must be called once the content has been built.
 */
export function makeScrollRegion(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fillColor?: number; strokeColor?: number } = {},
): ScrollRegion {
  const t = THEME.colors
  const container = scene.add.container(x, y)
  if (parent) parent.add(container)
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.textures.remove(texKey)
  })

  const bg = scene.add
    .rectangle(w / 2, h / 2, w, h, opts.fillColor ?? t.panelAlt, 0.92)
    .setStrokeStyle(1, opts.strokeColor ?? t.border)
    .setRounded(4)
  const highlight = scene.add.rectangle(w / 2, 1.5, w - 10, 1, t.borderLight, 0.16)

  const texKey = `scroll-${Math.random().toString(36).slice(2, 9)}`
  const tex = scene.textures.addDynamicTexture(texKey, w, h)!
  const image = scene.add.image(0, 0, texKey).setOrigin(0, 0)

  const content = scene.add.container(0, 0)
  content.visible = false
  container.add([bg, highlight, image, content])

  const trackX = w - 8
  const track = scene.add.rectangle(trackX, h / 2, 4, h - 10, 0x000000, 0.35)
  const thumb = scene.add.rectangle(trackX, 4, 4, h - 10, t.borderLight, 0.85)
  container.add([track, thumb])

  let scrollY = 0
  let contentH = h

  function redraw(): void {
    tex.clear()
    tex.draw(content)
    tex.render()
  }

  function clampY(value: number): number {
    const maxScroll = Math.max(0, contentH - h)
    return Phaser.Math.Clamp(value, -maxScroll, 0)
  }

  function refreshThumb(): void {
    const maxScroll = contentH - h
    const show = maxScroll > 0
    track.setVisible(show)
    thumb.setVisible(show)
    if (!show) return
    const trackLen = h - 10
    const thumbH = Math.min(trackLen, Math.max(14, (h / contentH) * trackLen))
    thumb.setDisplaySize(4, thumbH)
    // The thumb is centered (origin 0.5, 0.5), so position by its top edge.
    const thumbTop = 5 + (-scrollY / maxScroll) * (trackLen - thumbH)
    thumb.y = thumbTop + thumbH / 2
  }

  function applyScroll(): void {
    content.y = scrollY
    redraw()
    refreshThumb()
  }

  function setScroll(value: number): void {
    scrollY = clampY(value)
    applyScroll()
  }

  let dragStartY = 0
  let dragStartScroll = 0
  bg.setInteractive({ useHandCursor: false, draggable: true })
  bg.on(
    'wheel',
    (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number) => {
      setScroll(scrollY - deltaY)
    },
  )
  bg.on('dragstart', (pointer: Phaser.Input.Pointer) => {
    dragStartY = pointer.y
    dragStartScroll = scrollY
  })
  bg.on('drag', (pointer: Phaser.Input.Pointer) => {
    setScroll(dragStartScroll + (pointer.y - dragStartY))
  })

  return {
    container,
    content,
    setContentHeight(height: number) {
      contentH = height
      setScroll(scrollY)
    },
    destroy() {
      container.destroy(true)
      scene.textures.remove(texKey)
    },
  }
}

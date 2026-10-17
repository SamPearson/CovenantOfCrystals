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
  /** The interactive click surface — handy for hover/tooltip wiring. */
  hit: Phaser.GameObjects.Rectangle
  setDisabled(disabled: boolean): void
  /** Swap the caption in place (e.g. a Fullscreen / Exit Fullscreen toggle). */
  setLabel(label: string): void
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
    } else {
      rect.setFillStyle(baseColor)
      text.setColor(labelColor)
      border.setStrokeStyle(1, THEME.colors.borderLight, 0.6)
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
    hit: rect,
    setDisabled(value: boolean) {
      disabled = value
      applyDisabled()
    },
    setLabel(value: string) {
      text.setText(value)
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

export interface Checkbox {
  container: Phaser.GameObjects.Container
  setChecked(value: boolean): void
  destroy(): void
}

/**
 * A clickable checkbox row (box + label). `onChange` fires on every toggle with
 * the new checked state. Used by the Phase 4 M4 auto-advance stop-point dialog.
 */
export function makeCheckbox(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
  opts: { width?: number; height?: number } = {},
  parent?: Phaser.GameObjects.Container,
): Checkbox {
  const height = opts.height ?? 28
  const container = scene.add.container(x, y)
  const t = THEME.colors

  const boxSize = 18
  const boxX = boxSize / 2 + 2
  const box = scene.add
    .rectangle(boxX, height / 2, boxSize, boxSize, 0x000000, 0.3)
    .setStrokeStyle(1, t.borderLight, 0.8)
    .setRounded(3)
  const tick = uiText(scene, 0, 0, '✓', { size: 'sm', color: t.good, family: 'display' })
    .setOrigin(0.5)
    .setPosition(boxX, height / 2)
    .setVisible(checked)
  const text = uiText(scene, boxSize + 10, 0, label, { size: 'sm', color: t.text }, container)
  text.y = (height - text.height) / 2

  container.add([box, tick, text])

  let isChecked = checked
  function apply(): void {
    tick.setVisible(isChecked)
  }

  function toggle(): void {
    isChecked = !isChecked
    apply()
    onChange(isChecked)
  }

  box.setInteractive({ useHandCursor: true }).on('pointerdown', toggle)
  text.setInteractive({ useHandCursor: true }).on('pointerdown', toggle)

  if (parent) parent.add(container)

  return {
    container,
    setChecked(value: boolean) {
      isChecked = value
      apply()
    },
    destroy() {
      container.destroy(true)
    },
  }
}

export interface ScrollRegion {
  /** Top-left anchored container positioned at (x, y) in the parent. */
  container: Phaser.GameObjects.Container
  /** Scrolling content — add children here. Non-interactive; it is drawn into the viewport texture. */
  content: Phaser.GameObjects.Container
  /** Tells the region the full height of its content so it can clamp + size the thumb. */
  setContentHeight(height: number): void
  /**
   * Interactive transparent rect covering the viewport (top stack of `container`).
   * Content children are baked into the viewport texture and never receive pointer
   * events, so hover tooltips listen here and map positions with `worldToContentY`.
   */
  layer: Phaser.GameObjects.Rectangle
  /** Current vertical scroll offset (0 at top, negative when scrolled down). */
  scrollOffset(): number
  /** Maps a world-space Y to content-space Y (i.e. before scrolling is applied). */
  worldToContentY(worldY: number): number
  destroy(): void
}

/**
 * A scrollable, wheel+drag-aware viewport.
 *
 * - Non-interactive mode (default): Content rendered to DynamicTexture for hard
 *   clipping in WebGL/Canvas. Children must be non-interactive.
 * - Interactive mode: Content is rendered to DynamicTexture for visual clipping,
 *   but a separate visible container handles input. Clicks are manually delegated
 *   to buttons via hit-testing. This works in both WebGL and Canvas.
 *
 * `setContentHeight` must be called once the content has been built.
 */
export function makeScrollRegion(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fillColor?: number; strokeColor?: number; interactive?: boolean } = {},
): ScrollRegion {
  const t = THEME.colors
  const interactive = opts.interactive ?? false
  const container = scene.add.container(x, y)
  if (parent) parent.add(container)

  const bg = scene.add
    .rectangle(w / 2, h / 2, w, h, opts.fillColor ?? t.panelAlt, 0.92)
    .setStrokeStyle(1, opts.strokeColor ?? t.border)
    .setRounded(4)
  const highlight = scene.add.rectangle(w / 2, 1.5, w - 10, 1, t.borderLight, 0.16)

  // Content container for rendering (invisible, used as texture source)
  const content = scene.add.container(0, 0)
  content.visible = false

  // For interactive mode, we need a visible container for input handling
  // This container mirrors the content but is used for hit detection
  const inputContent = interactive ? scene.add.container(0, 0) : content

  const texKey = `scroll-${Math.random().toString(36).slice(2, 9)}`
  const tex = scene.textures.addDynamicTexture(texKey, w, h)!
  const image = scene.add.image(0, 0, texKey).setOrigin(0, 0)

  container.add([bg, highlight, image, inputContent, content])
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.textures.remove(texKey)
  })

  const trackX = w - 8
  const track = scene.add.rectangle(trackX, h / 2, 4, h - 10, 0x000000, 0.35)
  const thumb = scene.add.rectangle(trackX, 4, 4, h - 10, t.borderLight, 0.85)
  container.add([track, thumb])

  // Hit surface for all input (wheel, drag, click delegation)
  const layer = scene.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0, 0)
  container.add(layer)

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
    const thumbTop = 5 + (-scrollY / maxScroll) * (trackLen - thumbH)
    thumb.y = thumbTop + thumbH / 2
  }

  function applyScroll(): void {
    content.y = scrollY
    if (interactive) inputContent.y = scrollY
    redraw()
    refreshThumb()
  }

  function setScroll(value: number): void {
    scrollY = clampY(value)
    applyScroll()
  }

  // Find the topmost interactive button-like object in inputContent at world position
  function findButtonAt(worldX: number, worldY: number): Phaser.GameObjects.GameObject | null {
    if (!interactive) return null

    // Recursively search for interactive objects in inputContent's children
    function searchInteractive(obj: Phaser.GameObjects.GameObject): Phaser.GameObjects.GameObject | null {
      // Check if this object itself is interactive
      if (obj.input && obj.input.enabled) {
        const hitArea = obj.input.hitArea
        if (hitArea) {
          // Convert to the object's local coordinates
          const objWorldMatrix = (obj as Phaser.GameObjects.Rectangle).getWorldTransformMatrix()
          const objLocalPt = objWorldMatrix.applyInverse(worldX, worldY, new Phaser.Math.Vector2())
          if (hitArea.contains(objLocalPt.x, objLocalPt.y)) {
            return obj
          }
        }
      }
      // If it's a container, search its children
      if (obj instanceof Phaser.GameObjects.Container) {
        const children = obj.getAll()
        for (let i = children.length - 1; i >= 0; i--) {
          const found = searchInteractive(children[i])
          if (found) return found
        }
      }
      return null
    }

    const children = inputContent.getAll()
    for (let i = children.length - 1; i >= 0; i--) {
      const found = searchInteractive(children[i])
      if (found) return found
    }
    return null
  }

  // Wheel handling on layer
  layer.setInteractive({ useHandCursor: false })
  layer.on(
    'wheel',
    (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number) => {
      setScroll(scrollY - deltaY)
    },
  )

  // Click delegation + drag scrolling on layer
  let dragStartY = 0
  let dragStartScroll = 0
  let isDragging = false
  let clickTarget: Phaser.GameObjects.GameObject | null = null

  layer.setInteractive({ draggable: false })

  layer.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    const btn = findButtonAt(pointer.worldX, pointer.worldY)
    if (btn) {
      // Click is on a button - delegate click, don't start drag
      clickTarget = btn
      // Fire the button's pointerdown so it gets visual feedback
      btn.emit('pointerdown', pointer)
      return
    }
    // Click is on empty space - start drag scroll
    isDragging = true
    dragStartY = pointer.y
    dragStartScroll = scrollY
  })

  layer.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (isDragging) {
      setScroll(dragStartScroll + (pointer.y - dragStartY))
    } else if (clickTarget) {
      // Check if pointer moved off the button (cancel click)
      const btn = findButtonAt(pointer.worldX, pointer.worldY)
      if (btn !== clickTarget) {
        clickTarget.emit('pointerout', pointer)
        clickTarget = null
      }
    }
  })

  layer.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (clickTarget) {
      // Complete the click on the button
      clickTarget.emit('pointerup', pointer)
      clickTarget = null
    }
    isDragging = false
  })

  layer.on('pointerout', (pointer: Phaser.Input.Pointer) => {
    if (clickTarget) {
      clickTarget.emit('pointerout', pointer)
      clickTarget = null
    }
    isDragging = false
  })

  const topY = (): number => image.getWorldTransformMatrix().getY(0, 0)

  return {
    container,
    content: interactive ? inputContent : content,
    layer,
    scrollOffset(): number {
      return scrollY
    },
    worldToContentY(worldY: number): number {
      return worldY - topY() - scrollY
    },
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

/**
 * A dropdown menu button that opens a list of options on click.
 * Clicking outside closes it.
 */
export interface Dropdown {
  container: Phaser.GameObjects.Container
  /** The main button element. */
  button: Phaser.GameObjects.Container
  /** Set disabled state. */
  setDisabled(disabled: boolean): void
  /** Change the button label. */
  setLabel(label: string): void
  /** Set the options and their handlers. */
  setOptions(options: DropdownOption[]): void
  destroy(): void
}

export interface DropdownOption {
  label: string
  onClick: () => void
  disabled?: boolean
  color?: number
  divider?: boolean
}

export function makeDropdown(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  options: DropdownOption[],
  opts: {
    width?: number
    height?: number
    color?: number
    labelColor?: string
    fontSize?: keyof typeof THEME.fonts.size
    dropdownWidth?: number
  } = {},
  parent?: Phaser.GameObjects.Container,
): Dropdown {
  const width = opts.width ?? 120
  const height = opts.height ?? THEME.button.height
  const baseColor = opts.color ?? THEME.colors.accentBlue
  const labelColor = opts.labelColor ?? THEME.colors.textOnAccent
  const fontSize = opts.fontSize ?? 'sm'
  const dropdownWidth = opts.dropdownWidth ?? Math.max(width, 160)

  const container = scene.add.container(x, y)
  if (parent) parent.add(container)

  // Main button
  const buttonContainer = scene.add.container(0, 0)
  const rect = scene.add.rectangle(width / 2, height / 2, width, height, baseColor).setRounded(THEME.button.radius)
  const border = scene.add
    .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
    .setStrokeStyle(1, THEME.colors.borderLight, 0.6)
    .setRounded(THEME.button.radius)
  const text = uiText(scene, 0, 0, label, { size: fontSize, color: labelColor, family: 'display', align: 'center' })
  text.setOrigin(0.5, 0.5).setPosition(width / 2, height / 2)

  // Arrow indicator
  const arrow = uiText(scene, width - 18, height / 2, '▼', { size: 'xs', color: labelColor, family: 'display' })
  arrow.setOrigin(0.5, 0.5)

  buttonContainer.add([rect, border, text, arrow])
  container.add(buttonContainer)

  let disabled = false
  let isOpen = false
  let dropdownContainer: Phaser.GameObjects.Container | null = null
  let clickOutsideHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null

  function applyDisabled(): void {
    if (disabled) {
      rect.setFillStyle(THEME.colors.disabled)
      text.setColor(THEME.colors.textDim)
      border.setStrokeStyle(1, THEME.colors.border, 0.4)
      arrow.setColor(THEME.colors.textDim)
    } else {
      rect.setFillStyle(baseColor)
      text.setColor(labelColor)
      border.setStrokeStyle(1, THEME.colors.borderLight, 0.6)
      arrow.setColor(labelColor)
    }
  }

  function closeDropdown(): void {
    if (!isOpen) return
    isOpen = false
    if (dropdownContainer) {
      dropdownContainer.destroy(true)
      dropdownContainer = null
    }
    if (clickOutsideHandler) {
      scene.input.off('pointerdown', clickOutsideHandler)
      clickOutsideHandler = null
    }
    arrow.setText('▼')
  }

  function openDropdown(): void {
    if (isOpen || disabled || options.length === 0) return
    isOpen = true

    dropdownContainer = scene.add.container(0, height + 2)
    container.add(dropdownContainer)

    const itemHeight = 28
    const padding = 4
    const totalHeight = options.length * itemHeight + padding * 2

    // Background
    const bg = scene.add
      .rectangle(dropdownWidth / 2, totalHeight / 2, dropdownWidth, totalHeight, THEME.colors.panel)
      .setStrokeStyle(1, THEME.colors.border)
      .setRounded(4)
    dropdownContainer.add(bg)

    let itemY = padding
    for (const option of options) {
      if (option.divider) {
        const divider = scene.add.rectangle(dropdownWidth / 2, itemY + 4, dropdownWidth - 16, 1, THEME.colors.border, 0.5)
        dropdownContainer.add(divider)
        itemY += 10
        continue
      }

      const itemContainer = scene.add.container(0, itemY)
      const itemBg = scene.add
        .rectangle(dropdownWidth / 2, itemHeight / 2, dropdownWidth, itemHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: !option.disabled })
      const itemText = uiText(scene, 12, itemHeight / 2, option.label, {
        size: 'sm',
        color: option.disabled ? THEME.colors.textDim : THEME.colors.text,
      })
      itemContainer.add([itemBg, itemText])
      dropdownContainer.add(itemContainer)

      if (!option.disabled) {
        itemBg.on('pointerover', () => {
          itemBg.setFillStyle(THEME.colors.hover)
        })
        itemBg.on('pointerout', () => {
          itemBg.setFillStyle(0x000000, 0)
        })
        itemBg.on('pointerdown', () => {
          option.onClick()
          closeDropdown()
        })
      }
      itemY += itemHeight
    }

    // Close on click outside
    arrow.setText('▲')
    clickOutsideHandler = (pointer: Phaser.Input.Pointer): void => {
      if (dropdownContainer) {
        const bounds = dropdownContainer.getBounds()
        if (!bounds.contains(pointer.x, pointer.y)) {
          const btnBounds = buttonContainer.getBounds()
          if (!btnBounds.contains(pointer.x, pointer.y)) {
            closeDropdown()
          }
        }
      }
    }
    scene.input.on('pointerdown', clickOutsideHandler)
  }

  rect.setInteractive({ useHandCursor: true })
    .on('pointerover', () => {
      if (!disabled) rect.setFillStyle(THEME.colors.hover)
    })
    .on('pointerout', () => {
      if (!disabled) rect.setFillStyle(baseColor)
    })
    .on('pointerdown', () => {
      if (!disabled) {
        if (isOpen) closeDropdown()
        else openDropdown()
      }
    })

  applyDisabled()

  return {
    container,
    button: buttonContainer,
    setDisabled(value: boolean) {
      disabled = value
      applyDisabled()
      if (value) closeDropdown()
    },
    setLabel(value: string) {
      text.setText(value)
    },
    setOptions(value: DropdownOption[]) {
      options = value
      if (isOpen) {
        closeDropdown()
        openDropdown()
      }
    },
    destroy() {
      closeDropdown()
      container.destroy(true)
    },
  }
}

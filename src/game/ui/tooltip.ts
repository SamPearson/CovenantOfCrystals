/**
 * Tooltip rendering — the single stateless surface for the pure data strings
 * produced by `core/tooltips.ts`. One tooltip is visible per scene; hovering
 * a new target swaps the payload without leaking panels.
 *
 * Layout rules (spec §Renderer):
 * - one carved panel (like `makePanel`) sized to the wrapped content;
 * - side/top placement that flips to stay inside the camera view;
 * - a short hover delay so sweeping the pointer across a row of items doesn't
 *   flash tooltips;
 * - the tooltip is never interactive: it blocks neither clicks nor wheel.
 */

import Phaser from 'phaser'
import { THEME, colorHex } from './theme'
import { uiText, makeBadge, makePanel } from './widgets'
import type { TooltipLine, TooltipTone } from '../../core/tooltips'

/** All overlay/z-order constants for the game UI live here. */
export const DEPTHS = {
  tooltip: 900,
} as const

const TOOLTIP_MAX_WIDTH = 268
const TOOLTIP_DELAY = 150
const MARGIN = 10
const PANEL_PAD = 12
const LINE_GAP = 3

/** Maps the semantic tones used by the data layer onto theme colors. */
export function toneColor(tone: TooltipTone): string {
  const t = THEME.colors
  switch (tone) {
    case 'good':
      return t.good
    case 'warn':
      return t.warn
    case 'bad':
      return t.bad
    case 'muted':
      return t.textMuted
    case 'accent':
      return colorHex(THEME.colors.accentBlue)
    case 'gold':
      return colorHex(THEME.colors.gold)
    case 'rarity-common':
      return colorHex(THEME.rarity.common)
    case 'rarity-rare':
      return colorHex(THEME.rarity.rare)
    case 'rarity-epic':
      return colorHex(THEME.rarity.epic)
    case 'rarity-legendary':
      return colorHex(THEME.rarity.legendary)
    default:
      return t.text
  }
}

export interface TooltipHandle {
  container: Phaser.GameObjects.Container
  hide(): void
  destroy(): void
}

interface SceneTooltipState {
  handle: TooltipHandle | null
  timer: Phaser.Time.TimerEvent | null
}

const states = new WeakMap<Phaser.Scene, SceneTooltipState>()

function stateFor(scene: Phaser.Scene): SceneTooltipState {
  let s = states.get(scene)
  if (!s) {
    s = { handle: null, timer: null }
    states.set(scene, s)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      states.delete(scene)
    })
  }
  return s
}

interface TooltipOpts {
  /** Hover delay ms before the tooltip appears (default 150). */
  delay?: number
  /** Anchor point; defaults to the pointer position. */
  anchor?: { x: number; y: number }
}

/**
 * Immediate render at world coordinates. Builds a panel sized to the wrapped
 * payload text, placed beside `x, y` and flipped inside the camera view.
 */
export function showTooltip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  lines: TooltipLine[],
  opts: TooltipOpts = {},
): TooltipHandle {
  hideTooltip(scene)
  const state = stateFor(scene)
  const anchor = opts.anchor ?? { x: x + MARGIN, y: y + MARGIN }
  const handle = build(scene, anchor.x, anchor.y, lines)
  state.handle = handle
  return handle
}

export interface PointerTarget {
  on(event: string, fn: (pointer: Phaser.Input.Pointer) => void): unknown
  off?(event: string, fn: (pointer: Phaser.Input.Pointer) => void): unknown
}

/**
 * Attach hover behaviour to an interactive object. Shows the tooltip after
 * `delay` ms of the pointer resting on `target`, hides on pointer-out.
 * `payload` is re-queried every time it appears, so callers can reflect live
 * state (e.g. current MP cheapness) without rebuilding anything.
 */
export function attachTooltip(
  scene: Phaser.Scene,
  target: PointerTarget,
  payload: () => TooltipLine[],
  opts: TooltipOpts = {},
): void {
  const state = stateFor(scene)
  const delay = opts.delay ?? TOOLTIP_DELAY

  target.on('pointerover', (pointer: Phaser.Input.Pointer) => {
    if (state.timer) state.timer.remove(false)
    state.timer = scene.time.delayedCall(delay, () => {
      state.timer = null
      const lines = payload()
      if (lines.length === 0) return
      showTooltip(scene, pointer.worldX, pointer.worldY, lines, opts)
    })
  })

  target.on('pointerout', () => {
    if (state.timer) state.timer.remove(false)
    state.timer = null
    hideTooltip(scene)
  })
}

/** Hides (and destroys) the active tooltip for a scene. */
export function hideTooltip(scene: Phaser.Scene): void {
  const state = stateFor(scene)
  if (state.timer) {
    state.timer.remove(false)
    state.timer = null
  }
  if (state.handle) {
    state.handle.destroy()
    state.handle = null
  }
}

interface LineSpec {
  text: string
  size: keyof typeof THEME.fonts.size
  color: string
  family: 'display' | 'body'
  wrap: boolean
  align?: Phaser.Types.GameObjects.Text.TextStyle['align']
  /** Vertical space this line occupies (bg lines, dividers). */
  spacing?: number
  /** Render as a pill badge (rarity chips, element labels) instead of a plain line. */
  badge?: boolean
}

function lineSpec(line: TooltipLine): LineSpec {
  const t = THEME.colors
  switch (line.kind) {
    case 'title':
      return {
        text: line.text,
        size: 'lg',
        family: 'display',
        color: line.flare === 'rarity' ? colorHex(THEME.rarity.common) : colorHex(THEME.colors.accentDark),
        wrap: false,
      }
    case 'subtitle':
      return { text: line.text, size: 'xs', color: t.textMuted, family: 'body', wrap: true }
    case 'stat': {
      const delta = line.delta
      const color = delta >= 0 ? t.good : t.warn
      return {
        text: `${delta >= 0 ? '+' : ''}${delta} ${line.key.toUpperCase()}`,
        size: 'sm',
        color,
        family: 'body',
        wrap: true,
      }
    }
    case 'effect':
      return {
        text: line.text,
        size: 'sm',
        color: line.tone ? toneColor(line.tone) : t.good,
        family: 'body',
        wrap: true,
      }
    case 'label':
      return {
        text: line.text,
        size: 'sm',
        color: toneColor(line.tone),
        family: 'body',
        wrap: false,
        badge: true,
      }
    case 'divider':
      return { text: '', size: 'xs', color: t.text, family: 'body', wrap: false, spacing: 10 }
    case 'desc':
      return {
        text: line.text,
        size: 'sm',
        color: line.tone ? toneColor(line.tone) : t.text,
        family: 'body',
        wrap: true,
      }
    case 'source':
      return { text: line.text, size: 'xs', color: t.textDim, family: 'body', wrap: true }
  }
}

/** Creates the actual text object for a spec, in the given scene. */
function renderLine(scene: Phaser.Scene, spec: LineSpec): Phaser.GameObjects.Text | Phaser.GameObjects.Container {
  if (spec.badge) return makeBadge(scene, 0, 0, spec.text, spec.color, { size: spec.size })
  if (spec.text === '') return uiText(scene, 0, 0, '', { size: spec.size })
  const opts = {
    size: spec.size,
    color: spec.color,
    family: spec.family,
    align: spec.align,
    wordWrap: spec.wrap ? TOOLTIP_MAX_WIDTH : undefined,
  }
  return uiText(scene, 0, 0, spec.text, opts)
}

function build(scene: Phaser.Scene, x: number, y: number, lines: TooltipLine[]): TooltipHandle {
  const t = THEME.colors

  // --- Measure pass: size each line into a throwaway, then size the panel ---
  const specs = lines.map(lineSpec)
  const objects: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = []
  let maxW = 0
  let innerH = 0

  for (const spec of specs) {
    const obj = renderLine(scene, spec)
    objects.push(obj)
    maxW = Math.max(maxW, obj instanceof Phaser.GameObjects.Text ? obj.width : 0)
    innerH += spec.spacing ?? obj.height
    if (!spec.spacing) innerH += LINE_GAP
  }
  // cleanup throwaways — they are replaced by hand-placed siblings below
  for (const obj of objects) obj.destroy()

  const innerW = Math.max(maxW, 120)
  const panelW = innerW + PANEL_PAD * 2
  const panelH = innerH + PANEL_PAD * 2

  // --- Placement: flip inside the camera view ------------------------------
  const cam = scene.cameras.main
  const view = cam.worldView
  let px = x
  let py = y
  if (px + panelW > view.right - MARGIN) px = x - panelW - MARGIN
  if (px < view.left + MARGIN) px = view.left + MARGIN
  if (py + panelH > view.bottom - MARGIN) py = y - panelH - MARGIN
  if (py < view.top + MARGIN) py = view.top + MARGIN

  // --- Build -----------------------------------------------------------------
  const container = scene.add.container(px, py).setDepth(DEPTHS.tooltip)
  const panel = makePanel(scene, 0, 0, panelW, panelH, { fillColor: t.face, fillAlpha: 0.985 })
  container.add(panel)

  let yy = PANEL_PAD
  for (const spec of specs) {
    if (spec.spacing) {
      container.add(
        scene.add
          .rectangle(PANEL_PAD, yy + 4, innerW, 1, THEME.colors.borderLight, 0.7)
          .setOrigin(0),
      )
      yy += spec.spacing
      continue
    }
    const obj = renderLine(scene, spec)
    obj.setPosition(PANEL_PAD, yy)
    if (obj instanceof Phaser.GameObjects.Container) {
      // badges are centered on their origin; shift to a left-aligned top edge
      obj.setPosition(PANEL_PAD + (obj.width ?? 0) / 2, yy + (obj.height ?? 20) / 2)
    }
    container.add(obj)
    yy += (obj instanceof Phaser.GameObjects.Text ? obj.height : (obj.height ?? 20)) + LINE_GAP
  }

  // --- Lifecycle --------------------------------------------------------------
  const hideOnClick = () => hideTooltip(scene)
  scene.input.on('pointerdown', hideOnClick)

  const handle: TooltipHandle = {
    container,
    hide() {
      hideTooltip(scene)
    },
    destroy() {
      scene.input.off('pointerdown', hideOnClick)
      container.destroy(true)
    },
  }
  return handle
}
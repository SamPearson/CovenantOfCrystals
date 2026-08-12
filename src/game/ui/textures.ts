/**
 * Procedural stone textures for the carved-panel look.
 *
 * Generated at runtime from the active theme's colors and stored in the
 * Phaser texture manager. Nothing here is loaded from disk, so themes can stay
 * self-contained (and can regenerate textures if the theme ever switches).
 */

import Phaser from 'phaser'
import { THEME } from './theme'

/** Tiled grain used as a base for panel faces. */
export const STONE_FACE_KEY = 'stone-face'
/** Large, subtly vignetted background field. */
export const STONE_BG_KEY = 'stone-bg'

interface RGB {
  r: number
  g: number
  b: number
}

function toRGB(n: number): RGB {
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex(rgb: RGB): string {
  return `#${((rgb.r << 16) | (rgb.g << 8) | rgb.b).toString(16).padStart(6, '0')}`
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function shift(base: RGB, amount: number): RGB {
  return { r: clamp(base.r + amount), g: clamp(base.g + amount), b: clamp(base.b + amount) }
}

/** A small deterministic PRNG so textures are stable between sessions. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Speckled, stratified stone grain in the theme's face color. */
function buildFace(w: number, h: number, base: RGB): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(0xfa7eb0)
  const img = ctx.createImageData(w, h)
  const data = img.data
  for (let y = 0; y < h; y++) {
    // Sedimentary bands: a slow horizontal variation per row.
    const band = Math.round(Math.sin(y * 0.14 + 1.3) * 2.5) + Math.round(Math.sin(y * 0.41) * 1.5)
    for (let x = 0; x < w; x++) {
      let n = band
      if (rand() < 0.42) n += Math.round((rand() - 0.5) * 9)
      if (rand() < 0.03) n += Math.round((rand() - 0.5) * 26)
      const c = shift(base, n)
      const i = (y * w + x) * 4
      data[i] = c.r
      data[i + 1] = c.g
      data[i + 2] = c.b
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Deep background field with faint grain and a dark vignette toward the edges. */
function buildBg(w: number, h: number, base: RGB, vignette: RGB): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(0x5713c0)

  ctx.fillStyle = toHex(base)
  ctx.fillRect(0, 0, w, h)

  // Faint grain: composite sparse noise specks over the base fill.
  const speck = document.createElement('canvas')
  speck.width = w
  speck.height = h
  const sctx = speck.getContext('2d')!
  const img = sctx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    if (rand() < 0.08) {
      const n = Math.round((rand() - 0.5) * 6)
      const c = shift(base, n)
      img.data[i * 4] = c.r
      img.data[i * 4 + 1] = c.g
      img.data[i * 4 + 2] = c.b
      img.data[i * 4 + 3] = 255
    }
  }
  sctx.putImageData(img, 0, 0)
  ctx.drawImage(speck, 0, 0)

  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, toHex(vignette))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  return canvas
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

/**
 * A stone-face texture sized exactly for a panel face, with rounded corners
 * punched out (transparent). Cached per size so every panel of the same size
 * reuses one texture. Rounded corners are baked in so panels never need a
 * mask (which mis-renders inside containers in the Canvas renderer).
 */
export function roundedFaceTextureKey(scene: Phaser.Scene, w: number, h: number, radius: number): string {
  const key = `panel-face-${w}x${h}r${radius}`
  if (scene.textures.exists(key)) return key
  const canvas = buildFace(w, h, toRGB(THEME.colors.face))
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = '#fff'
  roundRectPath(ctx, 0, 0, w, h, radius)
  ctx.fill()
  ctx.restore()
  const tex = scene.textures.createCanvas(key, w, h)!
  tex.context.drawImage(canvas, 0, 0)
  tex.refresh()
  return key
}

/**
 * Generates the base stone textures for the active theme. Safe to call more
 * than once (existing textures are re-created with the current theme's colors).
 */
export function createStoneTextures(scene: Phaser.Scene): void {
  const c = THEME.colors
  if (scene.textures.exists(STONE_FACE_KEY)) scene.textures.remove(STONE_FACE_KEY)
  const face = scene.textures.createCanvas(STONE_FACE_KEY, 96, 96)!
  face.context.drawImage(buildFace(96, 96, toRGB(c.face)), 0, 0)
  face.refresh()

  if (scene.textures.exists(STONE_BG_KEY)) scene.textures.remove(STONE_BG_KEY)
  const bg = scene.textures.createCanvas(STONE_BG_KEY, 1024, 1024)!
  bg.context.drawImage(buildBg(1024, 1024, toRGB(c.bg), toRGB(c.bgVignette)), 0, 0)
  bg.refresh()
}

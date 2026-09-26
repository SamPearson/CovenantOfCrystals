/**
 * Fullscreen helpers — a thin wrapper over the browser Fullscreen API.
 *
 * Browsers only allow entering fullscreen from inside a user gesture, so this
 * can never be triggered automatically: the UI has to call `toggleFullscreen()`
 * from a click handler. Every call resolves to `false` instead of throwing when
 * the API is missing or the request is rejected (no gesture, or the user
 * dismissed the prompt), so callers can simply disable the control.
 *
 * The `<html>` element is what goes fullscreen rather than the game container:
 * the browser only paints the fullscreen element's subtree, and the Theme
 * Studio / Script Editor are DOM overlays that sit beside the canvas.
 */

/** Resolves the document, or null when there is no DOM (unit tests). */
function getDocument(): Document | null {
  return typeof document === 'undefined' ? null : document
}

/** True when the browser exposes the element Fullscreen API. */
export function isFullscreenSupported(): boolean {
  const doc = getDocument()
  return typeof doc?.documentElement?.requestFullscreen === 'function'
}

/** True while anything is fullscreen. */
export function isFullscreen(): boolean {
  return !!getDocument()?.fullscreenElement
}

/** Enters fullscreen. Resolves false when unsupported or the request was rejected. */
export async function enterFullscreen(): Promise<boolean> {
  const target = getDocument()?.documentElement
  if (!target || typeof target.requestFullscreen !== 'function') return false
  try {
    await target.requestFullscreen()
    return true
  } catch {
    return false
  }
}

/** Leaves fullscreen. Resolves false when not fullscreen, or the request was rejected. */
export async function exitFullscreen(): Promise<boolean> {
  const doc = getDocument()
  if (!doc?.fullscreenElement) return false
  try {
    await doc.exitFullscreen()
    return true
  } catch {
    return false
  }
}

/** Enters fullscreen when windowed, leaves it when fullscreen. Needs a user gesture. */
export async function toggleFullscreen(): Promise<boolean> {
  return isFullscreen() ? exitFullscreen() : enterFullscreen()
}

/**
 * Notifies on every fullscreen change, including the browser's own Esc key —
 * which is the only way to learn the user left fullscreen without our button.
 * Returns an unsubscribe function; scenes must call it on SHUTDOWN, since
 * Phaser 4 never invokes a custom `shutdown()` method.
 */
export function onFullscreenChange(listener: () => void): () => void {
  const doc = getDocument()
  if (!doc) return () => {}
  doc.addEventListener('fullscreenchange', listener)
  return () => doc.removeEventListener('fullscreenchange', listener)
}

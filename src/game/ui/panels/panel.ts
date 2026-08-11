import Phaser from 'phaser'
import { makePanel } from '../widgets'

export interface PanelRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Base class for a meta-UI panel. A panel owns a frame container plus a
 * `content` container drawn at local coordinates. `refresh()` rebuilds the
 * content from the current store state.
 */
export abstract class Panel {
  readonly container: Phaser.GameObjects.Container
  private content: Phaser.GameObjects.Container

  constructor(
    protected scene: Phaser.Scene,
    protected rect: PanelRect,
  ) {
    this.container = makePanel(scene, rect.x, rect.y, rect.w, rect.h)
    this.content = scene.add.container(0, 0)
    this.container.add(this.content)
  }

  abstract refresh(): void

  destroy(): void {
    this.container.destroy(true)
  }

  /** Destroys the previous content and returns a fresh container to build on. */
  protected rebuild(): Phaser.GameObjects.Container {
    this.content.destroy(true)
    this.content = this.scene.add.container(0, 0)
    this.container.add(this.content)
    return this.content
  }
}

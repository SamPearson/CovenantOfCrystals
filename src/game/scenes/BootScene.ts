import Phaser from 'phaser'
import { THEME, colorHex, setTheme } from '../ui/theme'
import { initThemes, getActiveTheme } from '../../core/themes'
import { createStoneTextures, STONE_BG_KEY } from '../ui/textures'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create(): void {
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    initThemes()
    setTheme(getActiveTheme())
    createStoneTextures(this)
    this.add.rectangle(0, 0, width, height, THEME.colors.bg).setOrigin(0)
    this.add.image(cx, cy, STONE_BG_KEY).setOrigin(0.5)

    this.add
      .text(cx, cy - 40, 'Covenant of Crystals', {
        fontFamily: THEME.fonts.display,
        fontSize: '56px',
        color: colorHex(THEME.colors.gold),
      })
      .setOrigin(0.5)

    this.add
      .text(cx, cy + 14, 'Loading…', {
        fontFamily: THEME.fonts.body,
        fontSize: '18px',
        color: colorHex(THEME.colors.borderLight),
      })
      .setOrigin(0.5)

    // Wait for the webfonts (serif display/body) to be ready so Phaser
    // measures text correctly. Race it against a real-time fallback so the
    // game can never stall on a slow or blocked fonts request.
    const start = (): void => {
      this.time.delayedCall(500, () => this.scene.start('MetaScene'))
    }
    if (document.fonts && document.fonts.ready) {
      let done = false
      const go = (): void => {
        if (done) return
        done = true
        start()
      }
      document.fonts.ready.then(go, go)
      setTimeout(go, 2500)
    } else {
      start()
    }
  }
}

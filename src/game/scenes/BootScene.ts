import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create(): void {
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    this.add
      .text(cx, cy - 40, 'HTML5 Game Demo', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#e0e0e0',
      })
      .setOrigin(0.5)

    this.add
      .text(cx, cy + 10, 'Phase 0 scaffold — Phaser 4 + Vite + TypeScript', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#8a8ab8',
      })
      .setOrigin(0.5)
  }
}

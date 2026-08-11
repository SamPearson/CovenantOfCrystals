import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'

export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540

export function startGame(parent: string | HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#141428',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene],
  })
}

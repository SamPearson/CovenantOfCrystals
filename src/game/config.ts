import Phaser from 'phaser'
import { THEME, colorHex } from './ui/theme'
import { BootScene } from './scenes/BootScene'
import { MetaScene } from './scenes/MetaScene'
import { BattleScene } from './scenes/BattleScene'
import { RunScene } from './scenes/RunScene'

export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540

export function startGame(parent: string | HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: colorHex(THEME.colors.bg),
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MetaScene, BattleScene, RunScene],
  })
}

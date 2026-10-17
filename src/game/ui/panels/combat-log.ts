/**
 * Combat Log Panel — detailed battle log with Simple/Advanced toggle.
 * Uses structured entries from BattleLogger (damage/heal/speed math).
 */

import Phaser from 'phaser'
import { THEME, hexColor } from '../theme'
import { uiText, makePanel, makeButton, makeScrollRegion } from '../widgets'
import type { ScrollRegion } from '../widgets'
import type { BattleLogEntry, DamageMath, HealMath, SpeedMath } from '../../../core/types'

interface CombatLogConfig {
  scene: Phaser.Scene
  parent: Phaser.GameObjects.Container
  x: number
  y: number
  width: number
  height: number
  entries: BattleLogEntry[]
  onClose: () => void
}

export class CombatLogPanel {
  container: Phaser.GameObjects.Container
  private scrollRegion!: ScrollRegion
  private entries: BattleLogEntry[]
  private mode: 'simple' | 'advanced' = 'simple'
  private modeBadge: Phaser.GameObjects.Container | null = null

  constructor(config: CombatLogConfig) {
    this.entries = config.entries

    // Outer panel
    this.container = config.scene.add.container(config.x, config.y)
    config.parent.add(this.container)

    makePanel(config.scene, 0, 0, config.width, config.height, {}, this.container)

    // Header
    uiText(config.scene, 16, 12, 'Combat Log', {
      size: 'lg',
      color: THEME.colors.gold,
      family: 'display',
    }, this.container)

    // Simple/Advanced toggle
    this.createModeToggle(config.scene, config.width - 16 - 120, 16)

    // Close button
    makeButton(config.scene, config.width - 16 - 80, config.height - 44, 'Close', () => {
      config.onClose()
    }, { width: 80, height: 32, fontSize: 'sm' }, this.container)

    // Scroll region
    const scrollH = config.height - 56
    this.scrollRegion = makeScrollRegion(config.scene, this.container, 8, 44, config.width - 16, scrollH, {
      fillColor: THEME.colors.face,
      strokeColor: THEME.colors.border,
    })

    this.render()
  }

  private createModeToggle(scene: Phaser.Scene, x: number, y: number): void {
    const toggleContainer = scene.add.container(x, y)
    this.container.add(toggleContainer)

    const simpleBtn = makeButton(scene, 0, 0, 'Simple', () => this.setMode('simple'), {
      width: 60,
      height: 24,
      fontSize: 'xs',
      color: this.mode === 'simple' ? THEME.colors.accent : THEME.colors.panel,
      labelColor: this.mode === 'simple' ? THEME.colors.textOnAccent : THEME.colors.textMuted,
    }, toggleContainer)

    const advBtn = makeButton(scene, 66, 0, 'Advanced', () => this.setMode('advanced'), {
      width: 70,
      height: 24,
      fontSize: 'xs',
      color: this.mode === 'advanced' ? THEME.colors.accent : THEME.colors.panel,
      labelColor: this.mode === 'advanced' ? THEME.colors.textOnAccent : THEME.colors.textMuted,
    }, toggleContainer)

    this.modeBadge = toggleContainer
    // Store button refs for updating
    ;(toggleContainer as any).simpleBtn = simpleBtn
    ;(toggleContainer as any).advBtn = advBtn
  }

  private setMode(mode: 'simple' | 'advanced'): void {
    this.mode = mode
    const tc = this.modeBadge as any
    if (tc?.simpleBtn && tc?.advBtn) {
      tc.simpleBtn.container.list[0].setFillStyle(
        mode === 'simple' ? THEME.colors.accent : THEME.colors.panel
      )
      tc.simpleBtn.container.list[2].setColor(
        mode === 'simple' ? THEME.colors.textOnAccent : THEME.colors.textMuted
      )
      tc.advBtn.container.list[0].setFillStyle(
        mode === 'advanced' ? THEME.colors.accent : THEME.colors.panel
      )
      tc.advBtn.container.list[2].setColor(
        mode === 'advanced' ? THEME.colors.textOnAccent : THEME.colors.textMuted
      )
    }
    this.render()
  }

  private render(): void {
    this.scrollRegion.content.removeAll(true)
    let y = 8

    for (const entry of this.entries) {
      const rowH = this.renderEntry(entry, y)
      y += rowH + 6
    }

    this.scrollRegion.setContentHeight(y + 8)
  }

  private renderEntry(entry: BattleLogEntry, y: number): number {
    const { scene } = this.scrollRegion.content
    const startY = y
    const pad = 8
    const innerW = this.scrollRegion.container.width - pad * 2 - 8 // minus scrollbar

    // Turn marker + simple text
    const simpleText = `${entry.turn > 0 ? `T${entry.turn} ` : ''}${entry.simple || entry.text}`
    const simple = uiText(scene, pad, y, simpleText, {
      size: 'xs',
      color: THEME.colors.text,
      wordWrap: innerW,
    }, this.scrollRegion.content)
    y += simple.height + 2

    // Advanced details
    if (this.mode === 'advanced') {
      if (entry.damageMath) {
        y = this.renderDamageMath(entry.damageMath, y, pad, innerW)
      }
      if (entry.healMath) {
        y = this.renderHealMath(entry.healMath, y, pad, innerW)
      }
      if (entry.speedMath) {
        y = this.renderSpeedMath(entry.speedMath, y, pad, innerW)
      }
      if (entry.advanced && entry.advanced !== entry.simple) {
        const adv = uiText(scene, pad, y, entry.advanced, {
          size: 'xs',
          color: THEME.colors.textMuted,
          wordWrap: innerW,
        }, this.scrollRegion.content)
        y += adv.height + 2
      }
    }

    // Separator line
    const g = scene.add.graphics()
    g.lineStyle(1, THEME.colors.border, 0.3)
    g.beginPath()
    g.moveTo(pad, y + 2)
    g.lineTo(pad + innerW, y + 2)
    g.strokePath()
    this.scrollRegion.content.add(g)
    y += 6

    return y - startY
  }

  private renderDamageMath(math: DamageMath, y: number, pad: number, innerW: number): number {
    const { scene } = this.scrollRegion.content

    // Damage formula breakdown
    const parts = [
      `base ${math.base}`,
      `ATK ${math.atkStat} / DEF ${math.defStat} = ${math.ratio.toFixed(2)}`,
    ]
    if (math.elementMult !== 1) parts.push(`elem x${math.elementMult.toFixed(2)}`)
    if (math.defendMult !== 1) parts.push(`defend x${math.defendMult}`)
    parts.push(`variance x${math.varianceMult.toFixed(2)}`)
    if (math.critMult !== 1) parts.push(`CRIT x${math.critMult}`)
    parts.push(`= ${math.final}`)

    const formula = parts.join(' → ')
    const text = uiText(scene, pad + 8, y, formula, {
      size: 'xs',
      color: THEME.colors.accentBlue,
      wordWrap: innerW - 16,
    }, this.scrollRegion.content)
    y += text.height + 2

    // Visual bar showing contribution
    const total = math.final
    if (total > 0) {
      const barW = innerW - 16
      const barH = 4
      const g = scene.add.graphics()
      let curX = 0

      // Base ratio segment
      const ratioVal = Math.round(math.ratio)
      const ratioW = Math.max(2, (ratioVal / total) * barW)
      g.fillStyle(hexColor(THEME.colors.text), 0.6)
      g.fillRect(pad + 8 + curX, y, ratioW, barH)
      curX += ratioW

      // Element
      if (math.elementMult !== 1) {
        const elemW = Math.max(2, ((ratioVal * (math.elementMult - 1)) / total) * barW)
        g.fillStyle(THEME.colors.gold, 0.7)
        g.fillRect(pad + 8 + curX, y, elemW, barH)
        curX += elemW
      }

      // Defend
      if (math.defendMult !== 1) {
        const defW = Math.max(2, ((ratioVal * (1 - math.defendMult)) / total) * barW)
        g.fillStyle(hexColor(THEME.colors.bad), 0.7)
        g.fillRect(pad + 8 + curX, y, defW, barH)
        curX += defW
      }

      // Variance
      const varW = Math.max(2, ((ratioVal * math.elementMult * math.defendMult * (math.varianceMult - 1)) / total) * barW)
      g.fillStyle(hexColor(THEME.colors.textMuted), 0.5)
      g.fillRect(pad + 8 + curX, y, varW, barH)
      curX += varW

      // Crit
      if (math.critMult !== 1) {
        const critW = Math.max(2, ((ratioVal * math.elementMult * math.defendMult * math.varianceMult * (math.critMult - 1)) / total) * barW)
        g.fillStyle(hexColor(THEME.colors.warn), 0.8)
        g.fillRect(pad + 8 + curX, y, critW, barH)
        curX += critW
      }

      this.scrollRegion.content.add(g)
      y += barH + 4
    }

    return y
  }

  private renderHealMath(math: HealMath, y: number, pad: number, innerW: number): number {
    const { scene } = this.scrollRegion.content
    const text = uiText(scene, pad + 8, y, `heal: base ${math.basePower} | MAG ${math.mag}/${math.magRef} = ${math.final}`, {
      size: 'xs',
      color: THEME.colors.good,
      wordWrap: innerW - 16,
    }, this.scrollRegion.content)
    return y + text.height + 4
  }

  private renderSpeedMath(math: SpeedMath, y: number, pad: number, innerW: number): number {
    const { scene } = this.scrollRegion.content
    const text = uiText(scene, pad + 8, y, `speed: SPD ${math.spd} | delay ${math.actionDelay} | ref ${math.spdRef} | next in ${math.timeToNext.toFixed(1)}`, {
      size: 'xs',
      color: THEME.colors.textMuted,
      wordWrap: innerW - 16,
    }, this.scrollRegion.content)
    return y + text.height + 4
  }

  destroy(): void {
    this.container.destroy(true)
  }

  updateEntries(entries: BattleLogEntry[]): void {
    this.entries = entries
    this.render()
  }
}

/**
 * Inline combat log for the BattleScene HUD — compact version with toggle.
 * Shows last N entries, toggles between simple/advanced.
 */
export function createInlineCombatLog(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  logger: { getEntries(): BattleLogEntry[] },
  maxEntries = 10,
): { container: Phaser.GameObjects.Container; update: () => void; destroy: () => void } {
  const container = scene.add.container(x, y)
  parent.add(container)

  makePanel(scene, 0, 0, width, height, {
    fillColor: THEME.colors.face,
  }, container)

  // Header with toggle
  uiText(scene, 8, 4, 'Log', { size: 'xs', color: THEME.colors.textMuted, family: 'display' }, container)

  let mode: 'simple' | 'advanced' = 'simple'
  makeButton(scene, width - 68, 0, 'Adv.', () => {
    mode = mode === 'simple' ? 'advanced' : 'simple'
    update()
  }, { width: 60, height: 20, fontSize: 'xs', color: THEME.colors.panel }, container)

  // Scroll region
  const scrollRegion = makeScrollRegion(scene, container, 4, 22, width - 8, height - 26, {
    fillColor: 0x000000,
    strokeColor: 0x000000,
  })

  function update(): void {
    scrollRegion.content.removeAll(true)
    const entries = logger.getEntries().slice(-maxEntries)
    let yy = 4

    for (const entry of entries) {
      const simpleText = `${entry.turn > 0 ? `T${entry.turn} ` : ''}${mode === 'simple' ? (entry.simple || entry.text) : (entry.advanced || entry.simple || entry.text)}`
      const text = uiText(scene, 4, yy, simpleText, {
        size: 'xs',
        color: mode === 'simple' ? THEME.colors.text : THEME.colors.textMuted,
        wordWrap: width - 24,
      }, scrollRegion.content)
      text.setOrigin(0, 0)
      yy += text.height + 2

      if (mode === 'advanced') {
        if (entry.damageMath) {
          const dm = entry.damageMath
          const parts = [
            `base ${dm.base}`,
            `ATK ${dm.atkStat}/DEF ${dm.defStat}=${dm.ratio.toFixed(1)}`,
          ]
          if (dm.elementMult !== 1) parts.push(`elem x${dm.elementMult.toFixed(2)}`)
          if (dm.defendMult !== 1) parts.push(`defend x${dm.defendMult}`)
          parts.push(`var x${dm.varianceMult.toFixed(2)}`)
          if (dm.critMult !== 1) parts.push(`CRIT x${dm.critMult}`)
          parts.push(`= ${dm.final}`)
          const formula = parts.join(' → ')
          const fText = uiText(scene, 8, yy, formula, {
            size: 'xs',
            color: THEME.colors.accentBlue,
            wordWrap: width - 32,
          }, scrollRegion.content)
          yy += fText.height + 2
        }
        if (entry.healMath) {
          const hm = entry.healMath
          const fText = uiText(scene, 8, yy, `heal: base ${hm.basePower} | MAG ${hm.mag}/${hm.magRef} = ${hm.final}`, {
            size: 'xs',
            color: THEME.colors.good,
            wordWrap: width - 32,
          }, scrollRegion.content)
          yy += fText.height + 2
        }
        if (entry.speedMath) {
          const sm = entry.speedMath
          const fText = uiText(scene, 8, yy, `SPD ${sm.spd} delay ${sm.actionDelay} next ${sm.timeToNext.toFixed(1)}`, {
            size: 'xs',
            color: THEME.colors.textMuted,
            wordWrap: width - 32,
          }, scrollRegion.content)
          yy += fText.height + 2
        }
      }

      // Thin separator
      const g = scene.add.graphics()
      g.lineStyle(1, THEME.colors.border, 0.2)
      g.beginPath()
      g.moveTo(4, yy)
      g.lineTo(width - 12, yy)
      g.strokePath()
      scrollRegion.content.add(g)
      yy += 2
    }

    scrollRegion.setContentHeight(yy)
    // Auto-scroll to bottom
    const contentH = scrollRegion.content.height || 0
    const viewH = height - 26
    if (contentH > viewH) {
      scrollRegion.content.y = -(contentH - viewH)
    }
  }

  update()

  return {
    container,
    update,
    destroy() { container.destroy(true) },
  }
}
import { Panel } from './panel'
import { THEME, hexColor } from '../theme'
import { uiText, makeButton, makeSubpanel, makeScrollRegion } from '../widgets'
import { getProfile, mutate } from '../../../core/store'
import { refreshShopStock } from '../../../core/shop/shop'
import { refreshRecruitment } from '../../../core/shop/recruitment'
import { TOWNS, TOWN_IDS } from '../../../core/data'
import { getClass } from '../../../core'
import { createRng } from '../../../core/rng/rng'
import type { PanelRect } from './panel'
import type { TownDef } from '../../../core/data/towns'

/** Converts a CSS color string or Phaser numeric color to a Phaser numeric color. */
function toNumColor(c: string | number): number {
  return typeof c === 'string' ? hexColor(c) : c
}

/**
 * Phase 5 Town Selection Panel.
 * Shown on first run (before any runs) and accessible from the meta screen
 * to change home town. Displays 4 city cards with race, vibe, bonuses, and
 * favored classes/enemies.
 */
export class TownSelectPanel extends Panel {
  private selectedTownId: string | null = null
  private message: string | null = null
  private onConfirm: (() => void) | null = null

  constructor(
    scene: Phaser.Scene,
    rect: PanelRect,
    onConfirm?: () => void
  ) {
    super(scene, rect)
    this.onConfirm = onConfirm ?? null
  }

  /** Show the panel with a specific town pre-selected (or current home town). */
  show(initialTownId?: string): void {
    this.selectedTownId = initialTownId ?? getProfile().homeTown ?? 'aldwyn'
    this.message = null
    this.refresh()
    this.container.setVisible(true)
  }

  hide(): void {
    this.container.setVisible(false)
  }

  refresh(): void {
    const content = this.rebuild()
    const profile = getProfile()
    const pad = THEME.spacing.pad
    const cardGap = 16
    const cardPadding = 20
    const cardHeight = 340

    // Title
    uiText(this.scene, pad, 8, 'CHOOSE YOUR HOME CITY', {
      size: 'xs',
      color: THEME.colors.accentBlue,
    }, content)

    // Subtitle
    uiText(this.scene, pad, 28, 'Each city shapes your runs: enemies, shop stock, and recruits.', {
      size: 'xs',
      color: THEME.colors.textMuted,
      wordWrap: this.rect.w - pad * 2,
    }, content)

    // Create scrollable region for town cards (interactive mode for clickable buttons)
    const scrollRegion = makeScrollRegion(
      this.scene,
      content,
      pad,
      52,
      this.rect.w - pad * 2,
      this.rect.h - 52 - pad - 60, // leave space for title, confirm button, message
      { interactive: true },
    )

    let cardY = 0
    const cardW = this.rect.w - pad * 2

    // Town cards - full width, stacked vertically
    TOWN_IDS.forEach((townId) => {
      const town = TOWNS[townId]
      const isCurrent = profile.homeTown === townId

      this.drawTownCard(scrollRegion.content, 0, cardY, cardW, cardHeight, town, isCurrent, cardPadding)
      cardY += cardHeight + cardGap
    })

    // Update scroll region content height after all cards added
    scrollRegion.setContentHeight(cardY)

    // Confirm button (fixed at bottom of panel, outside scroll region)
    if (this.selectedTownId) {
      const btnY = (this.rect as PanelRect).h - pad - 50
      const btnW = 200
      const btnX = ((this.rect as PanelRect).w - btnW) / 2
      makeButton(
        this.scene,
        btnX,
        btnY,
        this.selectedTownId === profile.homeTown ? 'Current Home' : 'Set as Home City',
        () => this.confirmSelection(),
        { width: btnW, height: 36, color: toNumColor(THEME.colors.good) },
        content,
      )
    }

    // Message
    if (this.message) {
      uiText(
        this.scene,
        (this.rect as PanelRect).w / 2,
        (this.rect as PanelRect).h - pad - 8,
        this.message,
        { size: 'xs', color: THEME.colors.good, wordWrap: (this.rect as PanelRect).w - pad * 2 },
        content,
      ).setOrigin(0.5, 1)
    }
  }

  private drawTownCard(
    content: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    town: TownDef,
    isCurrent: boolean,
    cardPadding: number
  ): void {
    const pad = cardPadding
    const isSelected = this.selectedTownId === town.id
    const innerW = w - pad * 2
    const innerX = x + pad

    // Card background
    makeSubpanel(this.scene, content, x, y, w, h, {
      fillColor: isSelected ? 0x2a3a4a : 0x1a1a2a,
      strokeColor: isSelected ? THEME.colors.accent : isCurrent ? toNumColor(THEME.colors.good) : THEME.colors.border,
    })

    // Race badge
    const raceColors: Record<string, number> = {
      human: 0x8888aa,
      elf: 0x44aa44,
      dragonborn: 0xcc4444,
      lizardfolk: 0x44aa88,
    }
    const raceBadge = this.scene.add.rectangle(innerX, y + pad, 100, 26, raceColors[town.race] ?? 0x666666)
    raceBadge.setOrigin(0, 0)
    content.add(raceBadge)
    uiText(this.scene, innerX + 50, y + pad + 3, town.race.toUpperCase(), {
      size: 'xs',
      color: 0xffffff,
      align: 'center',
    }, content).setOrigin(0.5, 0)

    // Current home indicator
    if (isCurrent && !isSelected) {
      uiText(this.scene, innerX + innerW, y + pad, 'CURRENT', {
        size: 'xs',
        color: toNumColor(THEME.colors.good),
      }, content).setOrigin(1, 0)
    }

    // City name
    uiText(this.scene, innerX, y + 44, town.name, {
      size: 'lg',
      color: THEME.colors.gold,
    }, content)

    // Description
    uiText(this.scene, innerX, y + 76, town.description, {
      size: 'sm',
      color: THEME.colors.textMuted,
      wordWrap: innerW,
    }, content)

    // Two-column layout for bonuses and details
    const leftColX = innerX
    const rightColX = innerX + innerW * 0.55
    let leftY = y + 140
    let rightY = y + 140

    // LEFT COLUMN: Bonuses
    uiText(this.scene, leftColX, leftY, 'Run Modifiers', { size: 'xs', color: THEME.colors.accentBlue }, content)
    leftY += 20

    const bonusLine = (label: string, value: string, color: string | number = THEME.colors.text) => {
      uiText(this.scene, leftColX, leftY, label, { size: 'xs', color: toNumColor(THEME.colors.textMuted) }, content)
      uiText(this.scene, leftColX + 90, leftY, value, { size: 'xs', color: toNumColor(color) }, content)
      leftY += 22
    }

    const goldPct = Math.round((town.goldMultiplier - 1) * 100)
    const dropPct = Math.round((town.dropChanceMultiplier - 1) * 100)
    const diffPct = Math.round((town.difficultyStepMultiplier - 1) * 100)

    bonusLine('Gold:', `${goldPct >= 0 ? '+' : ''}${goldPct}%`, town.goldMultiplier > 1 ? THEME.colors.good : town.goldMultiplier < 1 ? THEME.colors.bad : THEME.colors.text)
    bonusLine('Drops:', `${dropPct >= 0 ? '+' : ''}${dropPct}%`, town.dropChanceMultiplier > 1 ? THEME.colors.good : town.dropChanceMultiplier < 1 ? THEME.colors.bad : THEME.colors.text)
    bonusLine('Difficulty:', `${diffPct >= 0 ? '+' : ''}${diffPct}%`, town.difficultyStepMultiplier > 1 ? THEME.colors.bad : town.difficultyStepMultiplier < 1 ? THEME.colors.good : THEME.colors.text)

    // RIGHT COLUMN: Favored Classes
    uiText(this.scene, rightColX, rightY, 'Favored Classes', { size: 'xs', color: THEME.colors.accentBlue }, content)
    rightY += 20
    town.recruitClassPool.forEach((classId) => {
      const cls = getClass(classId)
      const weight = town.recruitClassWeights?.[classId] ?? 1
      const weightStr = weight !== 1 ? ` (${weight}x)` : ''
      uiText(this.scene, rightColX, rightY, `• ${cls.name}${weightStr}`, {
        size: 'xs',
        color: THEME.colors.text,
      }, content)
      rightY += 20
    })

    // Common Foes (below left column)
    leftY += 10
    uiText(this.scene, leftColX, leftY, 'Common Foes', { size: 'xs', color: THEME.colors.accentBlue }, content)
    leftY += 20
    town.standardPool.slice(0, 3).forEach((enemyId) => {
      uiText(this.scene, leftColX, leftY, `• ${enemyId.replace(/_/g, ' ')}`, {
        size: 'xs',
        color: THEME.colors.textMuted,
      }, content)
      leftY += 20
    })

    // Select button at bottom of card
    const btnY = y + h - 50
    const selectBtn = makeButton(
      this.scene,
      innerX, // left edge of inner area
      btnY,
      isSelected ? 'Selected' : 'Select',
      () => {
        this.selectedTownId = town.id
        this.refresh()
      },
      {
        width: innerW,
        height: 36,
        color: isSelected ? THEME.colors.accent : THEME.colors.panelAlt,
        fontSize: 'sm',
      },
      content,
    )
    if (isSelected) selectBtn.setDisabled(true)
  }

  private confirmSelection(): void {
    const profile = getProfile()
    if (this.selectedTownId === profile.homeTown) {
      this.message = 'Already your home city.'
      this.refresh()
      return
    }
    try {
      mutate((p) => {
        p.homeTown = this.selectedTownId!
      })
      // Also refresh shop/recruitment immediately
      const rng = createRng(Date.now() + profile.stats.totalRuns + 3)
      refreshShopStock(profile, rng, this.selectedTownId!)
      refreshRecruitment(profile, rng, this.selectedTownId!)

      this.message = `Home city set to ${TOWNS[this.selectedTownId!].name}!`
      this.refresh()
      if (this.onConfirm) this.onConfirm()
    } catch (e) {
      this.message = (e as Error).message
      this.refresh()
    }
  }
}
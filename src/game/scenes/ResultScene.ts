/**
 * M9 — ResultScene (run-end outcomes).
 *
 * Renders the summary a finished run produces: victory / full-wipe / abandon
 * outcome, gold banked, item + gear drops kept, and XP gained per survivor.
 * All payout-to-meta bookkeeping (banking, stats, shop + recruitment refresh,
 * durability tick) already happened inside the store when the run resolved
 * (`store.onRunEnd`, `resolve.bankRunRewards`), so this scene is purely
 * **presentational** — it reads a `RunResult` handed off by `RunScene` and
 * returns the player to the meta loop (recruit → gear → run again).
 *
 * Layout (960×540): header band with gold balance, a centred outcome card
 * (title + summary + survivor XP), and two exits — a new run or the base.
 */

import Phaser from 'phaser'
import { THEME, setTheme } from '../ui/theme'
import { initThemes, getActiveTheme } from '../../core/themes'
import { uiText, makePanel, makeButton } from '../ui/widgets'
import { STONE_BG_KEY, createStoneTextures } from '../ui/textures'
import { initStore, getProfile } from '../../core/store'
import { getItem } from '../../core/data'
import { findGearById } from '../../core/inventory'
import type { RunResult } from '../../core/types'

/** Data ResultScene accepts from RunScene at run-end. */
export interface ResultSceneData {
  result: RunResult
}

const HEADER_H = 48
const PANEL_X = 60
const PANEL_Y = 72
const PANEL_W = 840
const PANEL_H = 420

const STATUS_TITLE: Record<RunResult['status'], string> = {
  won: 'Victory!',
  lost: 'Defeat',
  abandoned: 'Run Abandoned',
}

function statusColor(status: RunResult['status']): string {
  switch (status) {
    case 'won':
      return THEME.colors.good
    case 'lost':
      return THEME.colors.bad
    default:
      return THEME.colors.warn
  }
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene')
  }

  create(): void {
    const { width, height } = this.scale
    initStore()
    initThemes()
    setTheme(getActiveTheme())
    createStoneTextures(this)

    this.add.rectangle(0, 0, width, height, THEME.colors.bg).setOrigin(0)
    this.add.image(width / 2, height / 2, STONE_BG_KEY).setOrigin(0.5)
    this.add
      .rectangle(width / 2, height / 2, width - 8, height - 8, 0x000000, 0)
      .setStrokeStyle(1, THEME.colors.borderLight, 0.4)

    this.add.rectangle(width / 2, HEADER_H / 2, width, HEADER_H, THEME.colors.panel).setOrigin(0.5)
    this.add.rectangle(width / 2, HEADER_H - 1, width, 1, THEME.colors.borderLight, 0.3).setOrigin(0.5)

    uiText(this, THEME.spacing.pad, 10, 'Run Complete', {
      size: 'xl',
      color: THEME.colors.gold,
      family: 'display',
      letterSpacing: 2,
    })

    // Phaser 4 keeps settings.data on restart, so clear it once consumed.
    const data = this.scene.settings.data as ResultSceneData | undefined
    this.scene.settings.data = {}
    if (data?.result) this.buildSummary(data.result)
  }

  private buildSummary(result: RunResult): void {
    const profile = getProfile()

    uiText(this, this.scale.width - THEME.spacing.pad, 28, `${profile.gold} gold`, {
      size: 'sm',
      color: THEME.colors.gold,
    }).setOrigin(1, 0)

    makePanel(this, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, {})
    const cx = PANEL_X + 32

    uiText(this, cx, PANEL_Y + 22, STATUS_TITLE[result.status], {
      size: 'xl',
      color: statusColor(result.status),
      family: 'display',
    })

    let y = PANEL_Y + 74
    uiText(this, cx, y, `Gold banked: ${result.goldBanked}`, { size: 'md', color: THEME.colors.text }, undefined)
    y += 26

    const drops = this.describeDrops(result)
    if (drops.length > 0) {
      uiText(this, cx, y, 'Loot kept:', { size: 'md', color: THEME.colors.textMuted }, undefined)
      y += 24
      for (const line of drops) {
        uiText(this, cx + 18, y, line, { size: 'sm', color: THEME.colors.text }, undefined)
        y += 20
      }
      y += 6
    } else {
      uiText(this, cx, y, 'No loot was kept.', { size: 'sm', color: THEME.colors.textDim }, undefined)
      y += 30
    }

    if (result.survivors.length > 0) {
      uiText(this, cx, y, 'Survivors:', { size: 'md', color: THEME.colors.textMuted }, undefined)
      y += 24
      for (const id of result.survivors) {
        const char = profile.characters[id]
        if (!char) continue
        const xp = result.xpGained[id] ?? 0
        uiText(this, cx + 18, y, `${char.name}  \u00b7  Lv ${char.level}`, {
          size: 'sm',
          color: THEME.colors.text,
          family: 'display',
        }, undefined)
        uiText(this, cx + 240, y, `+${xp} XP`, { size: 'sm', color: THEME.colors.gold }, undefined)
        y += 20
      }
    } else {
      uiText(this, cx, y, 'The party was wiped out.', { size: 'sm', color: THEME.colors.bad }, undefined)
    }

    makeButton(this, PANEL_X + PANEL_W - 360, PANEL_Y + PANEL_H - 56, 'New Run', () => this.scene.start('RunScene'), {
      width: 160,
      height: 40,
    })
    makeButton(
      this,
      PANEL_X + PANEL_W - 180,
      PANEL_Y + PANEL_H - 56,
      'Return to Base',
      () => this.scene.start('MetaScene'),
      { width: 160, height: 40 },
    )
  }

  /** Item/gear names kept from the run, each on its own summary line. */
  private describeDrops(result: RunResult): string[] {
    const lines: string[] = []
    const countByItem = new Map<string, number>()
    for (const itemId of result.itemsBanked) countByItem.set(itemId, (countByItem.get(itemId) ?? 0) + 1)
    for (const [itemId, count] of countByItem) {
      const name = getItem(itemId).name
      lines.push(count > 1 ? `${name} \u00d7${count}` : name)
    }
    for (const gearId of result.gearBanked) {
      const gear = findGearById(getProfile(), gearId)
      if (!gear) continue
      const name = getItem(gear.itemId).name
      lines.push(`${name} (gear)`)
    }
    return lines
  }
}
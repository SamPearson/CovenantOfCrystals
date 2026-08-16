/**
 * M6 — RunScene (run loop shell).
 *
 * Renders the active run produced by `src/core/runs` and drives node
 * navigation. The scene holds no authoritative game-phase state: it reads the
 * `ActiveRun` from the store, renders it, and translates player input into
 * store actions (`startRun`, `resolveNode`, `resolveRest`, `abandonRun`,
 * `useItemOutOfBattle`) that own all mutation and persistence (`docs/
 * architecture.md` §2). Because every node boundary persists immediately,
 * reloading at a checkpoint resumes the run at its current node.
 *
 * Battle nodes hand off to `BattleScene` with the node's squad + the run's
 * party snapshot; on completion BattleScene returns a `BattleResult`, which
 * `resolveNode` applies (rewards, permadeath, node advance / run end).
 *
 * Layout (960×540): header band, a run-map strip of node icons, the current
 * node card (with the S9 visible next-node choices), and a party / item panel.
 */

import Phaser from 'phaser'
import { THEME, colorHex, hexColor, setTheme } from '../ui/theme'
import { initThemes, getActiveTheme } from '../../core/themes'
import { uiText, makePanel, makeButton, makeBadge } from '../ui/widgets'
import type { Button } from '../ui/widgets'
import { STONE_BG_KEY, createStoneTextures } from '../ui/textures'
import {
  initStore,
  getProfile,
  getActiveRun,
  startRun,
  resolveNode,
  resolveRest,
  useItemOutOfBattle,
} from '../../core/store'
import { partyByIds } from '../battle/battle-setup'
import { hashString } from '../../core/rng/rng'
import { RUN_LENGTHS } from '../../core/runs/run-gen'
import { getItem, getSkill } from '../../core/data'
import type { ActiveRun, EnemyDef, RunNode, RunResult } from '../../core/types'
import type { BattleResult } from '../../core/combat/types'

/** Data RunScene accepts when relaunched with a finished-battle result. */
export interface RunSceneData {
  battleResult?: BattleResult
}

const HEADER_H = 48
const STRIP_Y = HEADER_H + 6
const STRIP_H = 34
const NODE_PANEL_X = 10
const NODE_PANEL_W = 620
const PARTY_PANEL_X = 640
const PARTY_PANEL_W = 310
const CONTENT_TOP = HEADER_H + 52
const CONTENT_H = 540 - 10 - CONTENT_TOP

const NODE_ICON: Record<string, string> = { battle: 'B', elite: 'E', rest: 'R', boss: '\u2605' }

export class RunScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container
  private headerGold!: Phaser.GameObjects.Text
  private buttons: Button[] = []

  constructor() {
    super('RunScene')
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
    this.add.rectangle(width / 2, HEADER_H - 1, width, 1, THEME.colors.borderLight, 0.3).setOrigin(0.5, 0.5)

    uiText(this, THEME.spacing.pad, 10, 'Run', {
      size: 'xl',
      color: THEME.colors.gold,
      family: 'display',
      letterSpacing: 2,
    })
    this.headerGold = uiText(this, width - THEME.spacing.pad, 28, '', {
      size: 'sm',
      color: THEME.colors.borderLight,
    }).setOrigin(1, 0)

    makeButton(this, width - 260, 8, 'Exit', () => this.scene.start('MetaScene'), { width: 120, height: 32 })

    this.content = this.add.container(0, 0)

    // Phaser 4 keeps settings.data when a scene is restarted without a data
    // argument, so a finished battle's handoff would otherwise be picked up
    // again (and re-resolved) when opening a new run from the menu.
    const data = this.scene.settings.data as RunSceneData | undefined
    this.scene.settings.data = {}
    if (data?.battleResult) {
      const result = resolveNode(data.battleResult)
      if (result) {
        this.buildEndScreen(result)
        return
      }
    }

    const run = getActiveRun()
    if (run && run.status === 'active') {
      this.buildRunMap(run)
      return
    }
    this.buildStartScreen()
  }

  // -------------------------------------------------------------------------
  // Start screen
  // -------------------------------------------------------------------------

  private buildStartScreen(): void {
    this.content.removeAll(true)
    this.buttons = []
    this.headerGold.setText('')
    const profile = getProfile()
    const party = partyByIds(profile, profile.party)

    makePanel(this, NODE_PANEL_X, CONTENT_TOP, NODE_PANEL_W, CONTENT_H, {}, this.content)
    uiText(this, NODE_PANEL_X + 20, CONTENT_TOP + 12, 'Begin a Run', {
      size: 'lg',
      color: THEME.colors.gold,
      family: 'display',
    }, this.content)

    const y = CONTENT_TOP + 52
    uiText(this, NODE_PANEL_X + 20, y, 'Choose your run length — the boss awaits at the end.', {
      size: 'sm',
      color: THEME.colors.textMuted,
    }, this.content)

    if (party.length === 0) {
      uiText(this, NODE_PANEL_X + 20, y + 70, 'Your party is empty — add champions on the Party tab first.', {
        size: 'md',
        color: THEME.colors.warn,
        wordWrap: NODE_PANEL_W - 60,
      }, this.content)
      this.addButton(NODE_PANEL_X + 20, y + 140, 'Back to Base', () => this.scene.start('MetaScene'))
      return
    }

    let bx = NODE_PANEL_X + 20
    for (const length of RUN_LENGTHS) {
      this.addButton(bx, y + 40, `${length} Battles`, () => this.beginRun(length), { width: 160, height: 40 })
      bx += 180
    }
  }

  private beginRun(length: number): void {
    const profile = getProfile()
    const partyIds = profile.party.slice()
    if (partyIds.length === 0) {
      this.scene.start('MetaScene')
      return
    }
    startRun(partyIds, length, Date.now())
    const run = getActiveRun()
    if (run) this.buildRunMap(run)
  }

  // -------------------------------------------------------------------------
  // Run map
  // -------------------------------------------------------------------------

  private buildRunMap(run: ActiveRun): void {
    this.content.removeAll(true)
    this.buttons = []
    this.headerGold.setText(`Seed ${run.seed}  \u00b7  Gold ${run.goldEarned}`)

    const node = run.nodes[run.currentNodeIndex]
    if (!node) {
      this.buildEndScreen(this.fallbackResult(run))
      return
    }

    this.buildMapStrip(run)
    this.buildNodeCard(run, node)
    this.buildPartyPanel(run)
  }

  private buildMapStrip(run: ActiveRun): void {
    const strip = this.add.container(NODE_PANEL_X, STRIP_Y)
    this.content.add(strip)
    const gap = 34
    run.nodes.forEach((n, i) => {
      const x = i * gap
      const isCurrent = i === run.currentNodeIndex
      const isPast = i < run.currentNodeIndex
      const color = this.nodeColor(n.type)
      const chip = this.add
        .rectangle(x + 13, STRIP_H / 2, 26, STRIP_H - 8, isPast ? 0x000000 : color, isPast ? 0.15 : 0.85)
        .setRounded(4)
        .setStrokeStyle(1, isCurrent ? THEME.colors.gold : THEME.colors.borderLight, isCurrent ? 1 : 0.4)
      const label = uiText(this, x + 13, STRIP_H / 2, NODE_ICON[n.type] ?? '?', {
        size: 'sm',
        color: isPast ? THEME.colors.textDim : THEME.colors.textOnAccent,
        family: 'display',
      }).setOrigin(0.5)
      strip.add([chip, label])
    })
    uiText(this, 0, STRIP_H + 2, 'Map', { size: 'xs', color: THEME.colors.textMuted }, strip)
  }

  private buildNodeCard(run: ActiveRun, node: RunNode): void {
    makePanel(this, NODE_PANEL_X, CONTENT_TOP, NODE_PANEL_W, CONTENT_H, {}, this.content)
    const cx = NODE_PANEL_X + 20

    uiText(this, cx, CONTENT_TOP + 12, 'Current Step', { size: 'xs', color: THEME.colors.textMuted }, this.content)
    makeBadge(this, cx, CONTENT_TOP + 28, this.nodeLabel(node.type), this.nodeBadgeColor(node.type), {}, this.content)
    uiText(this, cx, CONTENT_TOP + 58, `Step ${node.index + 1} of ${run.nodes.length}`, {
      size: 'sm',
      color: THEME.colors.borderLight,
    }, this.content)

    let bodyY = CONTENT_TOP + 88
    if (node.type === 'rest') {
      uiText(this, cx, bodyY, 'The party rests — HP and MP are fully restored.', {
        size: 'md',
        color: THEME.colors.good,
        wordWrap: NODE_PANEL_W - 60,
      }, this.content)
    } else if (node.enemySquad && node.enemySquad.length > 0) {
      uiText(this, cx, bodyY, node.type === 'boss' ? 'The Boss stands before you.' : 'Enemies ahead:', {
        size: 'sm',
        color: THEME.colors.textMuted,
      }, this.content)
      let ey = bodyY + 26
      for (const enemy of node.enemySquad) {
        const e = enemy as EnemyDef
        uiText(this, cx, ey, `${e.name}  \u00b7  Lv ${e.level}  \u00b7  HP ${e.stats.hp}`, {
          size: 'md',
          color: THEME.colors.text,
          family: 'display',
        }, this.content)
        ey += 24
      }
    }

    if (node.choices && node.choices.length > 0) {
      uiText(this, cx, CONTENT_TOP + CONTENT_H - 96, 'Path ahead:', { size: 'xs', color: THEME.colors.textMuted },
        this.content)
      let bxx = cx
      for (const choice of node.choices) {
        const badge = makeBadge(this, bxx, CONTENT_TOP + CONTENT_H - 78, choice.label,
          this.nodeBadgeColor(choice.type), {}, this.content)
        bxx += badge.width + 8
      }
    }

    const actionLabel =
      node.type === 'rest' ? 'Rest' : node.type === 'boss' ? 'Face the Boss' : node.type === 'elite' ? 'Fight' : 'Fight'
    this.addButton(NODE_PANEL_X + 20, CONTENT_TOP + CONTENT_H - 46, actionLabel, () => this.enterNode(run, node), {
      width: 200,
      height: 40,
    })
  }

  private buildPartyPanel(run: ActiveRun): void {
    makePanel(this, PARTY_PANEL_X, CONTENT_TOP, PARTY_PANEL_W, CONTENT_H, {}, this.content)
    const cx = PARTY_PANEL_X + 16
    uiText(this, cx, CONTENT_TOP + 12, 'Party', { size: 'lg', color: THEME.colors.gold, family: 'display' },
      this.content)

    const members = partyByIds(getProfile(), run.party)
    if (members.length === 0) {
      uiText(this, cx, CONTENT_TOP + 48, 'All party members have fallen.', {
        size: 'sm',
        color: THEME.colors.warn,
        wordWrap: PARTY_PANEL_W - 40,
      }, this.content)
    }
    let y = CONTENT_TOP + 48
    for (const member of members) {
      uiText(this, cx, y, member.name, { size: 'md', color: THEME.colors.text, family: 'display' }, this.content)
      uiText(this, cx + PARTY_PANEL_W - 40, y, `Lv ${member.level}`, {
        size: 'sm',
        color: THEME.colors.borderLight,
      }).setOrigin(1, 0)
      y += 26
    }

    this.addButton(cx, CONTENT_TOP + CONTENT_H - 46, 'Use Items', () => this.openItemModal(), {
      width: PARTY_PANEL_W - 40,
      height: 40,
    })
  }

  private enterNode(run: ActiveRun, node: RunNode): void {
    if (node.type === 'rest') {
      resolveRest()
      const next = getActiveRun()
      if (next) this.buildRunMap(next)
      return
    }
    const battleSeed = hashString(`${run.seed}:${node.index}`)
    this.scene.start('BattleScene', {
      seed: battleSeed,
      squad: node.enemySquad,
      partyIds: run.party,
      returnTo: 'RunScene',
    })
  }

  // -------------------------------------------------------------------------
  // Between-battle item usage (tomes on the map)
  // -------------------------------------------------------------------------

  private openItemModal(): void {
    const { width, height } = this.scale
    const profile = getProfile()
    const run = getActiveRun()
    const members = partyByIds(profile, run?.party ?? [])

    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0)
    dim.setInteractive()
    dim.on('pointerdown', () => close())

    const panelW = 480
    const panelH = 320
    const panel = makePanel(this, (width - panelW) / 2, (height - panelH) / 2, panelW, panelH, {}, this.content)

    uiText(this, 24, 16, 'Use Items', { size: 'lg', color: THEME.colors.gold, family: 'display' }, panel)
    uiText(this, 24, 48, 'Tomes teach a skill permanently to a party member. Potions and scrolls are battle-only.',
      { size: 'xs', color: THEME.colors.textMuted, wordWrap: panelW - 48 }, panel)

    const usable = profile.inventory.items.filter((entry) => {
      const item = getItem(entry.itemId)
      return item.type === 'tome'
    })

    let y = 80
    if (usable.length === 0) {
      uiText(this, 24, y, 'No tomes in your inventory.', { size: 'sm', color: THEME.colors.textMuted }, panel)
    }
    for (const entry of usable) {
      const item = getItem(entry.itemId)
      const skill = item.skill ? getSkill(item.skill) : null
      uiText(this, 24, y, `${item.name}  \u00d7${entry.count}`, { size: 'sm', color: THEME.colors.text }, panel)
      let bx = 24
      for (const member of members) {
        const b = makeButton(
          this,
          bx,
          y + 24,
          `Teach ${member.name}`,
          () => {
            const result = useItemOutOfBattle(member.id, entry.itemId)
            this.showToast(
              result.ok
                ? `${member.name} learned ${skill?.name ?? 'a new skill'}!`
                : result.error ?? 'Could not use that item.',
            )
            close()
            const current = getActiveRun()
            if (current && current.status === 'active') this.buildRunMap(current)
          },
          { width: 104, height: 26, fontSize: 'xs' },
          panel,
        )
        this.buttons.push(b)
        bx += 112
      }
      y += 58
    }

    const closeBtn = makeButton(this, 24, panelH - 44, 'Close', () => close(), { width: panelW - 48, height: 32 }, panel)
    this.buttons.push(closeBtn)

    function close(): void {
      panel.destroy()
      dim.destroy()
    }
  }

  // -------------------------------------------------------------------------
  // Run-end transition (ResultScene lands in M9)
  // -------------------------------------------------------------------------

  private buildEndScreen(result: RunResult): void {
    this.content.removeAll(true)
    this.buttons = []
    this.headerGold.setText('')

    makePanel(this, NODE_PANEL_X, CONTENT_TOP, NODE_PANEL_W, CONTENT_H, {}, this.content)
    const cx = NODE_PANEL_X + 20

    const title =
      result.status === 'won' ? 'Victory!' : result.status === 'lost' ? 'Defeat' : 'Run Abandoned'
    uiText(this, cx, CONTENT_TOP + 16, title, {
      size: 'xl',
      color: result.status === 'won' ? THEME.colors.good : THEME.colors.bad,
      family: 'display',
    }, this.content)

    const lines = [
      `Survivors: ${result.survivors.length}`,
      `Gold banked: ${result.goldBanked}`,
      `Items banked: ${result.itemsBanked.length}`,
      `Gear banked: ${result.gearBanked.length}`,
    ]
    let y = CONTENT_TOP + 72
    for (const line of lines) {
      uiText(this, cx, y, line, { size: 'sm', color: THEME.colors.text }, this.content)
      y += 22
    }

    const xp = Object.values(result.xpGained)
    if (xp.length > 0) {
      uiText(this, cx, y + 4, `Party XP gained: ${xp.reduce((a, b) => a + b, 0)}`, {
        size: 'sm',
        color: THEME.colors.gold,
      }, this.content)
    }

    this.addButton(cx, CONTENT_TOP + CONTENT_H - 46, 'Return to Base', () => this.scene.start('MetaScene'), {
      width: 200,
      height: 40,
    })
  }

  private fallbackResult(run: ActiveRun): RunResult {
    return {
      status: run.status === 'active' ? 'abandoned' : run.status,
      survivors: run.party,
      koIds: [],
      goldBanked: 0,
      itemsBanked: [],
      gearBanked: [],
      xpGained: {},
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private addButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    opts: { width?: number; height?: number } = {},
  ): Button {
    const button = makeButton(this, x, y, label, onClick, {
      width: opts.width,
      height: opts.height,
      color: THEME.colors.accent,
    })
    this.content.add(button.container)
    this.buttons.push(button)
    return button
  }

  private nodeColor(type: string): number {
    switch (type) {
      case 'rest':
        return hexColor(THEME.colors.good)
      case 'elite':
        return hexColor(THEME.colors.warn)
      case 'boss':
        return hexColor(THEME.colors.bad)
      default:
        return THEME.colors.accentBlue
    }
  }

  private nodeBadgeColor(type: string): string {
    switch (type) {
      case 'rest':
        return THEME.colors.good
      case 'elite':
        return THEME.colors.warn
      case 'boss':
        return THEME.colors.bad
      default:
        return colorHex(THEME.colors.accentBlue)
    }
  }

  private nodeLabel(type: string): string {
    switch (type) {
      case 'rest':
        return 'Rest'
      case 'elite':
        return 'Elite Fight'
      case 'boss':
        return 'Boss'
      default:
        return 'Battle'
    }
  }

  private showToast(message: string): void {
    const { width } = this.scale
    const text = uiText(this, width / 2, 500, message, {
      size: 'sm',
      color: THEME.colors.gold,
      family: 'display',
    }).setOrigin(0.5)
    this.content.add(text)
    this.time.delayedCall(1600, () => text.destroy())
  }
}
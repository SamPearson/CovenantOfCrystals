/**
 * M5 — minimal scripted BattleScene (manual control).
 *
 * Renders the live `BattleState` produced by the combat engine only — the
 * scene holds no game-phase state of its own and never mutates the meta
 * profile (win/loss application is the Phase 3 run layer's job). The fixed
 * scripted squad is defined in `../battle/battle-setup.ts`.
 *
 * Layout (960×540): header band, CTB queue strip, enemy + party card rows,
 * an action panel (Attack / Defend / skills) and a battle-log region.
 */

import Phaser from 'phaser'
import { THEME, colorHex, hexColor, setTheme } from '../ui/theme'
import { initThemes, getActiveTheme } from '../../core/themes'
import { uiText, makePanel, makeSubpanel, makeButton, makeBadge, makeScrollRegion } from '../ui/widgets'
import type { Button, ScrollRegion } from '../ui/widgets'
import { STONE_BG_KEY, createStoneTextures } from '../ui/textures'
import { truncate } from '../ui/format'
import { initStore, getProfile, mutate } from '../../core/store'
import { removeItem } from '../../core/inventory'
import { createBattle, performAction, chooseEnemyAction, getBattleResult } from '../../core/combat/battle'
import { peekNext } from '../../core/combat/timeline'
import { createRng } from '../../core/rng/rng'
import { getSkill, getItem } from '../../core/data'
import { scriptedSquad, partyForBattle, partyByIds } from '../battle/battle-setup'
import { snapshotVitals, diffVitals } from '../battle/battle-vitals'
import { statusIcon } from '../battle/status-icons'
import type { BattleAction, BattleActor, BattleResult, BattleState } from '../../core/combat/types'
import type { EnemyDef } from '../../core/types'

const ENEMY_DELAY = 600
const FLOAT_LIFETIME = 900

const CARD_ENEMY_W = 170
const CARD_PARTY_W = 150
const CARD_H = 110
const CARD_GAP = 14

const ACTION_PANEL_W = 640
const LOG_PANEL_X = 660
const LOG_PANEL_W = 290

/** Data a scene can pass when launching a run-node battle. */
export interface RunBattleData {
  seed?: number
  squad?: EnemyDef[]
  partyIds?: string[]
  /** When set, the scene returns to this scene with a `battleResult` on completion. */
  returnTo?: string
}

export class BattleScene extends Phaser.Scene {
  private battle!: BattleState
  private rng!: () => number
  private seed!: number
  private busy = false

  private root!: Phaser.GameObjects.Container
  private currentActorId: string | null = null
  private cardCenters = new Map<string, { x: number; y: number }>()
  private actionButtons: Button[] = []
  private itemMode = false
  private pendingItem: { itemId: string; targetSide: 'ally' | 'enemy' } | null = null
  private queueChips: Phaser.GameObjects.Container[] = []
  private enemyCards: Phaser.GameObjects.Container[] = []
  private partyCards: Phaser.GameObjects.Container[] = []

  private queueStrip!: Phaser.GameObjects.Container
  private actionPanel!: Phaser.GameObjects.Container
  private actionPrompt!: Phaser.GameObjects.Text
  private seedLabel!: Phaser.GameObjects.Text
  private logRegion!: ScrollRegion

  private enemyCardsX!: number
  private enemyRowY!: number
  private partyCardsX!: number
  private partyRowY!: number

  private returnTo: string | null = null

  constructor() {
    super('BattleScene')
  }

  create(): void {
    initStore()
    initThemes()
    setTheme(getActiveTheme())
    createStoneTextures(this)

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, THEME.colors.bg).setOrigin(0)
    this.add.image(this.scale.width / 2, this.scale.height / 2, STONE_BG_KEY)

    this.root = this.add.container(0, 0)

    // Phaser 4 keeps settings.data when a scene is restarted without a data
    // argument, so a finished battle's handoff would otherwise leak into the
    // next Test Battle started from the menu.
    const data = this.scene.settings.data as RunBattleData | undefined
    this.scene.settings.data = {}
    this.returnTo = data?.returnTo ?? null

    this.buildLayout(data?.returnTo ? 'Run Battle' : 'Test Battle')

    const party = data?.partyIds
      ? partyByIds(getProfile(), data.partyIds)
      : partyForBattle(getProfile())
    if (party.length === 0) {
      this.showEmptyParty()
      return
    }

    this.seed = typeof data?.seed === 'number' ? data.seed : Date.now()
    this.rng = createRng(this.seed)
    const squad = data?.squad ?? scriptedSquad()
    this.battle = createBattle(party, squad, this.seed)
    this.seedLabel.setText(`Seed ${this.seed}`)
    this.pump()
  }

  private buildLayout(title: string): void {
    const t = THEME.colors
    const { pad } = THEME.spacing
    const headerH = THEME.header.height

    this.add.rectangle(0, headerH, this.scale.width, 1, t.borderLight, 0.35).setOrigin(0, 0.5)

    const titleText = uiText(this, pad, 10, title, { size: 'lg', color: t.gold, family: 'display', letterSpacing: 2 }, this.root)
    titleText.setOrigin(0, 0)

    this.seedLabel = uiText(this, this.scale.width / 2, 16, 'Seed —', { size: 'xs', color: t.textMuted }, this.root)
    this.seedLabel.setOrigin(0.5, 0.5)

    makeButton(
      this,
      this.scale.width - pad - 120,
      8,
      'Exit',
      () => this.scene.start(this.returnTo ?? 'MetaScene'),
      { width: 120, height: 32 },
      this.root,
    )

    const queuePanel = makePanel(this, pad, headerH + 4, this.scale.width - pad * 2, 34, {}, this.root)
    this.queueStrip = queuePanel

    this.enemyRowY = headerH + 44
    this.enemyCardsX = this.cardRowX(3, CARD_ENEMY_W)
    this.partyRowY = this.enemyRowY + CARD_H + 16
    this.partyCardsX = this.cardRowX(4, CARD_PARTY_W)

    const actionY = this.partyRowY + CARD_H + 8
    this.actionPanel = makePanel(this, pad, actionY, ACTION_PANEL_W, this.scale.height - actionY - pad, {}, this.root)
    this.actionPrompt = uiText(this, pad, actionY + 10, '', { size: 'sm', color: t.gold, family: 'display' }, this.root)
    this.actionPrompt.setOrigin(0, 0)

    const logPanel = makePanel(this, LOG_PANEL_X, actionY, LOG_PANEL_W, this.scale.height - actionY - pad, {}, this.root)
    this.logRegion = makeScrollRegion(this, logPanel, 8, 8, LOG_PANEL_W - 16, this.scale.height - actionY - pad - 16)
  }

  private cardRowX(count: number, cardW: number): number {
    const total = count * cardW + (count - 1) * CARD_GAP
    return (this.scale.width - total) / 2
  }

  private showEmptyParty(): void {
    uiText(
      this,
      this.scale.width / 2,
      this.scale.height / 2 - 20,
      'Your party is empty — add champions on the Party tab first.',
      { size: 'md', color: THEME.colors.warn, align: 'center' },
      this.root,
    ).setOrigin(0.5)
    makeButton(
      this,
      this.scale.width / 2 - 80,
      this.scale.height / 2 + 20,
      'Back',
      () => this.scene.start('MetaScene'),
      { width: 160 },
      this.root,
    )
  }

  /**
   * Advance the battle to its next actor. Player turns wait for button input;
   * enemy turns fire after a short delay so the pacing is readable.
   */
  private pump(): void {
    if (this.battle.over) {
      this.showResult()
      return
    }
    const next = peekNext(this.battle.queue)
    if (!next) return

    this.currentActorId = next.actorId
    this.render()

    if (next.side === 'enemy') {
      this.busy = true
      this.actionPrompt.setText(`${this.battle.actors[next.actorId]?.name ?? next.actorId} is acting…`)
      this.time.delayedCall(ENEMY_DELAY, () => {
        this.busy = false
        if (this.battle.over) return
        const actor = this.battle.actors[next.actorId]
        if (!actor || actor.ko) {
          this.pump()
          return
        }
        this.dispatch(chooseEnemyAction(this.battle, next.actorId, this.rng))
      })
    } else {
      this.busy = false
    }
  }

  private dispatch(action: BattleAction): void {
    if (!this.currentActorId || this.battle.over) return
    const snap = snapshotVitals(this.battle)
    const consumed = action.kind === 'item' && action.itemId ? action.itemId : undefined
    performAction(this.battle, this.currentActorId, action, this.rng)
    if (consumed) mutate((p) => removeItem(p, consumed, 1))
    const deltas = diffVitals(snap, this.battle)
    this.currentActorId = null
    this.render()
    this.spawnFloats(deltas)
    this.actionButtons.forEach((b) => b.destroy())
    this.actionButtons = []
    this.pump()
  }

  private render(): void {
    this.renderQueue()
    this.renderCards()
    this.renderLog()
    this.renderActions()
  }

  // ---------------------------------------------------------------- cards

  private renderCards(): void {
    this.enemyCards.forEach((c) => c.destroy(true))
    this.partyCards.forEach((c) => c.destroy(true))
    this.enemyCards = []
    this.partyCards = []
    this.cardCenters.clear()

    const enemies = Object.values(this.battle.actors).filter((a) => a.side === 'enemy')
    const party = Object.values(this.battle.actors).filter((a) => a.side === 'player')

    enemies.forEach((actor, i) => {
      const x = this.enemyCardsX + i * (CARD_ENEMY_W + CARD_GAP)
      this.enemyCards.push(this.buildCard(actor, x, this.enemyRowY, CARD_ENEMY_W))
    })
    party.forEach((actor, i) => {
      const x = this.partyCardsX + i * (CARD_PARTY_W + CARD_GAP)
      this.partyCards.push(this.buildCard(actor, x, this.partyRowY, CARD_PARTY_W))
    })
  }

  private buildCard(actor: BattleActor, x: number, y: number, w: number): Phaser.GameObjects.Container {
    const t = THEME.colors
    const card = this.add.container(x, y)
    this.root.add(card)

    makePanel(this, 0, 0, w, CARD_H, {}, card)

    if (actor.id === this.currentActorId) {
      const ring = this.add
        .rectangle(w / 2, CARD_H / 2, w, CARD_H, 0x000000, 0)
        .setStrokeStyle(2, t.gold)
        .setRounded(8)
      card.add(ring)
    }

    const nameColor = actor.side === 'enemy' ? t.accent : t.text
    const name = uiText(this, 8, 6, truncate(actor.name, 16), { size: 'sm', color: nameColor, family: 'display' }, card)
    name.setOrigin(0, 0)
    if (actor.defending) {
      makeBadge(this, w - 40, 6, 'DEF', colorHex(t.accentBlue), { width: 32, height: 18 }, card)
    }

    const sideLabel = actor.side === 'enemy' ? 'Enemy' : 'Player'
    const sub = uiText(this, 8, 22, sideLabel, { size: 'xs', color: t.textMuted }, card)
    sub.setOrigin(0, 0)

    this.buildHpBar(actor, w, card)
    if ((actor.maxMp ?? 0) > 0) this.buildMpBar(actor, w, card)

    this.buildStatusIcons(actor, card)

    this.cardCenters.set(actor.id, { x: x + w / 2, y: y + CARD_H / 2 })

    if (this.pendingItem) {
      const sideOk =
        this.pendingItem.targetSide === 'ally' ? actor.side === 'player' : actor.side === 'enemy'
      if (sideOk && !actor.ko) {
        card.setSize(w, CARD_H)
        card.setInteractive({ useHandCursor: true })
        card.on('pointerdown', () => this.onPickTarget(actor.id))
      }
    }

    if (actor.ko) {
      const veil = this.add.rectangle(w / 2, CARD_H / 2, w, CARD_H, 0x000000, 0.55).setRounded(8)
      const ko = uiText(this, 0, 0, 'K.O.', { size: 'lg', color: t.bad, family: 'display', align: 'center' }, card)
      ko.setOrigin(0.5).setPosition(w / 2, CARD_H / 2)
      card.add([veil, ko])
    }

    return card
  }

  private buildHpBar(actor: BattleActor, w: number, card: Phaser.GameObjects.Container): void {
    const maxHp = actor.stats.hp
    const pct = maxHp > 0 ? Phaser.Math.Clamp(actor.hp / maxHp, 0, 1) : 0
    const color = pct > 0.5 ? THEME.colors.good : pct > 0.25 ? THEME.colors.warn : THEME.colors.bad
    makeSubpanel(this, card, 8, 34, w - 16, 8)
    const fillW = Math.max(0, Math.round((w - 16) * pct))
    const fill = this.add.rectangle(8, 34, fillW, 8, hexColor(color)).setOrigin(0, 0)
    card.add(fill)
    const label = uiText(this, w - 8, 44, `${actor.hp}/${maxHp}`, { size: 'xs', color: THEME.colors.text }, card)
    label.setOrigin(1, 0)
  }

  private buildMpBar(actor: BattleActor, w: number, card: Phaser.GameObjects.Container): void {
    const maxMp = actor.maxMp!
    const pct = maxMp > 0 ? Phaser.Math.Clamp(actor.mp / maxMp, 0, 1) : 0
    makeSubpanel(this, card, 8, 46, w - 16, 6)
    const fillW = Math.max(0, Math.round((w - 16) * pct))
    const fill = this.add.rectangle(8, 46, fillW, 6, THEME.colors.accentBlue).setOrigin(0, 0)
    card.add(fill)
    const label = uiText(this, w - 8, 52, `${actor.mp}/${maxMp}`, { size: 'xs', color: THEME.colors.textMuted }, card)
    label.setOrigin(1, 0)
  }

  private buildStatusIcons(actor: BattleActor, card: Phaser.GameObjects.Container): void {
    const tones: Record<string, string> = {
      good: THEME.colors.good,
      warn: THEME.colors.warn,
      bad: THEME.colors.bad,
      info: colorHex(THEME.colors.accentBlue),
    }
    const icons = actor.statuses.slice(0, 5).map(statusIcon)
    let px = 8
    for (const icon of icons) {
      const badge = makeBadge(this, px, 58, icon.label, tones[icon.tone] ?? THEME.colors.textMuted, { height: 18 }, card)
      px += badge.width + 4
    }
  }

  // ---------------------------------------------------------------- actions

  private renderActions(): void {
    this.actionButtons.forEach((b) => b.destroy())
    this.actionButtons = []

    const actor = this.currentActorId ? this.battle.actors[this.currentActorId] : undefined
    if (!actor || this.busy) {
      this.itemMode = false
      this.pendingItem = null
      this.actionPrompt.setText(this.busy ? 'Enemy acting…' : '')
      return
    }

    if (actor.side !== 'player') {
      this.itemMode = false
      this.pendingItem = null
      return
    }

    const { pad } = THEME.spacing
    const btnW = 120
    const btnH = THEME.button.height
    let bx = pad
    let by = 40
    const addButton = (label: string, onClick: () => void, enabled = true): void => {
      if (bx + btnW > ACTION_PANEL_W - pad) {
        bx = pad
        by += btnH + 8
      }
      const btn = makeButton(this, bx, by, label, onClick, { width: btnW, height: btnH }, this.actionPanel)
      btn.setDisabled(!enabled)
      this.actionButtons.push(btn)
      bx += btnW + 8
    }

    if (this.pendingItem) {
      const item = getItem(this.pendingItem.itemId)
      this.actionPrompt.setText(`Choose a target for ${item.name}.`)
      addButton('Cancel', () => {
        this.pendingItem = null
        this.render()
      })
      return
    }

    if (this.itemMode) {
      this.actionPrompt.setText('Choose an item.')
      for (const entry of getProfile().inventory.items) {
        if (entry.count <= 0) continue
        const item = getItem(entry.itemId)
        if (!item.use && !item.castSkill) continue
        addButton(`×${entry.count} ${truncate(item.name, 10)}`, () => this.selectItem(entry.itemId))
      }
      addButton('Cancel', () => {
        this.itemMode = false
        this.render()
      })
      return
    }

    this.actionPrompt.setText(`${actor.name} — choose an action.`)

    const hasItems = getProfile().inventory.items.some((entry) => {
      if (entry.count <= 0) return false
      const item = getItem(entry.itemId)
      return !!item.use || !!item.castSkill
    })
    const actions: { kind: BattleAction['kind']; skillId?: string; label: string; enabled: boolean }[] = [
      { kind: 'attack', label: 'Attack', enabled: true },
      { kind: 'defend', label: 'Defend', enabled: true },
      { kind: 'item', label: 'Item', enabled: hasItems },
    ]
    for (const skillId of (actor.skills ?? []).slice(0, 6)) {
      const skill = getSkill(skillId)
      const onCooldown = (actor.cooldowns?.[skillId] ?? 0) > 0
      const affordable = actor.mp >= skill.cost
      actions.push({ kind: 'skill', skillId, label: skill.name, enabled: !onCooldown && affordable })
    }

    for (const a of actions) {
      addButton(
        truncate(a.label, 14),
        () => {
          if (a.kind === 'item') {
            this.itemMode = true
            this.render()
          } else {
            this.dispatch({ kind: a.kind, skillId: a.skillId })
          }
        },
        a.enabled,
      )
    }
  }

  /** Opens targeting for an item, or uses it directly when no target is needed. */
  private selectItem(itemId: string): void {
    const item = getItem(itemId)
    const skill = item.castSkill ? getSkill(item.castSkill) : undefined
    if (skill && skill.targets !== 'single') {
      this.dispatchItem(itemId)
      return
    }
    const targetSide = skill
      ? skill.kind === 'damage' || skill.kind === 'debuff'
        ? 'enemy'
        : 'ally'
      : 'ally'
    this.pendingItem = { itemId, targetSide }
    this.render()
  }

  private onPickTarget(targetId: string): void {
    const item = this.pendingItem
    if (!item) return
    this.dispatchItem(item.itemId, targetId)
  }

  private dispatchItem(itemId: string, targetId?: string): void {
    this.pendingItem = null
    this.itemMode = false
    this.dispatch({ kind: 'item', itemId, targetId })
  }

  // ---------------------------------------------------------------- queue

  private renderQueue(): void {
    this.queueChips.forEach((c) => c.destroy(true))
    this.queueChips = []

    const t = THEME.colors
    const entries = this.battle.queue.slice(0, 9)
    let px = THEME.spacing.pad + 4

    for (const entry of entries) {
      const isFront = entry.actorId === this.currentActorId
      const chip = this.add.container(0, 0)

      const side = entry.side === 'player' ? 'P' : 'E'
      const sideColor = entry.side === 'player' ? hexColor(t.textOnAccent) : t.accent
      const tag = this.add.rectangle(12, 13, 20, 22, sideColor).setRounded(4)
      chip.add(tag)
      const tagText = uiText(this, 0, 0, side, { size: 'xs', color: '#000000' }, chip)
      tagText.setOrigin(0.5).setPosition(12, 13)

      const actor = this.battle.actors[entry.actorId]
      const label = uiText(this, 24, 5, truncate(actor?.name ?? entry.actorId, 10), { size: 'xs', color: isFront ? t.gold : t.text }, chip)

      const chipW = Math.max(72, tagText.width + label.width + 32)
      const chipBg = this.add
        .rectangle(chipW / 2, 13, chipW, 26, 0x000000, isFront ? 0.3 : 0.18)
        .setStrokeStyle(1, isFront ? t.gold : t.border, 0.6)
        .setRounded(5)
      chip.addAt(chipBg, 0)

      chip.setPosition(px, 4)
      chip.setSize(chipW, 26)
      this.queueStrip.add(chip)
      this.queueChips.push(chip)
      px += chipW + 5
    }
  }

  // ---------------------------------------------------------------- log

  private renderLog(): void {
    const limit = 12
    const lines = this.battle.log.slice(-limit)
    this.logRegion.content.removeAll(true)
    let y = 0
    for (const entry of lines) {
      const text = uiText(this, 0, y, `${entry.turn}. ${entry.text}`, { size: 'xs', color: THEME.colors.text }, this.logRegion.content)
      text.setOrigin(0, 0)
      y += 14
    }
    this.logRegion.setContentHeight(y)
  }

  // ---------------------------------------------------------------- floats

  private spawnFloats(deltas: { actorId: string; hpDelta: number; mpDelta: number }[]): void {
    const t = THEME.colors
    for (const d of deltas) {
      const center = this.cardCenters.get(d.actorId)
      if (!center) continue
      const parts: string[] = []
      const colors: string[] = []
      if (d.hpDelta > 0) {
        parts.push(`+${d.hpDelta}`)
        colors.push(t.good)
      } else if (d.hpDelta < 0) {
        parts.push(`${d.hpDelta}`)
        colors.push(t.bad)
      }
      if (d.mpDelta > 0) {
        parts.push(`MP +${d.mpDelta}`)
        colors.push(colorHex(t.accentBlue))
      } else if (d.mpDelta < 0) {
        parts.push(`MP ${d.mpDelta}`)
        colors.push(colorHex(t.accentBlue))
      }
      if (parts.length === 0) continue

      let y = center.y
      parts.forEach((part, i) => {
        const float = uiText(this, center.x, y, part, { size: 'md', color: colors[i] ?? t.text, family: 'display', align: 'center' }, this.root)
        float.setOrigin(0.5).setDepth(100)
        this.tweens.add({
          targets: float,
          y: y - 46,
          alpha: 0,
          duration: FLOAT_LIFETIME,
          onComplete: () => float.destroy(),
        })
        y += 18
      })
    }
  }

  // ---------------------------------------------------------------- result

  private showResult(): void {
    const result = getBattleResult(this.battle)
    const t = THEME.colors

    const panelW = 460
    const panelH = 320
    const dim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.6).setOrigin(0)
    this.root.add(dim)

    const panel = makePanel(this, (this.scale.width - panelW) / 2, (this.scale.height - panelH) / 2, panelW, panelH, {}, this.root)
    const titleColor = result.status === 'won' ? t.gold : result.status === 'lost' ? t.bad : t.textMuted
    const titleText = result.status === 'won' ? 'Victory!' : result.status === 'lost' ? 'Defeat' : 'Fled the battle'

    const title = uiText(this, 0, 0, titleText, { size: 'xl', color: titleColor, family: 'display', align: 'center', letterSpacing: 2 }, panel)
    title.setOrigin(0.5).setPosition(panelW / 2, 40)

    let lineY = 84
    const summary =
      result.status === 'won'
        ? 'The enemy party is defeated.'
        : result.status === 'lost'
          ? 'Your party has been wiped out.'
          : 'Your party fled.'
    let line = uiText(this, 0, 0, summary, { size: 'sm', color: t.text, align: 'center' }, panel)
    line.setOrigin(0.5).setPosition(panelW / 2, lineY)
    lineY += 24

    const koNames = result.koIds.map((id) => this.battle.actors[id]?.name ?? id)
    const survivorNames = result.survivors.map((id) => this.battle.actors[id]?.name ?? id)

    line = uiText(this, 0, 0, `Lost: ${koNames.join(', ') || 'none'}`, { size: 'xs', color: t.bad, align: 'center' }, panel)
    line.setOrigin(0.5).setPosition(panelW / 2, lineY)
    lineY += 18
    line = uiText(this, 0, 0, `Survived: ${survivorNames.join(', ') || 'none'}`, { size: 'xs', color: t.good, align: 'center' }, panel)
    line.setOrigin(0.5).setPosition(panelW / 2, lineY)
    lineY += 18
    line = uiText(this, 0, 0, `Seed ${this.seed}`, { size: 'xs', color: t.textMuted, align: 'center' }, panel)
    line.setOrigin(0.5).setPosition(panelW / 2, lineY)

    if (this.returnTo) {
      makeButton(this, (panelW - 155) / 2, 250, 'Continue', () => this.returnResult(result), { width: 155 }, panel)
    } else {
      makeButton(this, 60, 250, 'Retry (new seed)', () => this.scene.restart({}), { width: 155 }, panel)
      makeButton(this, 245, 250, 'Back to Base', () => this.scene.start('MetaScene'), { width: 155 }, panel)
    }
  }

  /**
   * Hands the battle result back to the owning scene (the run map) so the
   * run layer can apply rewards, permadeath and the next checkpoint.
   */
  private returnResult(result: BattleResult): void {
    if (!this.returnTo) return
    this.scene.start(this.returnTo, { battleResult: result })
  }
}
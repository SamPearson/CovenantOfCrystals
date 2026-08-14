import Phaser from 'phaser'
import { THEME, colorHex, setTheme } from '../ui/theme'
import { initThemes, getActiveTheme, themesEqual, subscribeThemes } from '../../core/themes'
import { uiText, makeButton, type Button } from '../ui/widgets'
import { STONE_BG_KEY, createStoneTextures } from '../ui/textures'
import { showThemeEditor, hideThemeEditor } from '../ui/theme-editor'
import { BoxesPanel } from '../ui/panels/boxes-panel'
import { PartyPanel } from '../ui/panels/party-panel'
import { EquipPanel } from '../ui/panels/equip-panel'
import { InventoryPanel } from '../ui/panels/inventory-panel'
import type { Panel } from '../ui/panels/panel'
import { initStore, getProfile, subscribe } from '../../core/store'

type PanelId = 'boxes' | 'party' | 'equip' | 'inventory' | 'theme'

const TAB_IDS: PanelId[] = ['boxes', 'party', 'equip', 'inventory', 'theme']
const TAB_LABELS: Record<PanelId, string> = {
  boxes: 'Boxes',
  party: 'Party',
  equip: 'Equip',
  inventory: 'Inventory',
  theme: 'Theme',
}

/**
 * Persists the active tab across scene restarts (a theme change restarts the
 * scene to re-render everything; staying on the Theme tab keeps the editor
 * overlay open).
 */
let lastActiveTab: PanelId = 'boxes'

export class MetaScene extends Phaser.Scene {
  private panels!: Record<Exclude<PanelId, 'theme'>, Panel>
  private tabButtons: Button[] = []
  private active: PanelId = 'boxes'
  private headerGold!: Phaser.GameObjects.Text
  private headerProfile!: Phaser.GameObjects.Text
  private unsubscribe: (() => void) | null = null
  private themeUnsubscribe: (() => void) | null = null
  private themeTimer: Phaser.Time.TimerEvent | null = null

  constructor() {
    super('MetaScene')
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

    // Deep-green header band (title + gold + profile sit on it).
    const headerH = THEME.header.height
    this.add.rectangle(width / 2, headerH / 2, width, headerH, THEME.colors.panel).setOrigin(0.5)
    this.add
      .rectangle(width / 2, headerH - 1, width, 1, THEME.colors.borderLight, 0.3)
      .setOrigin(0.5, 0.5)

    uiText(this, THEME.spacing.pad, 10, 'Covenant of Crystals', {
      size: 'xl',
      color: THEME.colors.gold,
      family: 'display',
      letterSpacing: 2,
    })
    this.headerGold = uiText(this, width - THEME.spacing.pad, 8, '', {
      size: 'md',
      color: THEME.colors.gold,
      family: 'display',
    }).setOrigin(1, 0)
    this.headerProfile = uiText(
      this,
      width - THEME.spacing.pad,
      28,
      '',
      { size: 'sm', color: THEME.colors.borderLight },
    ).setOrigin(1, 0)

    makeButton(
      this,
      width / 2 - 75,
      8,
      'Test Battle',
      () => this.scene.start('BattleScene'),
      { width: 150, height: 32 },
    )

    const contentRect = {
      x: 10,
      y: THEME.header.height + THEME.tabs.height + 6,
      w: width - 20,
      h: height - (THEME.header.height + THEME.tabs.height + 6) - 10,
    }

    this.panels = {
      boxes: new BoxesPanel(this, contentRect, {
        onEquipCharacter: (charId: string) => this.openEquip(charId),
      }),
      party: new PartyPanel(this, contentRect),
      equip: new EquipPanel(this, contentRect),
      inventory: new InventoryPanel(this, contentRect),
    }

    this.unsubscribe = subscribe(() => {
      this.updateHeader()
      if (this.active !== 'theme') this.panels[this.active].refresh()
    })

    this.themeUnsubscribe = subscribeThemes(() => this.scheduleThemeApply())

    this.active = lastActiveTab
    this.showTab(this.active)
  }

  shutdown(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.themeUnsubscribe?.()
    this.themeUnsubscribe = null
    this.themeTimer?.remove(false)
    this.themeTimer = null
    for (const button of this.tabButtons) button.destroy()
    this.tabButtons = []
    for (const panel of Object.values(this.panels)) panel.destroy()
  }

  private openEquip(charId: string): void {
    ;(this.panels.equip as EquipPanel).setSelection(charId)
    this.showTab('equip')
  }

  private showTab(id: PanelId): void {
    this.active = id
    lastActiveTab = id
    const isTheme = id === 'theme'
    for (const key of Object.keys(this.panels) as Exclude<PanelId, 'theme'>[]) {
      this.panels[key].container.setVisible(key === id)
    }
    if (isTheme) showThemeEditor()
    else hideThemeEditor()
    this.buildTabs(id)
    this.updateHeader()
    if (!isTheme) this.panels[id].refresh()
  }

  private buildTabs(active: PanelId): void {
    for (const button of this.tabButtons) button.destroy()
    this.tabButtons = []
    let x = THEME.spacing.pad
    const y = THEME.header.height + 4
    for (const id of TAB_IDS) {
      const isActive = id === active
      const button = makeButton(
        this,
        x,
        y,
        TAB_LABELS[id],
        () => this.showTab(id),
        {
          width: 108,
          height: THEME.tabs.height - 8,
          color: isActive ? THEME.colors.accent : THEME.colors.accentBlue,
          labelColor: isActive ? THEME.colors.textOnAccent : colorHex(THEME.colors.borderLight),
        },
      )
      this.tabButtons.push(button)
      x += 116
    }
  }

  private updateHeader(): void {
    const profile = getProfile()
    this.headerGold.setText(`${profile.gold} gold`)
    this.headerProfile.setText(profile.displayName)
  }

  /**
   * Applies the active profile's colors to `THEME` and re-renders the scene.
   * Debounced so rapid color edits (native pickers fire `input` continuously)
   * coalesce into a single restart. Rename-only changes are skipped (colors
   * are unchanged), so typing a name never tears down the scene.
   */
  private scheduleThemeApply(): void {
    const next = getActiveTheme()
    if (themesEqual(THEME, next)) return
    setTheme(next)
    if (this.themeTimer) this.themeTimer.remove(false)
    this.themeTimer = this.time.delayedCall(150, () => {
      this.themeTimer = null
      // Don't rebuild textures here: createStoneTextures() destroys the
      // textures still referenced by this live scene, and scene.restart()
      // only takes effect on the next Scene Manager update. Rendering the
      // old scene in between then crashes on a destroyed frame (frame.source
      // is null). The restarted scene's create() rebuilds them instead.
      this.scene.restart()
    })
  }
}

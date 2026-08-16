import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeButton, makeSubpanel, type Button } from '../widgets'
import { durabilityLabel, itemTypeLabel, truncate } from '../format'
import { getProfile, mutate } from '../../../core/store'
import { canBuyItem, buyItem, canSellItem, sellItem } from '../../../core/shop/shop'
import { getItem } from '../../../core'
import type { ItemDef } from '../../../core/types'

/**
 * Phase 3 M7 shop tab (decision S10/S12): always-on potions plus the rotating
 * gear and skill stock on the left, and the owned gear that can be sold back
 * on the right. Buying/selling goes through the pure core guards inside
 * `mutate()`, matching the pattern established by the other meta panels.
 */
export class ShopPanel extends Panel {
  private message: string | null = null

  refresh(): void {
    const content = this.rebuild()
    const profile = getProfile()
    const pad = THEME.spacing.pad
    const rowH = 34
    const gap = 3
    const btnW = 84
    const btnH = 26
    const colW = (this.rect.w - pad * 3) / 2
    const listY = pad

    uiText(this.scene, pad, listY - 2, 'FOR SALE', { size: 'xs', color: THEME.colors.accentBlue }, content)

    const stockItems: ItemDef[] = [
      ...profile.shop.always.map((id) => getItem(id)),
      ...profile.shop.rotating.gear.map((id) => getItem(id)),
      ...profile.shop.rotating.skills.map((id) => getItem(id)),
    ]

    let ry = listY + 16
    for (const item of stockItems) {
      const check = canBuyItem(profile, item.id)
      makeSubpanel(this.scene, content, pad, ry, colW, rowH)
      const name = uiText(
        this.scene,
        pad + 8,
        ry + 8,
        truncate(item.name, 22),
        { size: 'sm', color: THEME.rarity[item.rarity] },
        content,
      )
      uiText(
        this.scene,
        pad + 8 + name.width + 10,
        ry + 10,
        itemTypeLabel(item.type),
        { size: 'xs', color: THEME.colors.textMuted },
        content,
      )
      const button: Button = makeButton(
        this.scene,
        pad + colW - btnW - 6,
        ry + 4,
        `Buy ${check.price} gold`,
        () => {
          try {
            mutate((p) => {
              const result = buyItem(p, item.id)
              this.message = result.ok ? `Purchased ${item.name} for ${result.price} gold` : (result.error ?? 'Cannot buy')
            })
          } catch (error) {
            this.message = (error as Error).message
          }
          this.refresh()
        },
        { width: btnW, height: btnH },
        content,
      )
      if (!check.ok) button.setDisabled(true)
      ry += rowH + gap
    }

    const sellX = pad * 2 + colW
    uiText(this.scene, sellX, listY - 2, 'SELL GEAR', { size: 'xs', color: THEME.colors.accentBlue }, content)

    const equippedBy = new Map<string, string>()
    for (const char of Object.values(profile.characters)) {
      for (const g of [char.gear.weapon, char.gear.armor]) {
        if (g) equippedBy.set(g.id, char.name)
      }
    }

    let sy = listY + 16
    for (const g of profile.inventory.gear) {
      const item = getItem(g.itemId)
      const check = canSellItem(profile, g.id)
      const onChar = equippedBy.get(g.id)
      makeSubpanel(this.scene, content, sellX, sy, colW, rowH)
      const name = uiText(
        this.scene,
        sellX + 8,
        sy + 8,
        truncate(item.name, 16),
        { size: 'sm', color: THEME.rarity[item.rarity] },
        content,
      )
      uiText(
        this.scene,
        sellX + 8 + name.width + 10,
        sy + 10,
        `${durabilityLabel(g.durability)}${onChar ? ` · on ${truncate(onChar, 10)}` : ''}`,
        { size: 'xs', color: THEME.colors.textMuted },
        content,
      )
      const button: Button = makeButton(
        this.scene,
        sellX + colW - btnW - 6,
        sy + 4,
        `Sell ${check.price} gold`,
        () => {
          try {
            mutate((p) => {
              const result = sellItem(p, g.id)
              this.message = result.ok ? `Sold ${item.name} for ${result.price} gold` : (result.error ?? 'Cannot sell')
            })
          } catch (error) {
            this.message = (error as Error).message
          }
          this.refresh()
        },
        { width: btnW, height: btnH },
        content,
      )
      if (!check.ok || onChar) button.setDisabled(true)
      sy += rowH + gap
    }

    if (this.message) {
      uiText(
        this.scene,
        this.rect.w - pad,
        this.rect.h - 20,
        this.message,
        { size: 'xs', color: THEME.colors.good },
        content,
      ).setOrigin(1, 1)
    }
  }
}
import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeButton, makeSubpanel, type Button } from '../widgets'
import { attachTooltip } from '../tooltip'
import { durabilityLabel, itemTypeLabel, truncate } from '../format'
import { getProfile, mutate } from '../../../core/store'
import { canBuyItem, buyItem, canSellItem, sellItem } from '../../../core/shop/shop'
import { getItem } from '../../../core'
import { describeItem } from '../../../core/tooltips'
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
    const gap = 2
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

    // Stock runs two-across (potions, stat-shots, gear, skills) so the
    // always-on items fit without needing to scroll the panel.
    const cellGap = 4
    const cellW = (colW - cellGap) / 2
    stockItems.forEach((item, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const cx = pad + col * (cellW + cellGap)
      const ry = listY + 16 + row * (rowH + gap)
      const check = canBuyItem(profile, item.id)
      makeSubpanel(this.scene, content, cx, ry, cellW, rowH)
      const hit = this.scene.add.rectangle(cx, ry, cellW, rowH, 0x000000, 0)
      hit.setOrigin(0)
      hit.setInteractive({ useHandCursor: false })
      content.add(hit)
      attachTooltip(this.scene, hit, () => describeItem(item))
      uiText(
        this.scene,
        cx + 6,
        ry + 7,
        truncate(item.name, 15),
        { size: 'sm', color: THEME.rarity[item.rarity] },
        content,
      )
      uiText(
        this.scene,
        cx + 6,
        ry + 22,
        itemTypeLabel(item.type),
        { size: 'xs', color: THEME.colors.textMuted },
        content,
      )
      const button: Button = makeButton(
        this.scene,
        cx + cellW - btnW - 4,
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
        { width: btnW, height: btnH, fontSize: 'xs' },
        content,
      )
      if (!check.ok) button.setDisabled(true)
    })

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
      const hit = this.scene.add.rectangle(sellX, sy, colW, rowH, 0x000000, 0)
      hit.setOrigin(0)
      hit.setInteractive({ useHandCursor: false })
      content.add(hit)
      attachTooltip(this.scene, hit, () => describeItem(item, { equippedBy: onChar }))
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
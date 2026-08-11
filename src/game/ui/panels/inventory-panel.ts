import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeSubpanel } from '../widgets'
import { durabilityLabel, itemTypeLabel } from '../format'
import { getProfile } from '../../../core/store'
import { getItem } from '../../../core'

export class InventoryPanel extends Panel {
  refresh(): void {
    const content = this.rebuild()
    const profile = getProfile()
    const pad = THEME.spacing.pad

    const equippedBy = new Map<string, string>()
    for (const char of Object.values(profile.characters)) {
      for (const g of [char.gear.weapon, char.gear.armor]) {
        if (g) equippedBy.set(g.id, char.name)
      }
    }

    const colW = (this.rect.w - pad * 3) / 2
    const colY = pad
    const rowH = 40

    uiText(this.scene, pad, colY - 2, 'GEAR INSTANCES', { size: 'xs', color: THEME.colors.accent }, content)
    let gy = colY + 18
    for (const g of profile.inventory.gear) {
      const item = getItem(g.itemId)
      const onChar = equippedBy.get(g.id)
      makeSubpanel(this.scene, content, pad, gy, colW, rowH)
      uiText(
        this.scene,
        pad + 8,
        gy + 6,
        item.name,
        { size: 'sm', color: THEME.rarity[item.rarity] },
        content,
      )
      uiText(
        this.scene,
        pad + 8,
        gy + 22,
        `${itemTypeLabel(item.type)} · ${durabilityLabel(g.durability)}${onChar ? ` · equipped by ${onChar}` : ' · unequipped'}`,
        { size: 'xs', color: THEME.colors.textMuted },
        content,
      )
      gy += rowH + 4
    }

    const itemsX = pad * 2 + colW
    const itemsY = pad
    uiText(this.scene, itemsX, itemsY - 2, 'CONSUMABLES & TOMES', { size: 'xs', color: THEME.colors.accent }, content)
    let iy = itemsY + 18
    for (const entry of profile.inventory.items) {
      const item = getItem(entry.itemId)
      makeSubpanel(this.scene, content, itemsX, iy, colW, rowH)
      uiText(this.scene, itemsX + 8, iy + 6, item.name, { size: 'sm' }, content)
      uiText(
        this.scene,
        itemsX + colW - 8,
        iy + 6,
        `×${entry.count}`,
        { size: 'sm', color: THEME.colors.textMuted },
        content,
      ).setOrigin(1, 0)
      uiText(
        this.scene,
        itemsX + 8,
        iy + 22,
        `${itemTypeLabel(item.type)} · ${item.value} gold`,
        { size: 'xs', color: THEME.colors.textMuted },
        content,
      )
      iy += rowH + 4
    }
  }
}

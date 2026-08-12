import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeButton, makeSubpanel } from '../widgets'
import { durabilityLabel, itemTypeLabel, statDeltaText, truncate } from '../format'
import { getProfile, mutate } from '../../../core/store'
import { equipGear, unequipSlot, gearStatDeltas, type StatDelta } from '../../../core/equip'
import { getClass, getItem, derivedStats, type PlayerProfile, type StatKey } from '../../../core'

const STAT_ORDER: StatKey[] = ['hp', 'atk', 'def', 'mag', 'res', 'spd']

function absoluteBonuses(bonus: Partial<Record<StatKey, number>> | undefined): StatDelta[] {
  const out: StatDelta[] = []
  for (const key of STAT_ORDER) {
    const value = bonus?.[key] ?? 0
    if (value !== 0) out.push({ key, delta: value })
  }
  return out
}

function listCharacters(profile: PlayerProfile): string[] {
  const ids: string[] = []
  for (const id of profile.party) {
    if (profile.characters[id] && !ids.includes(id)) ids.push(id)
  }
  for (const box of profile.boxes) {
    for (const id of box.slots) {
      if (id && profile.characters[id] && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

export class EquipPanel extends Panel {
  private selected: string | null = null
  private message: string | null = null

  setSelection(charId: string): void {
    this.selected = charId
    this.message = null
  }

  refresh(): void {
    const content = this.rebuild()
    const profile = getProfile()
    const pad = THEME.spacing.pad

    const listW = 200
    const listX = pad
    const listY = pad

    uiText(this.scene, listX, listY - 2, 'CHARACTERS', { size: 'xs', color: THEME.colors.accentBlue }, content)
    const rowH = 34
    let ry = listY + 18
    for (const charId of listCharacters(profile)) {
      const c = profile.characters[charId]
      const cls = getClass(c.classId)
      const isSelected = charId === this.selected
      makeSubpanel(this.scene, content, listX, ry, listW, rowH, {
        strokeColor: isSelected ? THEME.colors.accent : THEME.colors.border,
      })
      const label = `${truncate(c.name, 12)}  ${cls.name[0]!.toUpperCase()}${c.level}`
      uiText(this.scene, listX + 8, ry + 9, label, { size: 'xs' }, content)
      const hit = this.scene.add.rectangle(listX + listW / 2, ry + rowH / 2, listW, rowH, 0x000000, 0)
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = this.selected === charId ? null : charId
        this.refresh()
      })
      content.add(hit)
      ry += rowH + 4
    }

    const centerX = listX + listW + 16
    const centerW = 300

    if (this.selected && profile.characters[this.selected]) {
      const charId = this.selected
      const c = profile.characters[charId]
      const cls = getClass(c.classId)
      const stats = derivedStats(c)

      uiText(this.scene, centerX, listY - 2, 'EQUIPMENT', { size: 'xs', color: THEME.colors.accentBlue }, content)
      uiText(this.scene, centerX, listY + 14, `${c.name} — ${cls.name} Lv ${c.level}`, { size: 'md' }, content)

      let sy = listY + 44
      for (const slot of ['weapon', 'armor'] as const) {
        const g = c.gear[slot]
        makeSubpanel(this.scene, content, centerX, sy, centerW, 56)
        uiText(this.scene, centerX + 8, sy + 6, slot.toUpperCase(), { size: 'xs', color: THEME.colors.textMuted }, content)
        if (g) {
          const item = getItem(g.itemId)
          uiText(
            this.scene,
            centerX + 8,
            sy + 24,
            item.name,
            { size: 'sm', color: THEME.rarity[item.rarity] },
            content,
          )
          uiText(
            this.scene,
            centerX + 8 + 90,
            sy + 27,
            `(${durabilityLabel(g.durability)})`,
            { size: 'xs', color: THEME.colors.textMuted },
            content,
          )
          makeButton(
            this.scene,
            centerX + centerW - 84,
            sy + 12,
            'Unequip',
            () => {
              try {
                mutate((p) => {
                  unequipSlot(p, charId, slot)
                })
                this.message = null
              } catch (err) {
                this.message = (err as Error).message
                this.refresh()
              }
            },
            { width: 76, height: 30, color: THEME.colors.accentDark },
            content,
          )
        } else {
          uiText(this.scene, centerX + 8, sy + 24, '— empty —', { size: 'sm', color: THEME.colors.textDim }, content)
        }
        sy += 64
      }

      const statLine = ['hp', 'atk', 'def', 'mag', 'res', 'spd']
        .map((k) => `${k.toUpperCase()} ${stats[k as keyof typeof stats]}`)
        .join('  ')
      uiText(this.scene, centerX, sy + 2, statLine, { size: 'xs', color: THEME.colors.textMuted, wordWrap: centerW }, content)
    } else {
      uiText(
        this.scene,
        centerX,
        listY + 20,
        'Select a character on the left.',
        { size: 'sm', color: THEME.colors.textMuted },
        content,
      )
    }

    const gearX = centerX + centerW + 16
    const gearW = this.rect.w - gearX - pad
    uiText(this.scene, gearX, listY - 2, 'INVENTORY GEAR', { size: 'xs', color: THEME.colors.accentBlue }, content)

    const gearRowH = 56
    let gy = listY + 18
    const equippedBy = new Map<string, string>()
    for (const char of Object.values(profile.characters)) {
      for (const g of [char.gear.weapon, char.gear.armor]) {
        if (g) equippedBy.set(g.id, char.name)
      }
    }

    for (const g of profile.inventory.gear) {
      const item = getItem(g.itemId)
      const onChar = equippedBy.get(g.id)
      makeSubpanel(this.scene, content, gearX, gy, gearW, gearRowH)
      uiText(
        this.scene,
        gearX + 8,
        gy + 6,
        item.name,
        { size: 'sm', color: THEME.rarity[item.rarity] },
        content,
      )
      uiText(
        this.scene,
        gearX + 8,
        gy + 22,
        `${itemTypeLabel(item.type)} · ${durabilityLabel(g.durability)}${onChar ? ` · on ${onChar}` : ''}`,
        { size: 'xs', color: THEME.colors.textMuted },
        content,
      )

      const selectedChar = this.selected ? profile.characters[this.selected] : null
      const deltas = selectedChar
        ? gearStatDeltas(selectedChar, item.id)
        : absoluteBonuses(item.statBonus)
      if (deltas.length > 0) {
        let sx = gearX + 8
        for (const d of deltas) {
          const color =
            d.delta > 0 ? THEME.colors.good : d.delta < 0 ? THEME.colors.bad : THEME.colors.textMuted
          const txt = uiText(this.scene, sx, gy + 38, statDeltaText(d.delta, d.key), { size: 'xs', color }, content)
          sx += txt.width + 10
        }
      } else {
        uiText(
          this.scene,
          gearX + 8,
          gy + 38,
          'No stat change',
          { size: 'xs', color: THEME.colors.textDim },
          content,
        )
      }

      if (!onChar) {
        const hit = this.scene.add.rectangle(gearX + gearW / 2, gy + gearRowH / 2, gearW, gearRowH, 0x000000, 0)
        hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (!this.selected) {
            this.message = 'Select a character first.'
            this.refresh()
            return
          }
          try {
            mutate((p) => equipGear(p, this.selected!, g.id))
            this.message = null
          } catch (err) {
            this.message = (err as Error).message
            this.refresh()
          }
        })
        content.add(hit)
      }
      gy += gearRowH + 4
    }

    if (this.message) {
      uiText(
        this.scene,
        this.rect.w - pad,
        this.rect.h - 20,
        this.message,
        { size: 'xs', color: THEME.colors.bad },
        content,
      ).setOrigin(1, 1)
    }
  }
}

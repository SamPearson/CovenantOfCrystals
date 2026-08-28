import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeButton, makeSubpanel } from '../widgets'
import { itemTypeLabel } from '../format'
import { applyStatShot, applyTome, getProfile, type ApplyItemResult } from '../../../core/store'
import { applyStatShot as previewStatShot } from '../../../core/items/apply'
import {
  getItem,
  getSkill,
  getClass,
  baseStatsFor,
  type PlayerProfile,
  type StatKey,
} from '../../../core'

const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  mag: 'MAG',
  res: 'RES',
  spd: 'SPD',
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

/** Inventory items that can be applied to a character (stat-shots + skill tomes). */
function applicableItems(profile: PlayerProfile): { itemId: string; count: number }[] {
  return profile.inventory.items
    .filter((entry) => {
      const item = getItem(entry.itemId)
      return item.type === 'stat-shot' || (item.type === 'tome' && !!item.grantsSkill)
    })
    .map((entry) => ({ itemId: entry.itemId, count: entry.count }))
}

export class ApplyPanel extends Panel {
  private selectedChar: string | null = null
  private selectedItem: string | null = null
  private message: string | null = null

  setSelection(charId: string): void {
    this.selectedChar = charId
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
      const isSelected = charId === this.selectedChar
      makeSubpanel(this.scene, content, listX, ry, listW, rowH, {
        strokeColor: isSelected ? THEME.colors.accent : THEME.colors.border,
      })
      const label = `${c.name}  ${cls.name[0]!.toUpperCase()}${c.level}`
      uiText(this.scene, listX + 8, ry + 9, label, { size: 'xs' }, content)
      const hit = this.scene.add.rectangle(listX + listW / 2, ry + rowH / 2, listW, rowH, 0x000000, 0)
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selectedChar = this.selectedChar === charId ? null : charId
        this.message = null
        this.refresh()
      })
      content.add(hit)
      ry += rowH + 4
    }

    const centerX = listX + listW + 16
    const centerW = 300
    uiText(this.scene, centerX, listY - 2, 'APPLICABLE ITEMS', { size: 'xs', color: THEME.colors.accentBlue }, content)
    const itemRowH = 40
    let iy = listY + 18
    const items = applicableItems(profile)
    if (items.length === 0) {
      uiText(
        this.scene,
        centerX,
        listY + 20,
        'No stat-shots or tomes in inventory.',
        { size: 'sm', color: THEME.colors.textMuted },
        content,
      )
    }
    for (const { itemId, count } of items) {
      const item = getItem(itemId)
      const isSelected = itemId === this.selectedItem
      makeSubpanel(this.scene, content, centerX, iy, centerW, itemRowH, {
        strokeColor: isSelected ? THEME.colors.accent : THEME.colors.border,
      })
      uiText(this.scene, centerX + 8, iy + 6, item.name, { size: 'sm' }, content)
      uiText(
        this.scene,
        centerX + centerW - 8,
        iy + 6,
        `×${count}`,
        { size: 'sm', color: THEME.colors.textMuted },
        content,
      ).setOrigin(1, 0)
      uiText(
        this.scene,
        centerX + 8,
        iy + 22,
        itemTypeLabel(item.type),
        { size: 'xs', color: THEME.colors.textMuted },
        content,
      )
      const hit = this.scene.add.rectangle(centerX + centerW / 2, iy + itemRowH / 2, centerW, itemRowH, 0x000000, 0)
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selectedItem = this.selectedItem === itemId ? null : itemId
        this.message = null
        this.refresh()
      })
      content.add(hit)
      iy += itemRowH + 4
    }

    const previewX = centerX + centerW + 16
    const previewW = this.rect.w - previewX - pad
    uiText(this.scene, previewX, listY - 2, 'PREVIEW', { size: 'xs', color: THEME.colors.accentBlue }, content)

    if (!this.selectedChar || !profile.characters[this.selectedChar]) {
      uiText(
        this.scene,
        previewX,
        listY + 20,
        'Select a character and an item.',
        { size: 'sm', color: THEME.colors.textMuted },
        content,
      )
      return
    }

    const char = profile.characters[this.selectedChar]
    let canApply = true
    let previewText = ''

    if (this.selectedItem) {
      const item = getItem(this.selectedItem)
      if (item.type === 'stat-shot' && item.boostStat) {
        const stat = item.boostStat.stat
        const before = baseStatsFor(char)[stat]
        const previewed = previewStatShot(char, item).character
        const after = baseStatsFor(previewed)[stat]
        previewText = `${STAT_LABELS[stat]} ${before} → ${after}`
        canApply = after !== before
      } else if (item.type === 'tome' && item.grantsSkill) {
        const skill = getSkill(item.grantsSkill)
        if (char.learnedSkills.includes(item.grantsSkill)) {
          previewText = `Already knows ${skill.name} — cannot apply.`
          canApply = false
        } else {
          previewText = `Will learn ${skill.name}.`
        }
      }
    } else {
      previewText = 'Select an item to preview its effect.'
    }

    uiText(
      this.scene,
      previewX,
      listY + 20,
      previewText,
      { size: 'sm', color: canApply ? THEME.colors.text : THEME.colors.textMuted, wordWrap: previewW },
      content,
    )

    const charName = char.name
    const itemId = this.selectedItem
    makeButton(
      this.scene,
      previewX,
      listY + 70,
      'Apply',
      () => {
        if (!this.selectedChar || !itemId) return
        try {
          const result: ApplyItemResult =
            getItem(itemId).type === 'stat-shot'
              ? applyStatShot(this.selectedChar, itemId)
              : applyTome(this.selectedChar, itemId)
          if (!result.ok) {
            this.message = result.alreadyKnown
              ? 'That character already knows this skill.'
              : (result.error ?? 'Could not apply item.')
            this.refresh()
            return
          }
          const consumed = getItem(itemId)
          if (consumed.type === 'tome') {
            this.message = `${charName} learned ${getSkill(consumed.grantsSkill!).name}.`
          } else {
            this.message = `Applied ${consumed.name} to ${charName}.`
          }
          this.selectedItem = null
          this.refresh()
        } catch (err) {
          this.message = (err as Error).message
          this.refresh()
        }
      },
      { width: 120, height: 32, color: THEME.colors.accent, fontSize: 'sm' },
      content,
    ).setDisabled(!canApply || !itemId)

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

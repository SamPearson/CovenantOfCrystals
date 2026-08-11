import Phaser from 'phaser'
import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeButton } from '../widgets'
import { truncate } from '../format'
import { getProfile, mutate } from '../../../core/store'
import { isInParty, isPartyFull, addToParty } from '../../../core/party'
import { buildCharacterDetail } from './character-detail'

export interface BoxesPanelOptions {
  onEquipCharacter: (charId: string) => void
}

export class BoxesPanel extends Panel {
  private boxIndex = 0
  private selected: string | null = null
  private message: string | null = null

  constructor(scene: Phaser.Scene, rect: ConstructorParameters<typeof Panel>[1], private opts: BoxesPanelOptions) {
    super(scene, rect)
  }

  refresh(): void {
    const content = this.rebuild()
    const profile = getProfile()
    const box = profile.boxes[this.boxIndex] ?? profile.boxes[0]
    const pad = THEME.spacing.pad
    const slot = THEME.slot

    makeButton(
      this.scene,
      pad,
      12,
      '‹',
      () => {
        this.boxIndex = (this.boxIndex - 1 + profile.boxes.length) % profile.boxes.length
        this.refresh()
      },
      { width: 34, height: 30 },
      content,
    )

    uiText(
      this.scene,
      pad + 44,
      16,
      `Box ${this.boxIndex + 1} / ${profile.boxes.length}`,
      { size: 'md' },
      content,
    )

    makeButton(
      this.scene,
      pad + 180,
      12,
      '›',
      () => {
        this.boxIndex = (this.boxIndex + 1) % profile.boxes.length
        this.refresh()
      },
      { width: 34, height: 30 },
      content,
    )

    const filled = box.slots.filter((s) => s !== null && s !== undefined).length
    uiText(
      this.scene,
      this.rect.w - pad,
      16,
      `${filled} / ${box.slots.length}`,
      { size: 'sm', color: THEME.colors.textMuted },
      content,
    ).setOrigin(1, 0)

    const stride = slot.size + slot.gap
    const gx = pad
    const gy = 52
    for (let i = 0; i < slot.cols * slot.rows; i++) {
      const col = i % slot.cols
      const row = Math.floor(i / slot.cols)
      const cx = gx + col * stride + slot.size / 2
      const cy = gy + row * stride + slot.size / 2
      const charId = box.slots[i]
      const hasChar = charId !== null && charId !== undefined
      const isSelected = hasChar && this.selected === charId

      const cell = this.scene.add
        .rectangle(cx, cy, slot.size, slot.size, hasChar ? THEME.colors.panelAlt : THEME.colors.slotEmpty)
        .setRounded(6)
      content.add(cell)

      if (hasChar) {
        const c = profile.characters[charId]
        uiText(this.scene, cx, cy, truncate(c?.name ?? '?', 7), { size: 'xs' }, content).setOrigin(0.5, 0.5)
        cell
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => {
            cell.setFillStyle(isSelected ? THEME.colors.selected : THEME.colors.hover)
          })
          .on('pointerout', () => {
            cell.setFillStyle(isSelected ? THEME.colors.selected : THEME.colors.panelAlt)
          })
          .on('pointerdown', () => {
            this.selected = this.selected === charId ? null : charId
            this.refresh()
          })
        if (isSelected) cell.setFillStyle(THEME.colors.selected)
      }
    }

    const detailX = 320
    const detailW = this.rect.w - detailX - pad
    const detailH = this.rect.h - pad - 52

    if (this.selected && profile.characters[this.selected]) {
      const charId = this.selected
      const char = profile.characters[charId]
      buildCharacterDetail(this.scene, content, detailX, 52, detailW, detailH, charId, [
        {
          label: isInParty(profile, charId) ? 'In party' : isPartyFull(profile) ? 'Party full' : 'To party',
          disabled: isInParty(profile, charId) || isPartyFull(profile),
          onClick: () => {
            try {
              mutate((p) => addToParty(p, charId))
              this.message = null
            } catch (err) {
              this.message = (err as Error).message
              this.refresh()
            }
          },
        },
        {
          label: 'Equip',
          color: THEME.colors.accentDark,
          onClick: () => {
            this.message = null
            this.opts.onEquipCharacter(charId)
          },
        },
      ])
      if (char.durability.kind === 'expires') {
        uiText(
          this.scene,
          detailX + detailW - pad,
          60,
          '⚠ expires',
          { size: 'xs', color: THEME.colors.warn },
          content,
        ).setOrigin(1, 0)
      }
    } else {
      uiText(
        this.scene,
        detailX,
        60,
        'Select a character to inspect and manage.',
        { size: 'sm', color: THEME.colors.textMuted },
        content,
      )
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

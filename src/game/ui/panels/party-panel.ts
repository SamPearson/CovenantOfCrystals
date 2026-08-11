import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeSubpanel } from '../widgets'
import { durabilityLabel, truncate } from '../format'
import { getProfile, mutate } from '../../../core/store'
import { removeFromParty } from '../../../core/party'
import { getClass } from '../../../core'
import { buildCharacterDetail } from './character-detail'

export class PartyPanel extends Panel {
  private selected: string | null = null

  refresh(): void {
    const content = this.rebuild()
    const profile = getProfile()
    const pad = THEME.spacing.pad
    const gap = THEME.spacing.gap

    const cardW = (this.rect.w - pad * 2 - gap * 3) / 4
    const cardH = 130
    const cardsY = pad

    for (let i = 0; i < 4; i++) {
      const x = pad + i * (cardW + gap)
      const charId = profile.party[i]
      const isSelected = charId !== undefined && this.selected === charId
      makeSubpanel(this.scene, content, x, cardsY, cardW, cardH, {
        strokeColor: isSelected ? THEME.colors.accent : THEME.colors.border,
      })

      if (charId && profile.characters[charId]) {
        const c = profile.characters[charId]
        const cls = getClass(c.classId)
        uiText(this.scene, x + pad, cardsY + 10, truncate(c.name, 14), { size: 'md' }, content)
        uiText(
          this.scene,
          x + pad,
          cardsY + 34,
          `${cls.name} · Lv ${c.level}`,
          { size: 'sm', color: THEME.colors.textMuted },
          content,
        )
        uiText(
          this.scene,
          x + pad,
          cardsY + 56,
          durabilityLabel(c.durability),
          {
            size: 'xs',
            color: c.durability.kind === 'expires' ? THEME.colors.warn : THEME.colors.good,
          },
          content,
        )
        const cell = this.scene.add.rectangle(
          x + cardW / 2,
          cardsY + cardH / 2,
          cardW,
          cardH,
          0x000000,
          0,
        )
        cell.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.selected = this.selected === charId ? null : charId
          this.refresh()
        })
        content.add(cell)
      } else {
        uiText(
          this.scene,
          x + pad,
          cardsY + 50,
          'Empty',
          { size: 'sm', color: THEME.colors.textDim },
          content,
        )
      }
    }

    uiText(
      this.scene,
      this.rect.w - pad,
      cardsY + cardH + 12,
      `Party ${profile.party.length} / 4`,
      { size: 'sm', color: THEME.colors.textMuted },
      content,
    ).setOrigin(1, 0)

    const detailY = cardsY + cardH + 26
    const detailH = this.rect.h - detailY - pad

    if (this.selected && profile.characters[this.selected]) {
      const charId = this.selected
      buildCharacterDetail(this.scene, content, pad, detailY, this.rect.w - pad * 2, detailH, charId, [
        {
          label: 'To box',
          color: THEME.colors.accentDark,
          onClick: () => {
            mutate((p) => removeFromParty(p, charId))
          },
        },
      ])
    } else {
      uiText(
        this.scene,
        pad,
        detailY + 8,
        'Click a party member to inspect them. Use the Boxes tab to add members.',
        { size: 'sm', color: THEME.colors.textMuted },
        content,
      )
    }
  }
}

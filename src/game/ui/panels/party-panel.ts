import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeSubpanel } from '../widgets'
import { attachTooltip } from '../tooltip'
import { durabilityLabel, truncate, roleLabel, elementLabel } from '../format'
import { getProfile, mutate } from '../../../core/store'
import { removeFromParty } from '../../../core/party'
import { getClass } from '../../../core'
import { canLevelUp } from '../../../core/leveling'
import type { TooltipLine } from '../../../core/tooltips'
import { buildCharacterDetail } from './character-detail'
import { makePortraitSlot, PORTRAIT_SLOT } from '../portrait'
import { showLevelUpScreen } from './level-up-panel'

function characterTooltip(charId: string): TooltipLine[] {
  const profile = getProfile()
  const c = profile.characters[charId]
  if (!c) return []
  const cls = getClass(c.classId)
  return [
    { kind: 'title', text: c.name },
    { kind: 'subtitle', text: `${cls.name} · Lv ${c.level}` },
    {
      kind: 'desc',
      text: `${roleLabel(cls.role)}${cls.element !== 'none' ? ` · ${elementLabel(cls.element)}` : ''} · ${durabilityLabel(c.durability)}`,
    },
  ]
}

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
        const cx = x + cardW / 2
        makePortraitSlot(this.scene, content, cx - PORTRAIT_SLOT / 2, cardsY + 8, cls.element, cls.name[0])

        const cell = this.scene.add.rectangle(
          x + cardW / 2,
          cardsY + cardH / 2,
          cardW,
          cardH,
          0x000000,
          0,
        )
        cell.setInteractive({ useHandCursor: true })
        attachTooltip(this.scene, cell, () => characterTooltip(charId))
        cell.on('pointerdown', () => {
          this.selected = this.selected === charId ? null : charId
          this.refresh()
        })
        content.add(cell)

        // Name text added AFTER cell so it renders on top and receives clicks
        const nameText = uiText(this.scene, cx, cardsY + 72, truncate(c.name, 12), { size: 'md' }, content).setOrigin(0.5, 0)
        nameText.setInteractive({ useHandCursor: true })
        nameText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          pointer.event?.stopPropagation()
          this.editCharacterName(charId)
        })

        uiText(
          this.scene,
          cx,
          cardsY + 94,
          `${cls.name} · Lv ${c.level}`,
          { size: 'sm', color: THEME.colors.textMuted },
          content,
        ).setOrigin(0.5, 0)
        uiText(
          this.scene,
          cx,
          cardsY + 112,
          durabilityLabel(c.durability),
          {
            size: 'xs',
            color: c.durability.kind === 'expires' ? THEME.colors.warn : THEME.colors.good,
          },
          content,
        ).setOrigin(0.5, 0)
      } else {
        uiText(
          this.scene,
          x + cardW / 2,
          cardsY + 60,
          'Empty',
          { size: 'sm', color: THEME.colors.textDim },
          content,
        ).setOrigin(0.5, 0)
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
      const character = profile.characters[charId]
      const actions: { label: string; onClick: () => void; disabled?: boolean; color?: number }[] = []
      if (character && canLevelUp(character)) {
        actions.push({
          label: 'Level Up',
          color: THEME.colors.gold,
          onClick: () => {
            showLevelUpScreen(this.scene, charId, () => {
              this.refresh()
            })
          },
        })
      }
      actions.push({
        label: 'To box',
        color: THEME.colors.accentDark,
        onClick: () => {
          mutate((p) => removeFromParty(p, charId))
        },
      })
      buildCharacterDetail(this.scene, content, pad, detailY, this.rect.w - pad * 2, detailH, charId, actions)
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

  private editCharacterName(charId: string): void {
    const profile = getProfile()
    const ch = profile.characters[charId]
    if (!ch) return

    const input = document.createElement('input')
    input.type = 'text'
    input.value = ch.name
    input.maxLength = 16
    input.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      padding: 8px 12px; font-size: 14px; border: 2px solid #c9b896;
      background: #1a1612; color: #e8dfc8; border-radius: 4px; z-index: 10000;
    `
    document.body.appendChild(input)
    input.focus()
    input.select()

    const submit = () => {
      const name = input.value.trim()
      input.remove()
      if (name && name !== ch.name) {
        mutate((p) => { p.characters[charId].name = name })
        this.refresh()
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit()
      if (e.key === 'Escape') { input.remove() }
    })
    input.addEventListener('blur', submit)
  }
}

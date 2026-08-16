import { Panel } from './panel'
import { THEME } from '../theme'
import { uiText, makeButton, makeSubpanel, type Button } from '../widgets'
import { roleLabel, elementLabel, statList, statLabel, durabilityLabel } from '../format'
import { getProfile, mutate } from '../../../core/store'
import { canRecruit, recruit } from '../../../core/shop/recruitment'
import { getClass, derivedStats } from '../../../core'

/**
 * Phase 3 M7 recruitment tab (decision S6): 2–3 random level-1 characters of
 * unlocked classes, bought into the box for a flat gold price. Recruiting goes
 * through the pure core guard inside `mutate()` like the other meta panels.
 */
export class RecruitmentPanel extends Panel {
  private selected: string | null = null
  /** Draft state for the just-recruited character highlight survives refresh. */
  private justRecruited: string | null = null
  private message: string | null = null

  refresh(): void {
    const content = this.rebuild()
    const profile = getProfile()
    const pad = THEME.spacing.pad
    const offers = profile.recruitment

    const listW = 320
    const rowH = 64
    const listY = pad

    uiText(this.scene, pad, listY - 2, 'RECRUITMENT', { size: 'xs', color: THEME.colors.accentBlue }, content)
    if (offers.length === 0) {
      uiText(
        this.scene,
        pad,
        listY + 20,
        'No offers right now. Complete a run to refresh the roster.',
        { size: 'sm', color: THEME.colors.textMuted, wordWrap: listW },
        content,
      )
    }

    let ry = listY + 18
    for (const offer of offers) {
      const c = offer.character
      const cls = getClass(c.classId)
      const isSelected = this.selected === offer.id
      makeSubpanel(this.scene, content, pad, ry, listW, rowH, {
        strokeColor: isSelected ? THEME.colors.accent : THEME.colors.border,
      })
      uiText(this.scene, pad + 8, ry + 6, c.name, { size: 'sm', color: THEME.colors.gold }, content)
      uiText(
        this.scene,
        pad + 8,
        ry + 22,
        `${cls.name} · Lv ${c.level} · ${roleLabel(cls.role)}${cls.element !== 'none' ? ` (${elementLabel(cls.element)})` : ''}`,
        { size: 'xs', color: THEME.colors.textMuted },
        content,
      )
      const hit = this.scene.add.rectangle(pad + listW / 2, ry + rowH / 2, listW, rowH, 0x000000, 0)
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = this.selected === offer.id ? null : offer.id
        this.refresh()
      })
      content.add(hit)

      const button: Button = makeButton(
        this.scene,
        pad + listW - 106,
        ry + 17,
        `Recruit ${offer.price} gold`,
        () => {
          const result = this.recruitOffer(offer.id)
          if (result.ok) {
            this.message = `${offer.character.name} joins your box!`
            this.justRecruited = offer.character.id
            this.selected = null
            this.refresh()
          }
        },
        { width: 98, height: 30 },
        content,
      )
      const check = canRecruit(profile, offer.id)
      if (!check.ok) button.setDisabled(true)
      ry += rowH + 4
    }

    const detailX = pad * 2 + listW
    const detailW = this.rect.w - detailX - pad

    const selectedOffer = this.selected ? offers.find((o) => o.id === this.selected) : null
    if (selectedOffer) {
      const c = selectedOffer.character
      const cls = getClass(c.classId)
      const stats = derivedStats(c)
      const trained = (c.learnedSkills ?? []).map((id) => getClass(c.classId).learnSet.find((l) => l.skillId === id))
      uiText(this.scene, detailX, listY - 2, c.name, { size: 'xs', color: THEME.colors.accentBlue }, content)
      uiText(this.scene, detailX, listY + 12, `${cls.name} · Lv ${c.level}`, { size: 'md' }, content)

      const statLine = statList(stats)
        .map(({ key, value }) => `${statLabel(key)} ${value}`)
        .join('  ')
      uiText(
        this.scene,
        detailX,
        listY + 36,
        statLine,
        { size: 'xs', color: THEME.colors.textMuted, wordWrap: detailW },
        content,
      )
      uiText(this.scene, detailX, listY + 56, `Durability: ${durabilityLabel(c.durability)}`, {
        size: 'xs',
        color: THEME.colors.textMuted,
      }, content)

      if (trained.length > 0) {
        uiText(this.scene, detailX, listY + 78, 'Learned skills', { size: 'xs', color: THEME.colors.accentBlue }, content)
        const startY = listY + 96
        for (let i = 0; i < trained.length; i++) {
          const entry = trained[i]
          if (entry) uiText(this.scene, detailX, startY + i * 18, `· ${entry.skillId}`, { size: 'xs' }, content)
        }
      }
    } else if (this.justRecruited && profile.characters[this.justRecruited]) {
      const c = profile.characters[this.justRecruited]
      const cls = getClass(c.classId)
      uiText(this.scene, detailX, listY - 2, 'Welcome aboard!', { size: 'xs', color: THEME.colors.good }, content)
      uiText(this.scene, detailX, listY + 12, `${c.name} (${cls.name}) is waiting in your box.`, {
        size: 'sm',
        color: THEME.colors.textMuted,
        wordWrap: detailW,
      }, content)
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

  private recruitOffer(offerId: string): { ok: boolean } {
    const profile = getProfile()
    const check = canRecruit(profile, offerId)
    if (!check.ok) {
      this.message = check.error ?? 'Cannot recruit'
      return { ok: false }
    }
    try {
      mutate((p) => recruit(p, offerId))
      return { ok: true }
    } catch (err) {
      this.message = (err as Error).message
      return { ok: false }
    }
  }
}
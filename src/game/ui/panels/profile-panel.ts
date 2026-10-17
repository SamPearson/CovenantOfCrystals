/**
 * Profile management panel — create, switch, rename, delete, export/import profiles.
 */

import Phaser from 'phaser'
import { THEME, hexColor } from '../theme'
import { uiText, makeButton, makeBadge } from '../widgets'
import { Panel, type PanelRect } from './panel'
import { listProfiles, getActiveProfileId, switchProfile, deleteProfile, renameProfile, exportProfile, importProfile, duplicateProfile, createProfile } from '../../../core'

interface ProfilePanelConfig extends PanelRect {
  scene: Phaser.Scene
  onProfileChange?: () => void
}

export class ProfilePanel extends Panel {
  private config: ProfilePanelConfig

  constructor(config: ProfilePanelConfig) {
    super(config.scene, config)
    this.config = config

    // Header text (added to container, persists across refreshes)
    uiText(this.scene, 16, 12, 'Profiles', {
      size: 'lg',
      color: THEME.colors.gold,
      family: 'display',
    }, this.container)

    this.refresh()

    // Create header buttons AFTER refresh so they sit on top of content
    // Create new profile button (added to container, persists across refreshes)
    makeButton(this.scene, this.rect.w - 16 - 120, 12, 'New Profile', () => {
      this.createNewProfile()
    }, { width: 110, height: 30, fontSize: 'sm' }, this.container)

    // Import profile button (added to container, persists across refreshes)
    makeButton(this.scene, this.rect.w - 16 - 120 - 10 - 110, 12, 'Import', () => {
      this.importProfile()
    }, { width: 100, height: 30, fontSize: 'sm', color: THEME.colors.accentBlue }, this.container)
  }

  override refresh(): void {
    const content = this.rebuild()
    const profiles = listProfiles()
    const activeId = getActiveProfileId()
    let y = 52

    for (const profile of profiles) {
      y = this.renderProfileRow(content, profile, y, profile.profileId === activeId)
    }

    if (profiles.length === 0) {
      uiText(this.scene, 16, y, 'No profiles yet. Click "New Profile" to create one.', {
        size: 'sm',
        color: THEME.colors.textMuted,
        wordWrap: this.rect.w - 40,
      }, content)
      y += 40
    }
  }

  private renderProfileRow(content: Phaser.GameObjects.Container, profile: { profileId: string; displayName: string; createdAt: number; lastPlayed: number; stats: { totalRuns: number; wins: number; losses: number }; sizeBytes?: number }, y: number, isActive: boolean): number {
    const rowH = 56
    const pad = 12
    const innerW = this.rect.w - pad * 2

    // Row background
    const bg = this.scene.add.rectangle(pad, y + rowH / 2, innerW, rowH - 4, isActive ? THEME.colors.accentBlue : THEME.colors.panel, isActive ? 0.15 : 0)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, isActive ? THEME.colors.accent : THEME.colors.border, isActive ? 1 : 0.5)
    content.add(bg)

    // Active indicator
    if (isActive) {
      const dot = this.scene.add.circle(pad + 6, y + rowH / 2, 5, THEME.colors.gold, 1)
      content.add(dot)
    }

    // Name
    const nameText = uiText(this.scene, isActive ? pad + 18 : pad + 8, y + 4, profile.displayName, {
      size: 'md',
      color: isActive ? THEME.colors.gold : THEME.colors.text,
      family: 'display',
      wordWrap: innerW - 100,
    }, content)

    // Stats
    const statsText = `Runs: ${profile.stats.totalRuns}  |  Wins: ${profile.stats.wins}  |  Losses: ${profile.stats.losses}`
    uiText(this.scene, isActive ? pad + 18 : pad + 8, y + nameText.height + 6, statsText, {
      size: 'xs',
      color: THEME.colors.textMuted,
    }, content)

    // Buttons
    let btnX = this.rect.w - pad - 24
    const btnW = 72
    const btnH = 24
    const gap = 6

    // Switch / Current
    if (isActive) {
      makeBadge(this.scene, btnX - btnW, y + (rowH - btnH) / 2, 'Active', THEME.colors.good, { width: btnW, height: btnH }, content)
      btnX -= btnW + gap
    } else {
      makeButton(this.scene, btnX - btnW, y + (rowH - btnH) / 2, 'Switch', () => {
        this.switchToProfile(profile.profileId)
      }, { width: btnW, height: btnH, fontSize: 'xs', color: THEME.colors.accent }, content)
      btnX -= btnW + gap
    }

    // Duplicate
    makeButton(this.scene, btnX - btnW, y + (rowH - btnH) / 2, 'Duplicate', () => {
      this.duplicateProfile(profile.profileId)
    }, { width: btnW, height: btnH, fontSize: 'xs' }, content)
    btnX -= btnW + gap

    // Rename
    makeButton(this.scene, btnX - btnW, y + (rowH - btnH) / 2, 'Rename', () => {
      this.renameProfile(profile.profileId)
    }, { width: btnW, height: btnH, fontSize: 'xs' }, content)
    btnX -= btnW + gap

    // Export
    makeButton(this.scene, btnX - btnW, y + (rowH - btnH) / 2, 'Export', () => {
      this.exportProfile(profile.profileId)
    }, { width: btnW, height: btnH, fontSize: 'xs' }, content)
    btnX -= btnW + gap

    // Delete
    makeButton(this.scene, btnX - btnW, y + (rowH - btnH) / 2, 'Delete', () => {
      this.confirmDeleteProfile(profile)
    }, { width: btnW, height: btnH, fontSize: 'xs', color: hexColor(THEME.colors.bad), labelColor: THEME.colors.textOnAccent }, content)
    btnX -= btnW + gap

    return y + rowH + 4
  }

  private createNewProfile(): void {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Profile name'
    input.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      padding: 10px 16px; font-size: 16px; border: 2px solid #c9b896;
      background: #1a1612; color: #e8dfc8; border-radius: 4px; z-index: 10000;
    `
    document.body.appendChild(input)
    input.focus()

    const submit = () => {
      const name = input.value.trim()
      input.remove()
      if (name) {
        createProfile(name)
        this.refresh()
        this.config.onProfileChange?.()
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit()
      if (e.key === 'Escape') { input.remove() }
    })
    input.addEventListener('blur', submit)
  }

  private switchToProfile(profileId: string): void {
    switchProfile(profileId)
    this.refresh()
    this.config.onProfileChange?.()
    // Restart the scene to rebuild everything
    this.scene.scene.restart()
  }

  private duplicateProfile(profileId: string): void {
    duplicateProfile(profileId)
    this.refresh()
    this.config.onProfileChange?.()
    this.scene.scene.restart()
  }

  private renameProfile(profileId: string): void {
    const profiles = listProfiles()
    const profile = profiles.find((p) => p.profileId === profileId)
    if (!profile) return

    const input = document.createElement('input')
    input.type = 'text'
    input.value = profile.displayName
    input.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      padding: 10px 16px; font-size: 16px; border: 2px solid #c9b896;
      background: #1a1612; color: #e8dfc8; border-radius: 4px; z-index: 10000;
    `
    document.body.appendChild(input)
    input.focus()
    input.select()

    const submit = () => {
      const name = input.value.trim()
      input.remove()
      if (name && name !== profile.displayName) {
        renameProfile(profileId, name)
        this.refresh()
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit()
      if (e.key === 'Escape') { input.remove() }
    })
    input.addEventListener('blur', submit)
  }

  private exportProfile(profileId: string): void {
    const json = exportProfile(profileId)
    if (!json) return

    // Create download
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const profiles = listProfiles()
    const p = profiles.find((p) => p.profileId === profileId)
    const name = p ? p.displayName.replace(/[^a-z0-9]/gi, '_') : 'profile'
    a.href = url
    a.download = `${name}_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  private importProfile(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.style.display = 'none'
    document.body.appendChild(input)

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) { input.remove(); return }

      const reader = new FileReader()
      reader.onload = (e) => {
        const json = e.target?.result as string
        const name = file.name.replace(/\.json$/, '')
        const newId = importProfile(json, name)
        if (newId) {
          this.refresh()
          this.config.onProfileChange?.()
          this.scene.scene.restart()
        } else {
          alert('Failed to import profile. Invalid file format.')
        }
        input.remove()
      }
      reader.readAsText(file)
    })

    input.click()
  }

  private confirmDeleteProfile(profile: { profileId: string; displayName: string }): void {
    if (!confirm(`Delete profile "${profile.displayName}"? This cannot be undone.`)) return
    deleteProfile(profile.profileId)
    this.refresh()
    this.config.onProfileChange?.()
    this.scene.scene.restart()
  }
}
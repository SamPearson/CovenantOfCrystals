/**
 * Script Library panel — the left column of the Automation Window (M4).
 * Renders a character's script library as a selectable list (reference:
 * `docs/script_window_template/template_002`), shows per-script assigned
 * counts and the library capacity, and provides New / Edit / Copy / Delete
 * actions. Pure render helpers over a `Container`; the owning
 * `AutomationPanel` wires selection + page state and store actions. All
 * coordinates are panel-local (top-left anchored).
 */

import Phaser from 'phaser'
import { THEME, colorHex, hexColor } from '../theme'
import { uiText, makeButton, makeSubpanel, makeBadge } from '../widgets'
import type { CharacterScript } from '../../../core/scripting/types'
import { SCRIPT_LIBRARY_CAP } from '../../../core/scripting/types'
import { scriptSummaryLabel } from '../script-labels'

export interface LibraryCallbacks {
  /** Select a script for the editor; `undefined` = clear the selection. */
  onSelect: (id: string | undefined) => void
  /** Ask the owning panel to create a fresh script and open it. */
  onCreate: () => void
  /** Open the given script in the editor. */
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onPage: (delta: number) => void
}

export interface LibraryState {
  scripts: CharacterScript[]
  selectedId: string | undefined
  /** scriptId -> number of characters using it (party + box). */
  assignedCount: Record<string, number>
  page: number
}

const ROW_H = 46
const LIB_HEADER_H = 82
const LIB_FOOTER_H = 44

export function libraryPageSize(listH: number): number {
  return Math.max(1, Math.floor(listH / ROW_H))
}

/**
 * Renders a paginated, selectable script library. The caller owns the pager:
 * `page` is clamped when it exceeds the script count, and `onPage` re-renders.
 */
export function renderLibrary(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  state: LibraryState,
  cb: LibraryCallbacks,
): void {
  makeSubpanel(scene, parent, x, y, w, h, { fillColor: THEME.colors.face })

  // Header: title + capacity badge.
  uiText(scene, x + 12, y + 12, 'SCRIPT LIBRARY', {
    size: 'md',
    color: THEME.colors.gold,
    family: 'display',
    letterSpacing: 1,
  }, parent)
  makeBadge(scene, x + w - 74, y + 10, `${state.scripts.length}/${SCRIPT_LIBRARY_CAP}`, colorHex(THEME.colors.borderLight), {
    width: 62,
    height: 22,
    size: 'xs',
  }, parent)

  // Action row.
  const hasSel = state.selectedId !== undefined
  const ax = x + 12
  const ay = y + 44
  makeButton(scene, ax, ay, 'New', cb.onCreate, { width: 64, height: 26, fontSize: 'xs' }, parent)
  makeButton(
    scene,
    ax + 72,
    ay,
    'Edit',
    () => {
      if (state.selectedId !== undefined) cb.onEdit(state.selectedId)
    },
    { width: 64, height: 26, fontSize: 'xs', color: THEME.colors.accentBlue },
    parent,
  ).setDisabled(!hasSel)
  makeButton(
    scene,
    ax + 144,
    ay,
    'Copy',
    () => {
      if (state.selectedId !== undefined) cb.onDuplicate(state.selectedId)
    },
    { width: 64, height: 26, fontSize: 'xs' },
    parent,
  ).setDisabled(!hasSel)
  makeButton(
    scene,
    ax + 216,
    ay,
    'Delete',
    () => {
      if (state.selectedId !== undefined) cb.onDelete(state.selectedId)
    },
    { width: 72, height: 26, fontSize: 'xs', color: hexColor(THEME.colors.warn) },
    parent,
  ).setDisabled(!hasSel)

  // List region.
  const listX = x + 8
  const listW = w - 16
  const listY = y + LIB_HEADER_H
  const listH = h - LIB_HEADER_H - LIB_FOOTER_H
  const pageSize = libraryPageSize(listH)
  const pageCount = Math.max(1, Math.ceil(state.scripts.length / pageSize))
  const page = Math.min(state.page, pageCount - 1)
  const visible = state.scripts.slice(page * pageSize, (page + 1) * pageSize)

  if (state.scripts.length === 0) {
    uiText(scene, listX + listW / 2, listY + 20, 'No scripts yet — press New.', {
      size: 'sm',
      color: THEME.colors.textMuted,
      align: 'center',
    }, parent).setOrigin(0.5, 0)
  }

  visible.forEach((row, i) => {
    const ryy = listY + i * ROW_H
    const isSel = row.id === state.selectedId
    // Row backdrop.
    const rowBg = scene.add
      .rectangle(listX, ryy, listW, ROW_H - 2, 0x000000, 0)
      .setStrokeStyle(1, isSel ? THEME.colors.accent : THEME.colors.border, 0.7)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => cb.onSelect(isSel ? undefined : row.id))
    parent.add(rowBg)
    uiText(scene, listX + 8, ryy + 5, row.art ?? '✧', {
      size: 'md',
      color: isSel ? THEME.colors.textOnAccent : THEME.colors.gold,
      family: 'display',
    }, parent)
    uiText(
      scene,
      listX + 32,
      ryy + 4,
      row.name + (row.builtIn ? ' · built-in' : ''),
      { size: 'sm', color: isSel ? THEME.colors.textOnAccent : THEME.colors.text, family: 'display' },
      parent,
    )
    uiText(scene, listX + 32, ryy + 22, scriptSummaryLabel(row), {
      size: 'xs',
      color: isSel ? THEME.colors.textOnAccent : THEME.colors.textMuted,
    }, parent)
    const used = state.assignedCount[row.id] ?? 0
    if (used > 0) {
      uiText(scene, listX + listW - (used >= 10 ? 42 : 32), ryy + 7, `${used}×`, {
        size: 'xs',
        color: isSel ? THEME.colors.textOnAccent : THEME.colors.good,
      }, parent)
    }
  })

  // Pager.
  const py = y + h - LIB_FOOTER_H
  uiText(scene, x + w / 2, py + 8, `Page ${page + 1} / ${pageCount}`, {
    size: 'xs',
    color: THEME.colors.textMuted,
    align: 'center',
  }, parent).setOrigin(0.5, 0.5)
  makeButton(scene, x + 12, py, '‹', () => cb.onPage(-1), { width: 32, height: 26, fontSize: 'sm' }, parent).setDisabled(
    page <= 0,
  )
  makeButton(scene, x + 52, py, '›', () => cb.onPage(+1), { width: 32, height: 26, fontSize: 'sm' }, parent).setDisabled(
    page >= pageCount - 1,
  )
}
/**
 * Automation Window (M4) — the owning panel for the script library column of
 * the Automation tab (`docs/script_window_template/template_002`). Hosts the
 * `renderLibrary` list, owns selection + pager state, wires library CRUD to the
 * store, and opens the DOM overlay editor (`../script-editor-panel`) for
 * New / Edit. The editor overlay floats above the canvas exactly like Theme
 * Studio; this panel shows the library left column underneath.
 */

import { Panel } from './panel'
import { getProfile, getScripts, createScript, deleteScript, duplicateScript } from '../../../core/store'
import { uuid } from '../../../core/id'
import { renderLibrary } from './script-library-panel'
import type { LibraryCallbacks, LibraryState } from './script-library-panel'
import { showScriptEditor } from '../script-editor-panel'
import type { CharacterScript } from '../../../core/scripting/types'

export class AutomationPanel extends Panel {
  private selectedId: string | undefined = undefined
  private page = 0

  refresh(): void {
    const content = this.rebuild()
    const scripts = getScripts()

    // Drop a stale selection (deleted / filtered by the editor).
    if (this.selectedId !== undefined && !scripts.some((s) => s.id === this.selectedId)) {
      this.selectedId = undefined
      this.page = 0
    }

    const assignedCount: Record<string, number> = {}
    for (const character of Object.values(getProfile().characters)) {
      if (character.scriptId !== undefined) {
        assignedCount[character.scriptId] = (assignedCount[character.scriptId] ?? 0) + 1
      }
    }

    const state: LibraryState = {
      scripts,
      selectedId: this.selectedId,
      assignedCount,
      page: this.page,
    }
    const cb: LibraryCallbacks = {
      onSelect: (id) => {
        this.selectedId = id
        this.refresh()
      },
      onCreate: () => {
        const id = createBlankScript()
        this.selectedId = id
        this.page = 0
        showScriptEditor(id)
      },
      onEdit: (id) => {
        this.selectedId = id
        showScriptEditor(id)
      },
      onDuplicate: (id) => {
        duplicateScript(id)
        this.refresh()
      },
      onDelete: (id) => {
        deleteScript(id)
        if (this.selectedId === id) this.selectedId = undefined
        this.refresh()
      },
      onPage: (delta) => {
        this.page = Math.max(0, this.page + delta)
        this.refresh()
      },
    }

    renderLibrary(this.scene, content, 0, 0, this.rect.w, this.rect.h, state, cb)
  }
}

/** A fresh empty script (root block, no rules), pushed to the library. */
function createBlankScript(): string {
  const now = Date.now()
  const script: CharacterScript = {
    id: uuid(),
    name: 'New Script',
    rootBlock: { id: uuid(), depth: 0, lines: [], nested: [] },
    reactions: [],
    createdAt: now,
    updatedAt: now,
  }
  createScript(script)
  return script.id
}
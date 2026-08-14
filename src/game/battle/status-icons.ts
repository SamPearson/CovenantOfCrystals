/**
 * Status → short label mapping for the BattleScene status icons. Pure and
 * theme-agnostic: callers decide the color from the tone.
 */

import type { ActiveStatus, ActiveStatusKind } from '../../core/combat/types'

export type StatusTone = 'good' | 'warn' | 'bad' | 'info'

const KIND_TONES: Record<ActiveStatusKind, StatusTone> = {
  statBuff: 'good',
  statDebuff: 'bad',
  burn: 'warn',
  poison: 'bad',
  regen: 'good',
  sleep: 'info',
  blind: 'info',
  freeze: 'info',
  shield: 'info',
  taunt: 'bad',
  stun: 'warn',
}

const KIND_SHORT: Record<ActiveStatusKind, string> = {
  statBuff: '▲',
  statDebuff: '▼',
  burn: 'BRN',
  poison: 'PSN',
  regen: 'RGN',
  sleep: 'SLP',
  blind: 'BLD',
  freeze: 'FRZ',
  shield: 'SHD',
  taunt: 'TNT',
  stun: 'STN',
}

export interface StatusIcon {
  label: string
  tone: StatusTone
}

/** Short display label for a live status (e.g. ▲ ATK, BRN). */
export function statusLabel(status: ActiveStatus): string {
  const base = KIND_SHORT[status.kind]
  if (status.kind === 'statBuff') return `${base}${(status.stat ?? 'atk').toUpperCase()}`
  if (status.kind === 'statDebuff') return `${base}${(status.stat ?? 'atk').toUpperCase()}`
  return base
}

/** Icon metadata (label + tone) for rendering a live status. */
export function statusIcon(status: ActiveStatus): StatusIcon {
  return { label: statusLabel(status), tone: KIND_TONES[status.kind] }
}
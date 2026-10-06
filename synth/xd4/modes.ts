// Tables for the VOICE MODE DEPTH knob, whose meaning depends on the voice mode.

import type { ArpOrder } from '../core/Arpeggiator'

export const CHORDS = [
  { name: '5th', intervals: [0, 7] },
  { name: 'sus2', intervals: [0, 2, 7] },
  { name: 'm', intervals: [0, 3, 7] },
  { name: 'Maj', intervals: [0, 4, 7] },
  { name: 'sus4', intervals: [0, 5, 7] },
  { name: 'm7', intervals: [0, 3, 7, 10] },
  { name: '7', intervals: [0, 4, 7, 10] },
  { name: '7sus4', intervals: [0, 5, 7, 10] },
  { name: 'Maj7', intervals: [0, 4, 7, 11] },
  { name: 'aug', intervals: [0, 4, 8] },
  { name: 'dim', intervals: [0, 3, 6] },
  { name: 'm7b5', intervals: [0, 3, 6, 10] },
  { name: 'mMaj7', intervals: [0, 3, 7, 11] },
  { name: 'Maj7b5', intervals: [0, 4, 6, 11] },
] as const

export const ARP_TYPES: readonly { name: string; order: ArpOrder; octaves: number }[] = [
  { name: 'Manual 1', order: 'manual', octaves: 1 },
  { name: 'Manual 2', order: 'manual', octaves: 2 },
  { name: 'Rise 1', order: 'rise', octaves: 1 },
  { name: 'Rise 2', order: 'rise', octaves: 2 },
  { name: 'Fall 1', order: 'fall', octaves: 1 },
  { name: 'Fall 2', order: 'fall', octaves: 2 },
  { name: 'Rise Fall 1', order: 'risefall', octaves: 1 },
  { name: 'Rise Fall 2', order: 'risefall', octaves: 2 },
  { name: 'Random 1', order: 'random', octaves: 1 },
  { name: 'Random 2', order: 'random', octaves: 2 },
]

/** Maximum detune spread of the unison stack, in cents either side. */
export const UNISON_MAX_DETUNE = 50

function pick<T>(list: readonly T[], depth: number): T {
  return list[Math.min(list.length - 1, Math.floor(depth * list.length))]
}

export function chordForDepth(depth: number) {
  return pick(CHORDS, depth)
}

export function arpTypeForDepth(depth: number) {
  return pick(ARP_TYPES, depth)
}

export function unisonDetuneCents(depth: number): number {
  return depth * UNISON_MAX_DETUNE
}

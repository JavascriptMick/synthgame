// A tempo-synced arpeggiator that any engine can put in front of its voices.
// Keys go in through noteOn/noteOff; arpeggiated notes come out through the
// `output` callbacks with exact audio times.

import * as Tone from 'tone'
import { ensureTransportRunning, scheduleAfter } from './engine'

/** manual = the order keys were pressed. */
export type ArpOrder = 'manual' | 'rise' | 'fall' | 'risefall' | 'random'

export interface ArpSettings {
  order: ArpOrder
  /** Octave span, 1 or more. */
  octaves: number
  /** Step length as transport notation, e.g. '16n' or '8t'. */
  division: string
  /** Note length as a fraction of the step, 0..1. */
  gate: number
}

export interface ArpOutput {
  noteOn(midi: number, time: number): void
  noteOff(midi: number, time: number): void
}

/** Builds one cycle of the pattern. `held` is in the order keys were pressed. */
export function buildArpSequence(held: readonly number[], order: ArpOrder, octaves: number): number[] {
  if (held.length === 0) return []
  const base = order === 'manual' ? [...held] : [...held].sort((a, b) => a - b)
  const span: number[] = []
  for (let o = 0; o < octaves; o++) span.push(...base.map((n) => n + o * 12))
  switch (order) {
    case 'fall':
      return span.reverse()
    case 'risefall':
      return span.length > 2 ? [...span, ...span.slice(1, -1).reverse()] : span
    default:
      // 'random' picks from the span at play time; manual and rise use it as is.
      return span
  }
}

export class Arpeggiator {
  private settings: ArpSettings
  /** Notes being arpeggiated, in the order they were pressed. */
  private notes: number[] = []
  /** Keys physically held, which differs from `notes` while latched. */
  private readonly physical = new Set<number>()
  private latch = false
  private step = 0
  private repeatId: number | null = null
  private readonly transport = Tone.getTransport()

  constructor(
    private readonly output: ArpOutput,
    settings: ArpSettings,
  ) {
    this.settings = { ...settings }
    ensureTransportRunning()
  }

  set(settings: Partial<ArpSettings>) {
    const divisionChanged = settings.division !== undefined && settings.division !== this.settings.division
    this.settings = { ...this.settings, ...settings }
    if (divisionChanged && this.repeatId !== null) this.start()
  }

  /** While latched, released notes keep playing until a new chord is started. */
  setLatch(on: boolean) {
    this.latch = on
    if (!on) this.updateNotes(this.notes.filter((n) => this.physical.has(n)))
  }

  noteOn(midi: number) {
    // With latch on, a new phrase starts when a key is pressed after all were released.
    const next = this.latch && this.physical.size === 0 ? [] : this.notes.filter((n) => n !== midi)
    this.physical.add(midi)
    this.updateNotes([...next, midi])
  }

  noteOff(midi: number) {
    this.physical.delete(midi)
    if (!this.latch) this.updateNotes(this.notes.filter((n) => n !== midi))
  }

  /** Drops all notes (the latch setting is kept). */
  clear() {
    this.physical.clear()
    this.updateNotes([])
  }

  private updateNotes(next: number[]) {
    const wasIdle = this.notes.length === 0
    this.notes = next
    if (next.length === 0) this.stop()
    else if (wasIdle) this.start()
  }

  /** (Re)starts the step clock so the first note sounds immediately rather than on the next grid step. */
  private start() {
    this.stop()
    this.step = 0
    this.repeatId = this.transport.scheduleRepeat(
      (time) => this.tick(time),
      this.settings.division,
      `${this.transport.ticks + 1}i`,
    )
  }

  private stop() {
    if (this.repeatId === null) return
    this.transport.clear(this.repeatId)
    this.repeatId = null
  }

  private tick(time: number) {
    const { order, octaves, division, gate } = this.settings
    const sequence = buildArpSequence(this.notes, order, octaves)
    if (sequence.length === 0) return
    const note =
      order === 'random'
        ? sequence[Math.floor(Math.random() * sequence.length)]
        : sequence[this.step % sequence.length]
    this.step++
    this.output.noteOn(note, time)
    scheduleAfter(time, Tone.Time(division).toSeconds() * gate, (t) => this.output.noteOff(note, t))
  }

  dispose() {
    this.stop()
  }
}

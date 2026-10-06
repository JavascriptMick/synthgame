// 16-step polyphonic step sequencer driven by the Tone transport.
// Steps are recorded from the keyboard: stopped, each chord played fills the
// record step and advances; while playing, notes are overdubbed onto the
// step that is currently sounding.

import * as Tone from 'tone'
import { ensureTransportRunning, scheduleAfter, type SynthEngine } from './engine'

export const STEP_COUNT = 16
const GATE = 0.75
const VELOCITY = 0.8

export interface SeqStep {
  notes: number[]
  /** Muted steps keep their notes but do not play. */
  on: boolean
}

export interface SequencerState {
  steps: SeqStep[]
  playing: boolean
  recording: boolean
  /** Step that the next recorded chord will be written to. */
  recStep: number
  /** Step currently sounding, or -1 when stopped. */
  currentStep: number
}

export function createSequencerState(): SequencerState {
  return {
    steps: emptySteps(),
    playing: false,
    recording: false,
    recStep: 0,
    currentStep: -1,
  }
}

export function emptySteps(): SeqStep[] {
  return Array.from({ length: STEP_COUNT }, () => ({ notes: [], on: true }))
}

/** Coerces untrusted data (e.g. from localStorage) into a full set of steps. */
export function sanitizeSteps(stored: unknown): SeqStep[] {
  const steps = emptySteps()
  if (!Array.isArray(stored)) return steps
  stored.slice(0, STEP_COUNT).forEach((raw: unknown, i) => {
    if (typeof raw !== 'object' || raw === null) return
    const { notes, on } = raw as Partial<Record<keyof SeqStep, unknown>>
    if (Array.isArray(notes)) {
      steps[i].notes = notes.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 127)
    }
    steps[i].on = on !== false
  })
  return steps
}

export function cloneSteps(steps: readonly SeqStep[]): SeqStep[] {
  return steps.map((s) => ({ notes: [...s.notes], on: s.on }))
}

export class Sequencer {
  private position = 0
  private readonly recHeld = new Set<number>()
  private readonly repeatId: number

  /** `state` is expected to be a reactive object so the UI follows playback. */
  constructor(
    private readonly engine: SynthEngine,
    private readonly state: SequencerState,
  ) {
    this.repeatId = Tone.getTransport().scheduleRepeat((time) => this.tick(time), '16n')
    ensureTransportRunning()
  }

  togglePlay() {
    if (this.state.playing) {
      this.state.playing = false
      this.state.currentStep = -1
    } else {
      this.position = 0
      this.state.playing = true
    }
  }

  toggleRecord() {
    this.state.recording = !this.state.recording
    this.recHeld.clear()
    if (this.state.recording && !this.state.playing) this.state.recStep = 0
  }

  toggleStep(index: number) {
    this.state.steps[index].on = !this.state.steps[index].on
  }

  /** Writes a rest at the record step and moves on. */
  rest() {
    if (!this.state.recording || this.state.playing) return
    this.state.steps[this.state.recStep] = { notes: [], on: true }
    this.advanceRecStep()
  }

  clear() {
    this.state.steps = emptySteps()
    this.state.recStep = 0
  }

  recordNoteOn(midi: number) {
    if (!this.state.recording) return
    if (this.state.playing) {
      const step = this.state.steps[Math.max(0, this.state.currentStep)]
      if (!step.notes.includes(midi)) step.notes.push(midi)
      return
    }
    const step = this.state.steps[this.state.recStep]
    // The first key of a new chord replaces whatever the step held before.
    if (this.recHeld.size === 0) {
      step.notes = []
      step.on = true
    }
    this.recHeld.add(midi)
    if (!step.notes.includes(midi)) step.notes.push(midi)
  }

  recordNoteOff(midi: number) {
    if (!this.recHeld.delete(midi)) return
    if (this.recHeld.size === 0 && this.state.recording && !this.state.playing) this.advanceRecStep()
  }

  private advanceRecStep() {
    this.state.recStep = (this.state.recStep + 1) % STEP_COUNT
  }

  private tick(time: number) {
    if (!this.state.playing) return
    const index = this.position
    this.position = (this.position + 1) % STEP_COUNT
    const step = this.state.steps[index]
    if (step.on && step.notes.length > 0) {
      const gate = Tone.Time('16n').toSeconds() * GATE
      for (const note of step.notes) {
        this.engine.noteOn(note, VELOCITY, time)
        scheduleAfter(time, gate, (t) => this.engine.noteOff(note, t))
      }
    }
    Tone.getDraw().schedule(() => {
      if (this.state.playing) this.state.currentStep = index
    }, time)
  }

  dispose() {
    Tone.getTransport().clear(this.repeatId)
  }
}

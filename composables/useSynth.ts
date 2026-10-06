// App-wide synth state. One synth is active at a time; its patch, the
// sequencer and the UI state are reactive and the audio engine follows them.
// There is a single instance shared by all components (client-only SPA).

import * as Tone from 'tone'
import { computed, reactive, readonly, shallowRef } from 'vue'
import type { SynthDefinition } from '~/synth/core/definition'
import type { SynthEngine } from '~/synth/core/engine'
import { defaultPatch, type GenericPatch, type PatchValue } from '~/synth/core/params'
import { PROGRAM_NAME_MAX, sanitizeName } from '~/synth/core/programs'
import { cloneSteps, createSequencerState, emptySteps, Sequencer } from '~/synth/core/Sequencer'
import { findSynth, SYNTHS } from '~/synth/registry'

const FLASH_MS = 1600
const KEYBOARD_OCTAVE_RANGE = 2

const definition = shallowRef<SynthDefinition>(SYNTHS[0])
const patch = reactive<GenericPatch>(defaultPatch(SYNTHS[0].params))
const seq = reactive(createSequencerState())
const ui = reactive({
  powered: false,
  powering: false,
  program: 0,
  programName: '',
  programNames: [] as string[],
  /** Parameter whose value the display is showing, if any. */
  flashParam: null as string | null,
  /** Free-text message shown on the display instead of a parameter. */
  flashMessage: null as string | null,
  keyboardOctave: 0,
  midiInputs: 0,
  /** Arpeggiator latch: a performance control, so it is not stored in programs. */
  arpLatch: false,
})
/** Notes held on the keyboard, computer keys or MIDI. */
const activeNotes = reactive(new Set<number>())

// shallowRef: Tone objects must never be wrapped in Vue proxies.
const engine = shallowRef<SynthEngine | null>(null)
let sequencer: Sequencer | null = null
let initialised = false
/** Last program used on each synth, so switching back returns to it. */
const lastProgram = new Map<string, number>()
let flashTimer: ReturnType<typeof setTimeout> | undefined

function flash(param: string | null, message: string | null = null) {
  ui.flashParam = param
  ui.flashMessage = message
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    ui.flashParam = null
    ui.flashMessage = null
  }, FLASH_MS)
}

/** Replaces the reactive patch in place, so components bound to it stay connected. */
function replacePatch(next: GenericPatch) {
  for (const key of Object.keys(patch)) if (!(key in next)) delete patch[key]
  Object.assign(patch, next)
}

function setParam(id: string, value: PatchValue) {
  if (!(id in definition.value.params)) throw new Error(`${definition.value.name} has no parameter "${id}"`)
  patch[id] = value
  engine.value?.setParam(id, value)
  flash(id)
}

// --- Engine lifecycle --------------------------------------------------------

function startEngine() {
  const e = definition.value.createEngine({ ...patch })
  engine.value = e
  ui.arpLatch = false
  if (definition.value.hasSequencer) sequencer = new Sequencer(e, seq)
}

function stopEngine() {
  sequencer?.dispose()
  sequencer = null
  Object.assign(seq, { playing: false, recording: false, currentStep: -1 })
  engine.value?.dispose()
  engine.value = null
  // Drop events still pending for the old engine (sequencer and arpeggiator note-offs).
  Tone.getTransport().cancel()
}

async function powerOn() {
  if (ui.powered || ui.powering) return
  ui.powering = true
  try {
    // Small look-ahead keeps the sequencer, arpeggiator and displays tight.
    Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: 0.05 }))
    await Tone.start()
    startEngine()
    ui.powered = true
    selectProgram(ui.program)
    connectMidi()
  } finally {
    ui.powering = false
  }
}

function selectSynth(id: string) {
  const next = findSynth(id)
  if (!next || (initialised && next === definition.value)) return
  releaseAllKeys()
  if (initialised) lastProgram.set(definition.value.id, ui.program)
  stopEngine()
  definition.value = next
  initialised = true
  replacePatch(defaultPatch(next.params))
  ui.programNames = next.programs.names()
  if (ui.powered) startEngine()
  selectProgram(lastProgram.get(next.id) ?? 0)
}

// --- Programs ----------------------------------------------------------------

function selectProgram(index: number) {
  const bank = definition.value.programs
  const i = ((index % bank.count) + bank.count) % bank.count
  const program = bank.load(i)
  ui.program = i
  ui.programName = program.name
  engine.value?.applyPatch(program.patch)
  replacePatch(program.patch)
  seq.steps = program.steps
  seq.recStep = 0
  flash(null)
}

function writeProgram(name: string) {
  const bank = definition.value.programs
  const ok = bank.save(ui.program, {
    name: sanitizeName(name),
    patch: { ...patch },
    steps: definition.value.hasSequencer ? cloneSteps(seq.steps) : emptySteps(),
  })
  if (ok) {
    ui.programName = sanitizeName(name)
    ui.programNames = bank.names()
  }
  flash(null, ok ? 'Program written' : 'Write failed')
}

function promptWriteProgram() {
  const name = window.prompt(`Write program ${ui.program + 1} as (max ${PROGRAM_NAME_MAX} characters):`, ui.programName)
  if (name !== null) writeProgram(name)
}

// --- Notes -------------------------------------------------------------------

function pressKey(midi: number, velocity?: number) {
  if (activeNotes.has(midi)) return
  activeNotes.add(midi)
  sequencer?.recordNoteOn(midi)
  engine.value?.noteOn(midi, velocity)
}

function releaseKey(midi: number) {
  if (!activeNotes.delete(midi)) return
  sequencer?.recordNoteOff(midi)
  engine.value?.noteOff(midi)
}

function releaseAllKeys() {
  for (const midi of [...activeNotes]) releaseKey(midi)
}

function setArpLatch(on: boolean) {
  ui.arpLatch = on
  engine.value?.setArpLatch?.(on)
  flash(null, on ? 'Latch on' : 'Latch off')
}

function shiftKeyboardOctave(delta: number) {
  ui.keyboardOctave = Math.max(-KEYBOARD_OCTAVE_RANGE, Math.min(KEYBOARD_OCTAVE_RANGE, ui.keyboardOctave + delta))
  flash(null, `Octave ${ui.keyboardOctave > 0 ? '+' : ''}${ui.keyboardOctave}`)
}

// --- MIDI input ----------------------------------------------------------------

function handleMidiMessage(event: MIDIMessageEvent) {
  const data = event.data
  if (!data || data.length < 2) return
  const status = data[0] & 0xf0
  const d1 = data[1]
  const d2 = data[2] ?? 0
  if (status === 0x90 && d2 > 0) pressKey(d1, d2 / 127)
  else if (status === 0x80 || status === 0x90) releaseKey(d1)
  else if (status === 0xe0) engine.value?.setPitchBend(((d2 << 7) | d1) / 8192 - 1)
  else if (status === 0xb0 && d1 === 1) engine.value?.setModulation(d2 / 127)
  else if (status === 0xb0 && (d1 === 120 || d1 === 123)) releaseAllKeys()
}

async function connectMidi() {
  if (!('requestMIDIAccess' in navigator)) return
  try {
    const access = await navigator.requestMIDIAccess()
    const bind = () => {
      ui.midiInputs = access.inputs.size
      access.inputs.forEach((input) => {
        input.onmidimessage = handleMidiMessage
      })
    }
    bind()
    access.onstatechange = bind
  } catch {
    // MIDI permission denied or unsupported: the synth still works without it.
  }
}

export function useSynth() {
  return {
    synths: SYNTHS,
    definition: computed(() => definition.value),
    patch,
    seq: readonly(seq),
    ui,
    activeNotes: readonly(activeNotes),
    engine: computed(() => engine.value),
    analyser: computed(() => engine.value?.analyser ?? null),
    powerOn,
    selectSynth,
    setParam,
    flash,
    selectProgram,
    promptWriteProgram,
    pressKey,
    releaseKey,
    releaseAllKeys,
    shiftKeyboardOctave,
    setArpLatch,
    setPitchBend: (x: number) => engine.value?.setPitchBend(x),
    setModulation: (y: number) => engine.value?.setModulation(y),
    sequencer: {
      togglePlay: () => sequencer?.togglePlay(),
      toggleRecord: () => sequencer?.toggleRecord(),
      toggleStep: (i: number) => sequencer?.toggleStep(i),
      rest: () => sequencer?.rest(),
      clear: () => sequencer?.clear(),
    },
  }
}

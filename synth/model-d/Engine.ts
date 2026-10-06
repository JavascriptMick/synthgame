// Model D engine: a monophonic three-oscillator voice in the style of the
// Minimoog Model D.
//
//   osc 1/2/3, noise, ext (feedback) -> mixer -> soft saturation
//     -> 24 dB/oct low-pass (cutoff, emphasis, contour, key tracking)
//     -> loudness contour (VCA) -> output
//
// Modulation follows the Behringer Model D: MOD MIX blends source A (osc 3 or
// the filter contour) with source B (noise or the LFO); MOD DEPTH (standing in
// for the Minimoog's mod wheel) sets how much reaches the oscillators and/or
// the filter, as chosen by the OSC MODULATION and FILTER MODULATION switches.
// A mod wheel can push the depth above the knob setting.
//
// The keybed arpeggiator (an addition; the original has none) drives the
// voice directly, bypassing low-note priority so rising patterns work.
//
// As in Voice.ts, modulation is routed through Tone.Gain nodes because Tone's
// Signal/Envelope connections override (zero) the parameter they connect to.

import * as Tone from 'tone'
import { Arpeggiator, type ArpOrder } from '../core/Arpeggiator'
import { OutputStage, type SynthEngine } from '../core/engine'
import type { GenericPatch, PatchValue } from '../core/params'
import {
  contourSeconds,
  cutoffHz,
  glideSeconds,
  lfoHz,
  oscFreqCents,
  PARAM_IDS,
  PARAMS,
  tuneCents,
  type ParamId,
  type Patch,
} from './params'

type Range = Patch['osc1Range']
type Wave = Patch['osc1Wave'] | Patch['osc3Wave']

const RANGE_CENTS: Record<Range, number> = {
  // LO drops osc 3 (or any oscillator) into the sub-audio range.
  lo: -9600,
  '32': -2400,
  '16': -1200,
  '8': 0,
  '4': 1200,
  '2': 2400,
}

/** Osc 3 without keyboard control holds this pitch (before range and frequency). */
const OSC3_FIXED_HZ = 261.63
/** Release time when the DECAY switch is off. */
const SHORT_RELEASE = 0.01
const MIXER_GAIN = 0.32
const OUTPUT_GAIN = 0.8
const PITCH_BEND_CENTS = 200
/** Full mod wheel with the modulation switches on. */
const OSC_MOD_CENTS = 700
const FILTER_MOD_CENTS = 4800
/** AMOUNT OF CONTOUR at 10, in cents of cutoff sweep. */
const CONTOUR_CENTS = 8400
/** Maximum loop gain of the ext-input feedback patch. */
const FEEDBACK_GAIN = 1.6
const SWITCH_RAMP = 0.01

/** Sine-series partials of an odd waveform, given b(n) for the n-th harmonic. */
function partials(b: (n: number) => number, count = 64): number[] {
  return Array.from({ length: count }, (_, i) => b(i + 1))
}
const SAW = partials((n) => ((n % 2 ? 1 : -1) * 2) / (Math.PI * n))
const TRI = partials((n) => (n % 2 ? (8 / (Math.PI * Math.PI * n * n)) * (((n - 1) / 2) % 2 ? -1 : 1) : 0))
/** The Minimoog "shark fin": halfway between triangle and sawtooth. */
const TRI_SAW = SAW.map((s, i) => 0.5 * s + 0.5 * TRI[i])
const REV_SAW = SAW.map((s) => -s)

/** Pulse widths in Tone's PulseOscillator terms (duty = (1 - width) / 2). */
const PULSE_WIDTH = { square: 0, wide: 0.4, narrow: 0.8 } as const

class Oscillator {
  readonly osc = new Tone.OmniOscillator({ type: 'sawtooth' })
  private wave: Wave | null = null
  private rangeCents = 0
  private freqCents = 0
  private tuneCents = 0

  constructor() {
    this.osc.start()
  }

  setWave(wave: Wave) {
    if (wave === this.wave) return
    this.wave = wave
    if (wave === 'square' || wave === 'wide' || wave === 'narrow') {
      this.osc.type = 'pulse'
      this.osc.width?.setValueAtTime(PULSE_WIDTH[wave], Tone.now())
      return
    }
    // Partials are ignored while the oscillator is a pulse, so leave pulse mode first.
    if (this.osc.baseType === 'pulse') this.osc.type = 'sine'
    this.osc.partials = wave === 'tri' ? TRI : wave === 'saw' ? SAW : wave === 'revsaw' ? REV_SAW : TRI_SAW
  }

  setRange(range: Range) {
    this.rangeCents = RANGE_CENTS[range]
    this.applyDetune()
  }

  setFrequencyCents(cents: number) {
    this.freqCents = cents
    this.applyDetune()
  }

  setTuneCents(cents: number) {
    this.tuneCents = cents
    this.applyDetune()
  }

  private applyDetune() {
    this.osc.detune.rampTo(this.rangeCents + this.freqCents + this.tuneCents, SWITCH_RAMP)
  }

  dispose() {
    this.osc.dispose()
  }
}

export class ModelDEngine implements SynthEngine {
  private readonly output = new OutputStage()
  readonly analyser = this.output.analyser

  private readonly frequency = new Tone.Signal<'frequency'>(261.63, 'frequency')
  private readonly osc1 = new Oscillator()
  private readonly osc2 = new Oscillator()
  private readonly osc3 = new Oscillator()
  private readonly noise = new Tone.Noise('white')

  // Osc 3 frequency: follows the keyboard or holds a fixed pitch.
  private readonly osc3KeyGate = new Tone.Gain(1)
  private readonly osc3FixedHz = new Tone.Signal(OSC3_FIXED_HZ)
  private readonly osc3FixedGate = new Tone.Gain(0)

  // Pitch bend reaches all three oscillators (osc 3 only while it follows the
  // keyboard); OSC MODULATION reaches osc 1 and 2 only. Keeping them apart
  // matters: osc 3 can be the mod source, and routing modulation back into
  // osc 3 would form a delay-free cycle, which Web Audio silences entirely.
  private readonly bendBus = new Tone.Gain(1)
  private readonly osc3BendGate = new Tone.Gain(1)
  private readonly pitchBend = new Tone.Signal(0)
  private readonly oscModBus = new Tone.Gain(1)

  // Mixer
  private readonly osc1Vol = new Tone.Gain(0)
  private readonly osc2Vol = new Tone.Gain(0)
  private readonly osc3Vol = new Tone.Gain(0)
  private readonly noiseVol = new Tone.Gain(0)
  private readonly extVol = new Tone.Gain(0)
  private readonly feedbackDelay = new Tone.Delay(0.003, 0.01)
  private readonly mixer = new Tone.Gain(MIXER_GAIN)
  private readonly saturator = new Tone.WaveShaper((x) => Math.tanh(2.5 * x) / Math.tanh(2.5), 2048)

  // Filter and contours
  private readonly filter = new Tone.Filter({ type: 'lowpass', rolloff: -24, frequency: 2000, Q: 0.5 })
  /** A ladder filter loses passband level as emphasis rises; this models that and tames the peak. */
  private readonly emphasisMakeup = new Tone.Gain(1)
  private readonly filterMod = new Tone.Gain(1)
  private readonly filterEnv = new Tone.Envelope({ attack: 0.002, decay: 0.3, sustain: 0.4, release: SHORT_RELEASE })
  private readonly contourAmount = new Tone.Gain(0)
  private readonly vca = new Tone.AmplitudeEnvelope({ attack: 0.002, decay: 0.3, sustain: 1, release: SHORT_RELEASE })
  private readonly outputGain = new Tone.Gain(OUTPUT_GAIN)

  // Modulation matrix
  private readonly lfo = new Tone.Oscillator({ type: 'triangle', frequency: 2 })
  private readonly sourceAOsc3 = new Tone.Gain(1)
  private readonly sourceAEnv = new Tone.Gain(0)
  private readonly sourceBNoise = new Tone.Gain(1)
  private readonly sourceBLfo = new Tone.Gain(0)
  private readonly mixA = new Tone.Gain(1)
  private readonly mixB = new Tone.Gain(0)
  private readonly modWheel = new Tone.Gain(0)
  private readonly oscModGate = new Tone.Gain(0)
  private readonly filterModGate = new Tone.Gain(0)

  private readonly a440 = new Tone.Oscillator({ type: 'sine', frequency: 440 })
  private readonly a440Gate = new Tone.Gain(0)

  private readonly arp = new Arpeggiator(
    {
      noteOn: (midi, time) => this.arpNoteOn(midi, time),
      noteOff: (midi, time) => this.arpNoteOff(midi, time),
    },
    { order: 'rise', octaves: 1, division: '16n', gate: 0.5 },
  )
  /** Note currently sounding from the arpeggiator, if any. */
  private arpNote: number | null = null

  private p: Patch
  /** Mod wheel position (on-screen or MIDI), 0..1. */
  private wheel = 0
  /** Held keys; the lowest one sounds (low-note priority, as on the original). */
  private held: number[] = []
  private soundingNote: number | null = null
  private keyTrack = 0

  constructor(patch: GenericPatch) {
    this.p = { ...(patch as Patch) }

    // Oscillator pitch
    this.frequency.connect(this.osc1.osc.frequency)
    this.frequency.connect(this.osc2.osc.frequency)
    this.osc3.osc.frequency.value = 0
    this.frequency.chain(this.osc3KeyGate, this.osc3.osc.frequency)
    this.osc3FixedHz.chain(this.osc3FixedGate, this.osc3.osc.frequency)
    this.pitchBend.connect(this.bendBus)
    this.bendBus.connect(this.osc1.osc.detune)
    this.bendBus.connect(this.osc2.osc.detune)
    this.bendBus.chain(this.osc3BendGate, this.osc3.osc.detune)
    this.oscModBus.connect(this.osc1.osc.detune)
    this.oscModBus.connect(this.osc2.osc.detune)

    // Mixer -> saturation -> filter -> VCA -> output
    this.osc1.osc.connect(this.osc1Vol)
    this.osc2.osc.connect(this.osc2Vol)
    this.osc3.osc.connect(this.osc3Vol)
    this.noise.connect(this.noiseVol)
    for (const g of [this.osc1Vol, this.osc2Vol, this.osc3Vol, this.noiseVol, this.extVol]) g.connect(this.mixer)
    this.saturator.oversample = '2x'
    this.mixer.chain(this.saturator, this.filter, this.emphasisMakeup, this.vca, this.outputGain, this.output.input)
    // The classic patch: output back into EXT INPUT for overdrive. A loop needs a delay.
    this.vca.chain(this.feedbackDelay, this.extVol)

    // Filter contour
    this.filterMod.connect(this.filter.detune)
    this.filterEnv.connect(this.contourAmount)
    this.contourAmount.connect(this.filterMod)

    // Modulation matrix
    this.osc3.osc.connect(this.sourceAOsc3)
    this.filterEnv.connect(this.sourceAEnv)
    this.noise.connect(this.sourceBNoise)
    this.lfo.connect(this.sourceBLfo)
    this.sourceAOsc3.connect(this.mixA)
    this.sourceAEnv.connect(this.mixA)
    this.sourceBNoise.connect(this.mixB)
    this.sourceBLfo.connect(this.mixB)
    this.mixA.connect(this.modWheel)
    this.mixB.connect(this.modWheel)
    this.modWheel.connect(this.oscModGate)
    this.modWheel.connect(this.filterModGate)
    this.oscModGate.connect(this.oscModBus)
    this.filterModGate.connect(this.filterMod)

    this.a440.chain(this.a440Gate, this.output.input)

    this.noise.start()
    this.lfo.start()
    this.a440.start()
    this.applyPatch(this.p)
  }

  // --- Parameters ----------------------------------------------------------

  applyPatch(patch: GenericPatch) {
    this.allNotesOff()
    this.p = { ...(patch as Patch) }
    for (const id of PARAM_IDS) this.apply(id)
  }

  setParam(id: string, value: PatchValue) {
    if (!(id in PARAMS)) throw new Error(`Unknown Model D parameter ${id}`)
    const key = id as ParamId
    if (this.p[key] === value) return
    ;(this.p as Record<ParamId, PatchValue>)[key] = value
    this.apply(key)
  }

  private apply(id: ParamId) {
    const p = this.p
    switch (id) {
      case 'tune':
        for (const osc of [this.osc1, this.osc2, this.osc3]) osc.setTuneCents(tuneCents(p.tune))
        break
      case 'glide':
      case 'glideOn':
        break // read at note-on
      case 'modDepth':
        this.applyModDepth()
        break
      case 'modMix':
        this.mixA.gain.rampTo(1 - p.modMix, SWITCH_RAMP)
        this.mixB.gain.rampTo(p.modMix, SWITCH_RAMP)
        break
      case 'modSourceA':
        this.sourceAOsc3.gain.rampTo(p.modSourceA === 'osc3' ? 1 : 0, SWITCH_RAMP)
        this.sourceAEnv.gain.rampTo(p.modSourceA === 'filterEg' ? 1 : 0, SWITCH_RAMP)
        break
      case 'modSourceB':
        this.sourceBNoise.gain.rampTo(p.modSourceB === 'noise' ? 1 : 0, SWITCH_RAMP)
        this.sourceBLfo.gain.rampTo(p.modSourceB === 'lfo' ? 1 : 0, SWITCH_RAMP)
        break
      case 'oscMod':
        this.oscModGate.gain.rampTo(p.oscMod === 'on' ? OSC_MOD_CENTS : 0, SWITCH_RAMP)
        break
      case 'lfoRate':
        this.lfo.frequency.rampTo(lfoHz(p.lfoRate), SWITCH_RAMP)
        break
      case 'lfoWave':
        this.lfo.type = p.lfoWave === 'tri' ? 'triangle' : 'square'
        break

      case 'osc1Range':
        this.osc1.setRange(p.osc1Range)
        break
      case 'osc1Wave':
        this.osc1.setWave(p.osc1Wave)
        break
      case 'osc2Range':
        this.osc2.setRange(p.osc2Range)
        break
      case 'osc2Freq':
        this.osc2.setFrequencyCents(oscFreqCents(p.osc2Freq))
        break
      case 'osc2Wave':
        this.osc2.setWave(p.osc2Wave)
        break
      case 'osc3Range':
        this.osc3.setRange(p.osc3Range)
        break
      case 'osc3Freq':
        this.osc3.setFrequencyCents(oscFreqCents(p.osc3Freq))
        break
      case 'osc3Wave':
        this.osc3.setWave(p.osc3Wave)
        break
      case 'osc3Control': {
        const keyboard = p.osc3Control === 'on'
        this.osc3KeyGate.gain.rampTo(keyboard ? 1 : 0, SWITCH_RAMP)
        this.osc3FixedGate.gain.rampTo(keyboard ? 0 : 1, SWITCH_RAMP)
        this.osc3BendGate.gain.rampTo(keyboard ? 1 : 0, SWITCH_RAMP)
        break
      }

      case 'osc1Level':
      case 'osc1On':
        this.osc1Vol.gain.rampTo(p.osc1On === 'on' ? p.osc1Level : 0, SWITCH_RAMP)
        break
      case 'osc2Level':
      case 'osc2On':
        this.osc2Vol.gain.rampTo(p.osc2On === 'on' ? p.osc2Level : 0, SWITCH_RAMP)
        break
      case 'osc3Level':
      case 'osc3On':
        this.osc3Vol.gain.rampTo(p.osc3On === 'on' ? p.osc3Level : 0, SWITCH_RAMP)
        break
      case 'noiseLevel':
      case 'noiseOn':
        this.noiseVol.gain.rampTo(p.noiseOn === 'on' ? p.noiseLevel : 0, SWITCH_RAMP)
        break
      case 'noiseColor':
        this.noise.type = p.noiseColor
        break
      case 'extLevel':
      case 'extOn':
        this.extVol.gain.rampTo(p.extOn === 'on' ? p.extLevel * FEEDBACK_GAIN : 0, SWITCH_RAMP)
        break

      case 'cutoff':
        this.filter.frequency.rampTo(cutoffHz(p.cutoff), SWITCH_RAMP)
        break
      case 'emphasis': {
        // Lowpass Q is in dB per stage; two stages give the ladder's sharp peak.
        // Make-up gain takes back half of the total peak (2 stages x Q dB).
        const qDb = 0.5 + p.emphasis * 13
        this.filter.Q.rampTo(qDb, SWITCH_RAMP)
        this.emphasisMakeup.gain.rampTo(Tone.dbToGain(-qDb), SWITCH_RAMP)
        break
      }
      case 'contourAmount':
        this.contourAmount.gain.rampTo(p.contourAmount * CONTOUR_CENTS, SWITCH_RAMP)
        break
      case 'filterMod':
        this.filterModGate.gain.rampTo(p.filterMod === 'on' ? FILTER_MOD_CENTS : 0, SWITCH_RAMP)
        break
      case 'keyTrack1':
      case 'keyTrack2':
        // Switch 1 gives 1/3 and switch 2 gives 2/3 tracking; both together track fully.
        this.keyTrack = (p.keyTrack1 === 'on' ? 1 / 3 : 0) + (p.keyTrack2 === 'on' ? 2 / 3 : 0)
        if (this.soundingNote !== null) this.applyKeyTrack(this.soundingNote, Tone.immediate())
        break

      case 'filterAttack':
      case 'filterDecay':
      case 'filterSustain':
      case 'loudAttack':
      case 'loudDecay':
      case 'loudSustain':
      case 'decaySwitch':
        this.applyContours()
        break

      case 'volume':
        this.output.setGain(p.volume ** 2)
        break
      case 'a440':
        this.a440Gate.gain.rampTo(p.a440 === 'on' ? 0.3 : 0, SWITCH_RAMP)
        break

      case 'arp':
        // Switching between direct play and the arpeggiator starts from silence.
        this.allNotesOff()
        break
      case 'arpMode':
      case 'arpRange':
      case 'arpRate':
      case 'arpGate':
        this.arp.set({
          order: p.arpMode satisfies ArpOrder,
          octaves: Number(p.arpRange),
          division: p.arpRate,
          gate: p.arpGate,
        })
        break
      case 'tempo':
        Tone.getTransport().bpm.value = p.tempo
        break
      default: {
        const unhandled: never = id
        throw new Error(`Unhandled parameter ${String(unhandled)}`)
      }
    }
  }

  /** With DECAY on, releasing the key lets the contours fall at their decay rate. */
  private applyContours() {
    const p = this.p
    const decayOn = p.decaySwitch === 'on'
    this.filterEnv.attack = contourSeconds(p.filterAttack)
    this.filterEnv.decay = contourSeconds(p.filterDecay)
    this.filterEnv.sustain = p.filterSustain
    this.filterEnv.release = decayOn ? contourSeconds(p.filterDecay) : SHORT_RELEASE
    this.vca.attack = contourSeconds(p.loudAttack)
    this.vca.decay = contourSeconds(p.loudDecay)
    this.vca.sustain = p.loudSustain
    this.vca.release = decayOn ? contourSeconds(p.loudDecay) : SHORT_RELEASE
  }

  private applyKeyTrack(midi: number, time: number) {
    this.filter.detune.setValueAtTime(this.keyTrack * (midi - 60) * 100, time)
  }

  // --- Performance controls ------------------------------------------------

  setPitchBend(amount: number) {
    this.pitchBend.rampTo(amount * PITCH_BEND_CENTS, 0.01)
  }

  setModulation(amount: number) {
    this.wheel = Math.max(0, amount)
    this.applyModDepth()
  }

  /**
   * Depth is whichever is higher, the MOD DEPTH knob or the wheel. The squared
   * response gives fine control over subtle vibrato at the bottom of the range.
   */
  private applyModDepth() {
    this.modWheel.gain.rampTo(Math.max(this.p.modDepth, this.wheel) ** 2, 0.02)
  }

  setArpLatch(on: boolean) {
    this.arp.setLatch(on)
  }

  // --- Notes: monophonic, low-note priority, single trigger -------------------

  noteOn(midi: number, _velocity?: number, time = Tone.immediate()) {
    if (this.p.arp === 'on') {
      this.arp.noteOn(midi)
      return
    }
    const wasIdle = this.held.length === 0
    if (!this.held.includes(midi)) this.held.push(midi)
    this.updatePitch(time)
    // Like the original, the contours only restart when playing detached (not legato).
    if (wasIdle) {
      this.filterEnv.triggerAttack(time)
      this.vca.triggerAttack(time)
    }
  }

  noteOff(midi: number, time = Tone.immediate()) {
    if (this.p.arp === 'on') {
      this.arp.noteOff(midi)
      return
    }
    if (!this.held.includes(midi)) return
    this.held = this.held.filter((n) => n !== midi)
    if (this.held.length === 0) {
      this.filterEnv.triggerRelease(time)
      this.vca.triggerRelease(time)
    } else {
      this.updatePitch(time)
    }
  }

  allNotesOff() {
    const now = Tone.immediate()
    this.held = []
    this.arp.clear()
    this.arpNote = null
    this.filterEnv.triggerRelease(now)
    this.vca.triggerRelease(now)
  }

  private updatePitch(time: number) {
    const note = Math.min(...this.held)
    if (note !== this.soundingNote) this.glideTo(note, time)
  }

  /** Each arpeggiated note re-articulates both contours. */
  private arpNoteOn(midi: number, time: number) {
    if (midi !== this.soundingNote) this.glideTo(midi, time)
    this.arpNote = midi
    this.filterEnv.triggerAttack(time)
    this.vca.triggerAttack(time)
  }

  /** At 100% gate the next note can start before this one ends; then there is nothing to release. */
  private arpNoteOff(midi: number, time: number) {
    if (midi !== this.arpNote) return
    this.arpNote = null
    this.filterEnv.triggerRelease(time)
    this.vca.triggerRelease(time)
  }

  private glideTo(note: number, time: number) {
    const hz = Tone.Frequency(note, 'midi').toFrequency()
    const glide = this.p.glideOn === 'on' ? glideSeconds(this.p.glide) : 0
    if (glide > 0 && this.soundingNote !== null) {
      this.frequency.cancelAndHoldAtTime(time)
      this.frequency.exponentialRampToValueAtTime(hz, time + glide)
    } else {
      this.frequency.cancelScheduledValues(time)
      this.frequency.setValueAtTime(hz, time)
    }
    this.soundingNote = note
    this.applyKeyTrack(note, time)
  }

  dispose() {
    this.arp.dispose()
    for (const node of [
      this.osc1,
      this.osc2,
      this.osc3,
      this.noise,
      this.frequency,
      this.osc3KeyGate,
      this.osc3FixedHz,
      this.osc3FixedGate,
      this.bendBus,
      this.osc3BendGate,
      this.pitchBend,
      this.oscModBus,
      this.osc1Vol,
      this.osc2Vol,
      this.osc3Vol,
      this.noiseVol,
      this.extVol,
      this.feedbackDelay,
      this.mixer,
      this.saturator,
      this.filter,
      this.emphasisMakeup,
      this.filterMod,
      this.filterEnv,
      this.contourAmount,
      this.vca,
      this.outputGain,
      this.lfo,
      this.sourceAOsc3,
      this.sourceAEnv,
      this.sourceBNoise,
      this.sourceBLfo,
      this.mixA,
      this.mixB,
      this.modWheel,
      this.oscModGate,
      this.filterModGate,
      this.a440,
      this.a440Gate,
      this.output,
    ]) node.dispose()
  }
}

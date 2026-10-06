// The XD-4 engine: four voices, voice-mode note handling (poly, unison,
// chord, arpeggiator), the global effects chain and the transport clock.

import * as Tone from 'tone'
import {
  cutoffHz,
  delaySeconds,
  egIntDepth,
  envTime,
  lfoHz,
  lfoSyncedHz,
  masterGain,
  modFxRateHz,
  resonanceQ,
  reverbDecay,
  vcoPitchCents,
} from './curves'
import { Arpeggiator } from '../core/Arpeggiator'
import { OutputStage, type SynthEngine } from '../core/engine'
import type { GenericPatch, PatchValue } from '../core/params'
import { arpTypeForDepth, chordForDepth, unisonDetuneCents } from './modes'
import { PARAM_IDS, PARAMS, type ParamId, type Patch } from './params'
import { Voice } from './Voice'

export const VOICE_COUNT = 4

/** Headroom on the summed voices before the effects. */
const VOICE_BUS_GAIN = 0.9
/** Unison stacks all voices on one note, so each is turned down. */
const UNISON_VOICE_LEVEL = 0.55
const PITCH_BEND_RANGE_CENTS = 200
const ARP_GATE = 0.5
const DEFAULT_VELOCITY = 0.8

const OCTAVE_SHIFT = { '16': -1, '8': 0, '4': 1, '2': 2 } as const
const KEY_TRACK = { '0': 0, '50': 0.5, '100': 1 } as const
const REVERB_TYPES = {
  room: { decayScale: 0.3, preDelay: 0.004 },
  plate: { decayScale: 0.6, preDelay: 0.01 },
  hall: { decayScale: 1, preDelay: 0.025 },
  space: { decayScale: 2, preDelay: 0.05 },
} as const
const MOD_FX_WET = { chorus: 0.5, ensemble: 0.6, phaser: 0.6, flanger: 0.5 } as const

type ModFxType = keyof typeof MOD_FX_WET

export class Xd4Engine implements SynthEngine {
  private readonly voices: Voice[] = []
  private readonly voiceBus = new Tone.Gain(VOICE_BUS_GAIN)
  private readonly pitchBend = new Tone.Signal(0)

  private readonly modFx = {
    chorus: new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.6, spread: 180, wet: 0 }).start(),
    ensemble: new Tone.Chorus({ frequency: 4, delayTime: 7, depth: 0.25, spread: 120, wet: 0 }).start(),
    phaser: new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 350, Q: 6, wet: 0 }),
    flanger: new Tone.Chorus({ frequency: 0.3, delayTime: 1.5, depth: 0.9, feedback: 0.6, spread: 90, wet: 0 }).start(),
  } satisfies Record<ModFxType, Tone.Chorus | Tone.Phaser>
  private readonly stereoDelay = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.3, maxDelay: 2, wet: 0 })
  private readonly pingPongDelay = new Tone.PingPongDelay({ delayTime: 0.3, feedback: 0.3, maxDelay: 2, wet: 0 })
  private readonly reverb = new Tone.Reverb({ decay: 3, preDelay: 0.02, wet: 0 })
  private readonly output = new OutputStage()
  readonly analyser = this.output.analyser

  private readonly transport = Tone.getTransport()
  private p: Patch

  // Poly voice allocation
  private readonly voiceNotes: (number | null)[] = Array(VOICE_COUNT).fill(null)
  private readonly voiceStamps: number[] = Array(VOICE_COUNT).fill(0)
  private stampCounter = 0

  // Keys currently held for poly/unison/chord, in the order pressed
  private held: number[] = []
  private readonly velocities = new Map<number, number>()
  private monoNote: number | null = null

  // Arpeggiator: plays the poly voices directly; pattern and range come from VOICE MODE DEPTH.
  private readonly arp = new Arpeggiator(
    {
      noteOn: (midi, time) => this.polyNoteOn(midi, DEFAULT_VELOCITY, time),
      noteOff: (midi, time) => this.polyNoteOff(midi, time),
    },
    { order: 'manual', octaves: 1, division: '16n', gate: ARP_GATE },
  )

  private reverbTimer: ReturnType<typeof setTimeout> | undefined

  constructor(patch: GenericPatch) {
    this.p = { ...(patch as Patch) }

    for (let i = 0; i < VOICE_COUNT; i++) {
      const voice = new Voice()
      voice.output.connect(this.voiceBus)
      this.pitchBend.connect(voice.pitchBendInput)
      this.voices.push(voice)
    }

    this.voiceBus.chain(
      this.modFx.chorus,
      this.modFx.ensemble,
      this.modFx.phaser,
      this.modFx.flanger,
      this.stereoDelay,
      this.pingPongDelay,
      this.reverb,
      this.output.input,
    )

    this.applyPatch(patch)
  }

  // --- Parameters ----------------------------------------------------------

  applyPatch(patch: GenericPatch) {
    this.allNotesOff()
    this.p = { ...(patch as Patch) }
    for (const id of PARAM_IDS) this.apply(id)
  }

  setParam(id: string, value: PatchValue) {
    if (!(id in PARAMS)) throw new Error(`Unknown XD-4 parameter ${id}`)
    const key = id as ParamId
    if (this.p[key] === value) return
    ;(this.p as Record<ParamId, PatchValue>)[key] = value
    this.apply(key)
  }

  private apply(id: ParamId) {
    const p = this.p
    switch (id) {
      case 'masterVolume':
        this.output.setGain(masterGain(p.masterVolume))
        break
      case 'tempo':
        this.transport.bpm.value = p.tempo
        this.applyLfoRate()
        break
      case 'portamento':
        break // read at note-on
      case 'voiceMode':
        this.changeVoiceMode()
        break
      case 'voiceDepth': {
        if (p.voiceMode === 'unison') this.applyUnisonSpread()
        const { order, octaves } = arpTypeForDepth(p.voiceDepth)
        this.arp.set({ order, octaves })
        break
      }

      case 'vco1Wave':
      case 'vco2Wave':
        this.forVoices((v) => v.setVcoWave(id === 'vco1Wave' ? 1 : 2, p[id]))
        break
      case 'vco1Octave':
      case 'vco2Octave':
        this.forVoices((v) => v.setVcoOctave(id === 'vco1Octave' ? 1 : 2, OCTAVE_SHIFT[p[id]]))
        break
      case 'vco1Pitch':
      case 'vco2Pitch':
        this.forVoices((v) => v.setVcoPitch(id === 'vco1Pitch' ? 1 : 2, vcoPitchCents(p[id])))
        break
      case 'vco1Shape':
      case 'vco2Shape':
        this.forVoices((v) => v.setVcoShape(id === 'vco1Shape' ? 1 : 2, p[id]))
        break
      case 'crossMod':
        this.forVoices((v) => v.setCrossMod(p.crossMod))
        break
      case 'ring':
        this.forVoices((v) => v.setRing(p.ring === 'on'))
        break

      case 'multiEngine':
        this.forVoices((v) => v.setMultiEngine(p.multiEngine))
        break
      case 'multiNoiseType':
        this.forVoices((v) => v.setNoiseType(p.multiNoiseType))
        break
      case 'multiVpmType':
        this.forVoices((v) => v.setVpmType(p.multiVpmType))
        break
      case 'multiShape':
        this.forVoices((v) => v.setMultiShape(p.multiShape))
        break

      case 'vco1Level':
        this.forVoices((v) => v.setLevel('vco1', p.vco1Level))
        break
      case 'vco2Level':
        this.forVoices((v) => v.setLevel('vco2', p.vco2Level))
        break
      case 'multiLevel':
        this.forVoices((v) => v.setLevel('multi', p.multiLevel))
        break

      case 'cutoff':
        this.forVoices((v) => v.setCutoff(cutoffHz(p.cutoff)))
        break
      case 'resonance':
        this.forVoices((v) => v.setResonance(resonanceQ(p.resonance)))
        break
      case 'drive':
        this.forVoices((v) => v.setDrive(p.drive))
        break
      case 'keyTrack':
        this.forVoices((v) => v.setKeyTrack(KEY_TRACK[p.keyTrack]))
        break

      case 'ampAttack':
      case 'ampDecay':
      case 'ampSustain':
      case 'ampRelease':
        this.forVoices((v) =>
          v.setAmpEnvelope(envTime(p.ampAttack), envTime(p.ampDecay), p.ampSustain, envTime(p.ampRelease)),
        )
        break

      case 'egAttack':
      case 'egDecay':
        this.forVoices((v) => v.setEgTimes(envTime(p.egAttack), envTime(p.egDecay)))
        break
      case 'egInt':
        this.forVoices((v) => v.setEgInt(egIntDepth(p.egInt)))
        break
      case 'egTarget':
        this.forVoices((v) => v.setEgTarget(p.egTarget))
        break

      case 'lfoWave':
        this.forVoices((v) => v.setLfoWave(p.lfoWave))
        break
      case 'lfoMode':
        this.forVoices((v) => v.setLfoMode(p.lfoMode))
        this.applyLfoRate()
        break
      case 'lfoRate':
        this.applyLfoRate()
        break
      case 'lfoInt':
        this.forVoices((v) => v.setLfoInt(p.lfoInt))
        break
      case 'lfoTarget':
        this.forVoices((v) => v.setLfoTarget(p.lfoTarget))
        break

      case 'modFxOn':
      case 'modFxType':
      case 'modFxTime':
      case 'modFxDepth':
        this.applyModFx()
        break
      case 'delayOn':
      case 'delayType':
      case 'delayTime':
      case 'delayDepth':
        this.applyDelay()
        break
      case 'reverbOn':
      case 'reverbDepth':
        this.applyReverbMix()
        break
      case 'reverbType':
      case 'reverbTime':
        this.scheduleReverbRebuild()
        break
      default: {
        const unhandled: never = id
        throw new Error(`Unhandled parameter ${String(unhandled)}`)
      }
    }
  }

  private forVoices(fn: (voice: Voice) => void) {
    this.voices.forEach(fn)
  }

  private applyLfoRate() {
    const hz = this.p.lfoMode === 'bpm' ? lfoSyncedHz(this.p.lfoRate, this.p.tempo) : lfoHz(this.p.lfoRate)
    this.forVoices((v) => v.setLfoFrequency(hz))
  }

  private applyModFx() {
    const p = this.p
    const rate = modFxRateHz(p.modFxTime)
    const depth = p.modFxDepth
    const { chorus, ensemble, phaser, flanger } = this.modFx
    chorus.frequency.rampTo(rate, 0.05)
    chorus.depth = depth
    ensemble.frequency.rampTo(rate * 2, 0.05)
    ensemble.depth = 0.1 + depth * 0.4
    phaser.frequency.rampTo(rate, 0.05)
    phaser.octaves = 1 + depth * 5
    flanger.frequency.rampTo(rate * 0.5, 0.05)
    flanger.depth = depth
    flanger.feedback.rampTo(0.3 + depth * 0.55, 0.05)
    for (const type of Object.keys(this.modFx) as ModFxType[]) {
      const active = p.modFxOn === 'on' && p.modFxType === type
      this.modFx[type].wet.rampTo(active ? MOD_FX_WET[type] : 0, 0.05)
    }
  }

  private applyDelay() {
    const p = this.p
    const seconds = delaySeconds(p.delayTime)
    const feedback = 0.1 + p.delayDepth * 0.75
    const wet = 0.15 + p.delayDepth * 0.4
    for (const [type, delay] of [
      ['stereo', this.stereoDelay],
      ['pingpong', this.pingPongDelay],
    ] as const) {
      delay.delayTime.rampTo(seconds, 0.1)
      delay.feedback.rampTo(feedback, 0.05)
      delay.wet.rampTo(p.delayOn === 'on' && p.delayType === type ? wet : 0, 0.05)
    }
  }

  private applyReverbMix() {
    this.reverb.wet.rampTo(this.p.reverbOn === 'on' ? this.p.reverbDepth * 0.6 : 0, 0.05)
  }

  /** Regenerating the impulse response is expensive, so knob sweeps are debounced. */
  private scheduleReverbRebuild() {
    clearTimeout(this.reverbTimer)
    this.reverbTimer = setTimeout(() => {
      const type = REVERB_TYPES[this.p.reverbType]
      this.reverb.decay = Math.max(0.1, reverbDecay(this.p.reverbTime) * type.decayScale)
      this.reverb.preDelay = type.preDelay
    }, 150)
  }

  // --- Performance controls ------------------------------------------------

  /** Joystick X / MIDI pitch bend, -1..1. */
  setPitchBend(amount: number) {
    this.pitchBend.rampTo(amount * PITCH_BEND_RANGE_CENTS, 0.01)
  }

  /** Joystick Y / mod wheel, -1..1. */
  setModulation(amount: number) {
    this.forVoices((v) => v.setJoystickY(amount))
  }

  setArpLatch(on: boolean) {
    this.arp.setLatch(on)
  }

  // --- Notes ---------------------------------------------------------------

  noteOn(midi: number, velocity = DEFAULT_VELOCITY, time = Tone.immediate()) {
    if (this.p.voiceMode === 'arp') {
      this.arp.noteOn(midi)
      return
    }
    this.held = this.held.filter((n) => n !== midi)
    this.held.push(midi)
    this.velocities.set(midi, velocity)
    if (this.p.voiceMode === 'poly') this.polyNoteOn(midi, velocity, time)
    else this.updateMono(time)
  }

  noteOff(midi: number, time = Tone.immediate()) {
    if (this.p.voiceMode === 'arp') {
      this.arp.noteOff(midi)
      return
    }
    this.held = this.held.filter((n) => n !== midi)
    this.velocities.delete(midi)
    if (this.p.voiceMode === 'poly') this.polyNoteOff(midi, time)
    else this.updateMono(time)
  }

  allNotesOff() {
    const now = Tone.immediate()
    this.held = []
    this.velocities.clear()
    this.monoNote = null
    this.arp.clear()
    this.voiceNotes.fill(null)
    this.forVoices((v) => v.noteOff(now))
  }

  private glideTime(): number {
    return this.p.portamento ** 2 * 2
  }

  private polyNoteOn(midi: number, velocity: number, time: number) {
    let index = this.voiceNotes.indexOf(midi)
    if (index < 0) index = this.oldestVoice((i) => this.voiceNotes[i] === null)
    if (index < 0) index = this.oldestVoice(() => true)
    this.voiceNotes[index] = midi
    this.voiceStamps[index] = ++this.stampCounter
    this.voices[index].noteOn(midi, velocity, time, this.glideTime(), true)
  }

  private polyNoteOff(midi: number, time: number) {
    const index = this.voiceNotes.indexOf(midi)
    if (index < 0) return
    this.voices[index].noteOff(time)
    this.voiceNotes[index] = null
    // Re-stamp so the most recently released voice is reused last, letting tails ring.
    this.voiceStamps[index] = ++this.stampCounter
  }

  private oldestVoice(filter: (index: number) => boolean): number {
    let best = -1
    for (let i = 0; i < VOICE_COUNT; i++) {
      if (filter(i) && (best < 0 || this.voiceStamps[i] < this.voiceStamps[best])) best = i
    }
    return best
  }

  /** Unison and chord modes are monophonic with last-note priority and legato. */
  private updateMono(time: number) {
    const top = this.held.at(-1)
    if (top === undefined) {
      if (this.monoNote !== null) this.forVoices((v) => v.noteOff(time))
      this.monoNote = null
      return
    }
    if (top === this.monoNote) return
    const legato = this.monoNote !== null
    this.monoNote = top
    const velocity = this.velocities.get(top) ?? DEFAULT_VELOCITY
    const glide = this.glideTime()

    if (this.p.voiceMode === 'unison') {
      this.forVoices((v) => v.noteOn(top, velocity, time, glide, !legato))
      return
    }
    const notes = chordForDepth(this.p.voiceDepth).intervals.map((i) => top + i)
    this.voices.forEach((v, i) => {
      if (i < notes.length) v.noteOn(notes[i], velocity, time, glide, !legato)
      else v.noteOff(time)
    })
  }

  private applyUnisonSpread() {
    const spread = unisonDetuneCents(this.p.voiceDepth)
    this.voices.forEach((v, i) => {
      const position = VOICE_COUNT > 1 ? (i / (VOICE_COUNT - 1)) * 2 - 1 : 0
      v.setOffsetCents(position * spread)
    })
  }

  private changeVoiceMode() {
    this.allNotesOff()
    const unison = this.p.voiceMode === 'unison'
    this.forVoices((v) => v.setOutputLevel(unison ? UNISON_VOICE_LEVEL : 1))
    if (unison) this.applyUnisonSpread()
    else this.forVoices((v) => v.setOffsetCents(0))
  }

  dispose() {
    clearTimeout(this.reverbTimer)
    this.arp.dispose()
    this.voices.forEach((v) => v.dispose())
    for (const node of [
      ...Object.values(this.modFx),
      this.voiceBus,
      this.pitchBend,
      this.stereoDelay,
      this.pingPongDelay,
      this.reverb,
      this.output,
    ]) node.dispose()
  }
}

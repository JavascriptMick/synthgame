// What every synth engine provides to the app, plus the output stage and
// transport helpers they share.

import * as Tone from 'tone'
import type { GenericPatch, PatchValue } from './params'

export interface SynthEngine {
  /** Master output waveform, for oscilloscope displays. */
  readonly analyser: Tone.Waveform
  /** Applies one parameter. Ids and values are validated by the caller against the synth's params. */
  setParam(id: string, value: PatchValue): void
  /** Applies a whole patch (program change) and silences held notes. */
  applyPatch(patch: GenericPatch): void
  /** Times are AudioContext seconds; omitted means "now". Velocity is 0..1. */
  noteOn(midi: number, velocity?: number, time?: number): void
  noteOff(midi: number, time?: number): void
  allNotesOff(): void
  /** -1..1 */
  setPitchBend(amount: number): void
  /** -1..1 (joystick); synths with a unipolar mod wheel treat negatives as 0. */
  setModulation(amount: number): void
  /** Arpeggiator latch, for engines that have an arpeggiator. */
  setArpLatch?(on: boolean): void
  dispose(): void
}

/** Below this level the safety clipper is transparent. */
const CLIP_KNEE = 0.9

/** Linear up to the knee, then a tanh shoulder that never exceeds 1. */
function softClip(x: number): number {
  const a = Math.abs(x)
  if (a <= CLIP_KNEE) return x
  return Math.sign(x) * (CLIP_KNEE + (1 - CLIP_KNEE) * Math.tanh((a - CLIP_KNEE) / (1 - CLIP_KNEE)))
}

/**
 * Master gain -> limiter -> safety clipper -> speakers, with a waveform tap at
 * the end. Tone's Limiter is a fast compressor and lets transients through, so
 * the clipper guarantees the output stays within full scale.
 */
export class OutputStage {
  readonly input = new Tone.Gain(0.5)
  readonly analyser = new Tone.Waveform(1024)
  private readonly limiter = new Tone.Limiter(-1)
  // The waveshaper's input range is -1..1, so halve the signal and map 2x onto the curve.
  private readonly clipperDrive = new Tone.Gain(0.5)
  private readonly clipper = new Tone.WaveShaper((x) => softClip(2 * x), 4096)

  constructor() {
    this.input.chain(this.limiter, this.clipperDrive, this.clipper, Tone.getDestination())
    this.clipper.connect(this.analyser)
  }

  setGain(gain: number) {
    this.input.gain.rampTo(gain, 0.02)
  }

  dispose() {
    this.input.dispose()
    this.limiter.dispose()
    this.clipperDrive.dispose()
    this.clipper.dispose()
    this.analyser.dispose()
  }
}

/** Starts the shared transport clock if it is not already running. */
export function ensureTransportRunning() {
  const transport = Tone.getTransport()
  if (transport.state !== 'started') transport.start()
}

/**
 * Runs `fn` on the transport at audio time `time + delay`, passing that time.
 * The position is given in ticks: transport *seconds* would be converted back
 * at the current tempo, which misplaces the event after any tempo change.
 */
export function scheduleAfter(time: number, delay: number, fn: (time: number) => void) {
  const transport = Tone.getTransport()
  transport.scheduleOnce(fn, `${Math.round(transport.getTicksAtTime(time + delay))}i`)
}

// One voice of the synth: VCO1 + VCO2 + multi engine -> mixer -> drive ->
// 2-pole low-pass filter -> amp EG, plus its own modulation EG and LFO.
//
// Modulation is always routed through Tone.Gain nodes. Tone's Signal, LFO and
// Envelope `connect()` zero the destination parameter (they "override" it),
// whereas a Gain output sums with the parameter's base value - which is what
// lets knob settings and modulation coexist.

import * as Tone from 'tone'

export type Wave = 'saw' | 'tri' | 'sqr'
export type NoiseType = 'high' | 'low' | 'peak' | 'decim'
export type VpmType = 'sin1' | 'sin2' | 'sin3' | 'sin4' | 'saw1' | 'saw2' | 'sqr1' | 'sqr2'
export type EgTarget = 'pitch' | 'pitch2' | 'cutoff'
export type LfoTarget = 'pitch' | 'shape' | 'cutoff'
export type LfoMode = 'bpm' | 'normal' | 'oneshot'

/** Short ramp used when switching gates, to avoid clicks. */
const SWITCH_RAMP = 0.01

// ---------------------------------------------------------------------------
// Wave folder used for the SHAPE of the saw and triangle waves.
// The waveshaper only accepts input in -1..1, so at SHAPE = 0 the signal is
// attenuated to FOLD_MIN and the curve maps that range linearly; turning SHAPE
// up drives the signal further into the folds.

const FOLD_SPAN = 4
const FOLD_MIN = 1 / FOLD_SPAN

function triangleFold(y: number): number {
  const m = (((y + 1) % 4) + 4) % 4
  return 1 - Math.abs(m - 2)
}

let foldCurve: Float32Array | undefined
function getFoldCurve(): Float32Array {
  if (!foldCurve) {
    const n = 4096
    foldCurve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      foldCurve[i] = triangleFold(x * FOLD_SPAN)
    }
  }
  return foldCurve
}

/** Pulse width at SHAPE = 1 for the square wave (0 is a 50% square). */
const MAX_PULSE_WIDTH = 0.9

class Vco {
  readonly output = new Tone.Gain(1)
  /** Pitch modulation input, in cents. */
  readonly detuneIn = new Tone.Gain(1)
  /** Shape modulation input, in SHAPE units (a full-scale knob turn is 1). */
  readonly shapeIn = new Tone.Gain(1)

  private readonly main = new Tone.Oscillator({ type: 'sawtooth' })
  private readonly pulse = new Tone.PulseOscillator({ width: 0 })
  private readonly foldDrive = new Tone.Gain(FOLD_MIN)
  private readonly folder = new Tone.WaveShaper(getFoldCurve())
  private readonly mainGate = new Tone.Gain(1)
  private readonly pulseGate = new Tone.Gain(0)
  private readonly shapeToFold = new Tone.Gain(1 - FOLD_MIN)
  private readonly shapeToWidth = new Tone.Gain(MAX_PULSE_WIDTH)

  private octave = 0
  private pitchCents = 0
  private offsetCents = 0

  constructor(frequency: Tone.Signal<'frequency'>) {
    this.folder.oversample = '2x'
    frequency.connect(this.main.frequency)
    frequency.connect(this.pulse.frequency)
    this.detuneIn.connect(this.main.detune)
    this.detuneIn.connect(this.pulse.detune)
    this.main.chain(this.foldDrive, this.folder, this.mainGate, this.output)
    this.pulse.chain(this.pulseGate, this.output)
    this.shapeIn.connect(this.shapeToFold)
    this.shapeToFold.connect(this.foldDrive.gain)
    this.shapeIn.connect(this.shapeToWidth)
    this.shapeToWidth.connect(this.pulse.width)
    this.main.start()
    this.pulse.start()
  }

  setWave(wave: Wave) {
    const isSquare = wave === 'sqr'
    if (!isSquare) this.main.type = wave === 'saw' ? 'sawtooth' : 'triangle'
    this.mainGate.gain.rampTo(isSquare ? 0 : 1, SWITCH_RAMP)
    this.pulseGate.gain.rampTo(isSquare ? 1 : 0, SWITCH_RAMP)
  }

  setShape(shape: number) {
    this.foldDrive.gain.rampTo(FOLD_MIN + (1 - FOLD_MIN) * shape, SWITCH_RAMP)
    this.pulse.width.rampTo(MAX_PULSE_WIDTH * shape, SWITCH_RAMP)
  }

  /** Octave relative to 8' (16' = -1, 4' = +1, 2' = +2). */
  setOctave(octave: number) {
    this.octave = octave
    this.applyDetune()
  }

  setPitchCents(cents: number) {
    this.pitchCents = cents
    this.applyDetune()
  }

  /** Per-voice offset used to spread the unison stack. */
  setOffsetCents(cents: number, time?: number) {
    this.offsetCents = cents
    this.applyDetune(time)
  }

  private applyDetune(time?: number) {
    const cents = this.octave * 1200 + this.pitchCents + this.offsetCents
    if (time === undefined) {
      this.main.detune.value = cents
      this.pulse.detune.value = cents
    } else {
      this.main.detune.setValueAtTime(cents, time)
      this.pulse.detune.setValueAtTime(cents, time)
    }
  }

  dispose() {
    for (const node of [
      this.main,
      this.pulse,
      this.foldDrive,
      this.folder,
      this.mainGate,
      this.pulseGate,
      this.shapeToFold,
      this.shapeToWidth,
      this.detuneIn,
      this.shapeIn,
      this.output,
    ]) node.dispose()
  }
}

// ---------------------------------------------------------------------------
// Multi engine: filtered noise or a simple two-operator VPM (FM) oscillator.

const VPM_SETTINGS: Record<VpmType, { modulator: Tone.ToneOscillatorType; ratio: number }> = {
  sin1: { modulator: 'sine', ratio: 1 },
  sin2: { modulator: 'sine', ratio: 2 },
  sin3: { modulator: 'sine', ratio: 3 },
  sin4: { modulator: 'sine', ratio: 3.5 },
  saw1: { modulator: 'sawtooth', ratio: 1 },
  saw2: { modulator: 'sawtooth', ratio: 2 },
  sqr1: { modulator: 'square', ratio: 1 },
  sqr2: { modulator: 'square', ratio: 2 },
}

const MAX_FM_INDEX = 8
/** Shape modulation range for the noise filter, in cents. */
const NOISE_SHAPE_MOD_CENTS = 6000
const DECIM_LEVELS = 6

function noiseCutoffHz(shape: number): number {
  return 80 * 150 ** shape
}

let decimCurve: Float32Array | undefined
function getDecimCurve(): Float32Array {
  if (!decimCurve) {
    const n = 1024
    decimCurve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      decimCurve[i] = Math.round(x * DECIM_LEVELS) / DECIM_LEVELS
    }
  }
  return decimCurve
}

class MultiEngine {
  readonly output = new Tone.Gain(1)
  readonly detuneIn = new Tone.Gain(1)
  readonly shapeIn = new Tone.Gain(1)

  private readonly noise = new Tone.Noise('white')
  private readonly noiseFilter = new Tone.Filter({ type: 'highpass', frequency: 1000, Q: 1, rolloff: -12 })
  private readonly noiseDirect = new Tone.Gain(1)
  private readonly decimator = new Tone.WaveShaper(getDecimCurve())
  private readonly decimGate = new Tone.Gain(0)
  private readonly noiseGate = new Tone.Gain(1)
  private readonly shapeToNoise = new Tone.Gain(NOISE_SHAPE_MOD_CENTS)

  private readonly carrier = new Tone.Oscillator({ type: 'sine' })
  private readonly modulator = new Tone.Oscillator({ type: 'sine' })
  private readonly ratio = new Tone.Multiply(1)
  private readonly index = new Tone.Multiply(0)
  private readonly modDepth = new Tone.Gain(0)
  private readonly vpmGate = new Tone.Gain(0)
  private readonly shapeToIndex = new Tone.Gain(MAX_FM_INDEX)

  private shape = 0.5
  private noiseType: NoiseType = 'high'

  constructor(frequency: Tone.Signal<'frequency'>) {
    // Noise path
    this.noise.connect(this.noiseFilter)
    this.noiseFilter.chain(this.noiseDirect, this.noiseGate)
    this.noiseFilter.chain(this.decimator, this.decimGate, this.noiseGate)
    this.noiseGate.connect(this.output)
    this.shapeIn.connect(this.shapeToNoise)
    this.shapeToNoise.connect(this.noiseFilter.detune)

    // VPM path: linear FM with a deviation proportional to the note frequency.
    frequency.connect(this.carrier.frequency)
    frequency.chain(this.ratio, this.modulator.frequency)
    frequency.chain(this.index, this.modDepth.gain)
    this.modulator.connect(this.modDepth)
    this.modDepth.connect(this.carrier.frequency)
    this.detuneIn.connect(this.carrier.detune)
    this.detuneIn.connect(this.modulator.detune)
    this.shapeIn.connect(this.shapeToIndex)
    this.shapeToIndex.connect(this.index.factor)
    this.carrier.chain(this.vpmGate, this.output)

    this.noise.start()
    this.carrier.start()
    this.modulator.start()
  }

  setEngine(engine: 'noise' | 'vpm') {
    this.noiseGate.gain.rampTo(engine === 'noise' ? 1 : 0, SWITCH_RAMP)
    this.vpmGate.gain.rampTo(engine === 'vpm' ? 1 : 0, SWITCH_RAMP)
  }

  setNoiseType(type: NoiseType) {
    this.noiseType = type
    const isDecim = type === 'decim'
    this.noiseFilter.type = type === 'high' ? 'highpass' : type === 'peak' ? 'bandpass' : 'lowpass'
    this.noiseFilter.Q.value = type === 'peak' ? 12 : 1
    this.noiseDirect.gain.rampTo(isDecim ? 0 : 1, SWITCH_RAMP)
    this.decimGate.gain.rampTo(isDecim ? 1 : 0, SWITCH_RAMP)
    this.applyShape()
  }

  setVpmType(type: VpmType) {
    const s = VPM_SETTINGS[type]
    this.modulator.type = s.modulator
    this.ratio.factor.value = s.ratio
  }

  setShape(shape: number) {
    this.shape = shape
    this.applyShape()
  }

  private applyShape() {
    // Decimated noise sounds best with a lower, more audible band.
    const shape = this.noiseType === 'decim' ? this.shape * 0.6 : this.shape
    this.noiseFilter.frequency.rampTo(noiseCutoffHz(shape), SWITCH_RAMP)
    this.index.factor.rampTo(this.shape * MAX_FM_INDEX, SWITCH_RAMP)
  }

  dispose() {
    for (const node of [
      this.noise,
      this.noiseFilter,
      this.noiseDirect,
      this.decimator,
      this.decimGate,
      this.noiseGate,
      this.shapeToNoise,
      this.carrier,
      this.modulator,
      this.ratio,
      this.index,
      this.modDepth,
      this.vpmGate,
      this.shapeToIndex,
      this.detuneIn,
      this.shapeIn,
      this.output,
    ]) node.dispose()
  }
}

// ---------------------------------------------------------------------------

/** Mixer headroom: three full-level sources sum well above unity. */
const MIX_SCALE = 0.45
/** EG INT at full scale, in cents. */
const EG_CUTOFF_RANGE = 7200
const EG_PITCH_RANGE = 2400
/** LFO INT at full scale. */
const LFO_CUTOFF_RANGE = 4800
const LFO_PITCH_RANGE = 1200
const LFO_SHAPE_RANGE = 0.5
/** Cross mod depth at full scale, in cents of VCO2 deviation. */
const CROSS_MOD_RANGE = 3600
/** Joystick Y at full deflection. */
const JOY_PITCH_RANGE = 100
const JOY_CUTOFF_RANGE = 2400

const DRIVE: Record<'0' | '50' | '100', { amount: number; wet: number }> = {
  '0': { amount: 0, wet: 0 },
  '50': { amount: 0.3, wet: 1 },
  '100': { amount: 0.7, wet: 1 },
}

export class Voice {
  readonly output = new Tone.Gain(1)

  private readonly frequency = new Tone.Signal<'frequency'>(440, 'frequency')
  private readonly vco1 = new Vco(this.frequency)
  private readonly vco2 = new Vco(this.frequency)
  private readonly multi = new MultiEngine(this.frequency)

  // Modulation buses
  private readonly pitchAll = new Tone.Gain(1)
  private readonly pitch2 = new Tone.Gain(1)
  private readonly shapeMod = new Tone.Gain(1)
  private readonly filterMod = new Tone.Gain(1)

  // VCO2 routing: direct, ring modulated, and cross modulated by VCO1
  private readonly crossMod = new Tone.Gain(0)
  private readonly vco2Direct = new Tone.Gain(1)
  private readonly ringVca = new Tone.Gain(0)
  private readonly ringGate = new Tone.Gain(0)

  // Mixer
  private readonly vco1Level = new Tone.Gain(1)
  private readonly vco2Level = new Tone.Gain(0)
  private readonly multiLevel = new Tone.Gain(0)
  private readonly mixer = new Tone.Gain(MIX_SCALE)

  private readonly drive = new Tone.Distortion({ distortion: 0, wet: 0, oversample: '2x' })
  private readonly filter = new Tone.Filter({ type: 'lowpass', rolloff: -12, frequency: 20000, Q: 0.7 })
  private readonly amp = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.5, sustain: 1, release: 0.2 })

  // EG (attack/decay, no sustain)
  private readonly eg = new Tone.Envelope({ attack: 0.002, decay: 0.5, sustain: 0, release: 0.5 })
  private readonly egCutoff = new Tone.Gain(0)
  private readonly egPitch = new Tone.Gain(0)
  private readonly egPitch2 = new Tone.Gain(0)
  private egInt = 0
  private egTarget: EgTarget = 'cutoff'

  // LFO
  private readonly lfo = new Tone.Oscillator({ type: 'triangle', frequency: 1 })
  private readonly lfoCutoff = new Tone.Gain(0)
  private readonly lfoPitch = new Tone.Gain(0)
  private readonly lfoShape = new Tone.Gain(0)
  private readonly joyPitch = new Tone.Gain(0)
  private readonly joyCutoff = new Tone.Gain(0)
  private lfoInt = 0
  private lfoTarget: LfoTarget = 'cutoff'
  private lfoMode: LfoMode = 'normal'
  private lfoHz = 1

  private keyTrack = 0
  private hasPlayed = false

  constructor() {
    // Modulation buses
    this.pitchAll.connect(this.vco1.detuneIn)
    this.pitchAll.connect(this.vco2.detuneIn)
    this.pitchAll.connect(this.multi.detuneIn)
    this.pitch2.connect(this.vco2.detuneIn)
    this.shapeMod.connect(this.vco1.shapeIn)
    this.shapeMod.connect(this.vco2.shapeIn)
    this.shapeMod.connect(this.multi.shapeIn)
    this.filterMod.connect(this.filter.detune)

    // VCO2 routing
    this.vco1.output.connect(this.crossMod)
    this.crossMod.connect(this.pitch2)
    this.vco2.output.chain(this.vco2Direct, this.vco2Level)
    this.vco2.output.chain(this.ringVca, this.ringGate, this.vco2Level)
    this.vco1.output.connect(this.ringVca.gain)

    // Mixer -> drive -> filter -> amp
    this.vco1.output.connect(this.vco1Level)
    this.multi.output.connect(this.multiLevel)
    this.vco1Level.connect(this.mixer)
    this.vco2Level.connect(this.mixer)
    this.multiLevel.connect(this.mixer)
    this.mixer.chain(this.drive, this.filter, this.amp, this.output)

    // EG
    this.eg.connect(this.egCutoff)
    this.eg.connect(this.egPitch)
    this.eg.connect(this.egPitch2)
    this.egCutoff.connect(this.filterMod)
    this.egPitch.connect(this.pitchAll)
    this.egPitch2.connect(this.pitch2)

    // LFO
    for (const g of [this.lfoCutoff, this.lfoPitch, this.lfoShape, this.joyPitch, this.joyCutoff]) this.lfo.connect(g)
    this.lfoCutoff.connect(this.filterMod)
    this.lfoPitch.connect(this.pitchAll)
    this.lfoShape.connect(this.shapeMod)
    this.joyPitch.connect(this.pitchAll)
    this.joyCutoff.connect(this.filterMod)
    this.lfo.start()
  }

  /** Global pitch bend (cents) is fed in from the engine. */
  get pitchBendInput(): Tone.Gain {
    return this.pitchAll
  }

  // --- Notes ---------------------------------------------------------------

  noteOn(midi: number, velocity: number, time: number, glide: number, retrigger: boolean) {
    const hz = Tone.Frequency(midi, 'midi').toFrequency()
    if (glide > 0 && this.hasPlayed) {
      this.frequency.cancelAndHoldAtTime(time)
      this.frequency.exponentialRampToValueAtTime(hz, time + glide)
    } else {
      this.frequency.cancelScheduledValues(time)
      this.frequency.setValueAtTime(hz, time)
    }
    this.hasPlayed = true
    this.filter.detune.setValueAtTime(this.keyTrack * (midi - 60) * 100, time)
    if (retrigger) {
      this.amp.triggerAttack(time, velocity)
      this.eg.triggerAttack(time)
      if (this.lfoMode === 'oneshot') {
        this.lfo.stop(time)
        this.lfo.start(time)
        this.lfo.stop(time + 1 / this.lfoHz)
      }
    }
  }

  noteOff(time: number) {
    this.amp.triggerRelease(time)
    this.eg.triggerRelease(time)
  }

  /** Detune offset applied to both VCOs, used to spread unison voices. */
  setOffsetCents(cents: number, time?: number) {
    this.vco1.setOffsetCents(cents, time)
    this.vco2.setOffsetCents(cents, time)
  }

  setOutputLevel(level: number) {
    this.output.gain.rampTo(level, SWITCH_RAMP)
  }

  // --- Oscillators ---------------------------------------------------------

  setVcoWave(n: 1 | 2, wave: Wave) {
    this.vco(n).setWave(wave)
  }

  setVcoOctave(n: 1 | 2, octave: number) {
    this.vco(n).setOctave(octave)
  }

  setVcoPitch(n: 1 | 2, cents: number) {
    this.vco(n).setPitchCents(cents)
  }

  setVcoShape(n: 1 | 2, shape: number) {
    this.vco(n).setShape(shape)
  }

  setCrossMod(depth: number) {
    this.crossMod.gain.rampTo(depth ** 2 * CROSS_MOD_RANGE, SWITCH_RAMP)
  }

  setRing(on: boolean) {
    this.vco2Direct.gain.rampTo(on ? 0 : 1, SWITCH_RAMP)
    this.ringGate.gain.rampTo(on ? 1 : 0, SWITCH_RAMP)
  }

  setMultiEngine(engine: 'noise' | 'vpm') {
    this.multi.setEngine(engine)
  }

  setNoiseType(type: NoiseType) {
    this.multi.setNoiseType(type)
  }

  setVpmType(type: VpmType) {
    this.multi.setVpmType(type)
  }

  setMultiShape(shape: number) {
    this.multi.setShape(shape)
  }

  setLevel(source: 'vco1' | 'vco2' | 'multi', level: number) {
    const gain = source === 'vco1' ? this.vco1Level : source === 'vco2' ? this.vco2Level : this.multiLevel
    gain.gain.rampTo(level, SWITCH_RAMP)
  }

  // --- Filter --------------------------------------------------------------

  setCutoff(hz: number) {
    this.filter.frequency.rampTo(hz, SWITCH_RAMP)
  }

  setResonance(q: number) {
    this.filter.Q.rampTo(q, SWITCH_RAMP)
  }

  setDrive(drive: '0' | '50' | '100') {
    this.drive.distortion = DRIVE[drive].amount
    this.drive.wet.rampTo(DRIVE[drive].wet, SWITCH_RAMP)
  }

  setKeyTrack(amount: number) {
    this.keyTrack = amount
  }

  // --- Envelopes -----------------------------------------------------------

  setAmpEnvelope(attack: number, decay: number, sustain: number, release: number) {
    this.amp.attack = attack
    this.amp.decay = decay
    this.amp.sustain = sustain
    this.amp.release = release
  }

  setEgTimes(attack: number, decay: number) {
    this.eg.attack = attack
    this.eg.decay = decay
    this.eg.release = decay
  }

  setEgInt(depth: number) {
    this.egInt = depth
    this.applyEgRouting()
  }

  setEgTarget(target: EgTarget) {
    this.egTarget = target
    this.applyEgRouting()
  }

  private applyEgRouting() {
    const t = this.egTarget
    this.egCutoff.gain.rampTo(t === 'cutoff' ? this.egInt * EG_CUTOFF_RANGE : 0, SWITCH_RAMP)
    this.egPitch.gain.rampTo(t === 'pitch' ? this.egInt * EG_PITCH_RANGE : 0, SWITCH_RAMP)
    this.egPitch2.gain.rampTo(t === 'pitch2' ? this.egInt * EG_PITCH_RANGE : 0, SWITCH_RAMP)
  }

  // --- LFO -----------------------------------------------------------------

  setLfoWave(wave: Wave) {
    this.lfo.type = wave === 'saw' ? 'sawtooth' : wave === 'tri' ? 'triangle' : 'square'
  }

  setLfoFrequency(hz: number) {
    this.lfoHz = hz
    this.lfo.frequency.rampTo(hz, SWITCH_RAMP)
  }

  setLfoMode(mode: LfoMode) {
    this.lfoMode = mode
    // Restarting also clears any stop still pending from a 1-shot cycle.
    const now = Tone.now()
    this.lfo.stop(now)
    if (mode !== 'oneshot') this.lfo.start(now)
  }

  setLfoInt(amount: number) {
    this.lfoInt = amount
    this.applyLfoRouting()
  }

  setLfoTarget(target: LfoTarget) {
    this.lfoTarget = target
    this.applyLfoRouting()
  }

  private applyLfoRouting() {
    const t = this.lfoTarget
    const i = this.lfoInt
    this.lfoCutoff.gain.rampTo(t === 'cutoff' ? i * LFO_CUTOFF_RANGE : 0, SWITCH_RAMP)
    this.lfoPitch.gain.rampTo(t === 'pitch' ? i ** 2 * LFO_PITCH_RANGE : 0, SWITCH_RAMP)
    this.lfoShape.gain.rampTo(t === 'shape' ? i * LFO_SHAPE_RANGE : 0, SWITCH_RAMP)
  }

  /** Joystick Y: up adds vibrato, down adds filter wobble, both from the voice LFO. */
  setJoystickY(y: number) {
    this.joyPitch.gain.rampTo(Math.max(0, y) * JOY_PITCH_RANGE, SWITCH_RAMP)
    this.joyCutoff.gain.rampTo(Math.max(0, -y) * JOY_CUTOFF_RANGE, SWITCH_RAMP)
  }

  private vco(n: 1 | 2): Vco {
    return n === 1 ? this.vco1 : this.vco2
  }

  dispose() {
    this.vco1.dispose()
    this.vco2.dispose()
    this.multi.dispose()
    for (const node of [
      this.frequency,
      this.pitchAll,
      this.pitch2,
      this.shapeMod,
      this.filterMod,
      this.crossMod,
      this.vco2Direct,
      this.ringVca,
      this.ringGate,
      this.vco1Level,
      this.vco2Level,
      this.multiLevel,
      this.mixer,
      this.drive,
      this.filter,
      this.amp,
      this.eg,
      this.egCutoff,
      this.egPitch,
      this.egPitch2,
      this.lfo,
      this.lfoCutoff,
      this.lfoPitch,
      this.lfoShape,
      this.joyPitch,
      this.joyCutoff,
      this.output,
    ]) node.dispose()
  }
}

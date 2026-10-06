// Every Model D patch parameter. The Model D has no display, so `format`
// produces the value shown in the knob tooltip, and `scale` is the legend
// printed around each knob. The arpeggiator is an addition to the keybed;
// the original instrument has none.

import { expMap, formatCents, formatHz, formatSeconds } from '../core/format'
import { choice, ON_OFF, paramIds, range, type ParamDefs, type PatchOf } from '../core/params'

// --- Curves (shared by the engine and the formatters) ------------------------

export const tuneCents = (v: number) => v * 100
export const oscFreqCents = (v: number) => v * 700
export const glideSeconds = (v: number) => v ** 2 * 3
export const lfoHz = (v: number) => expMap(v, 0.05, 50)
export const cutoffHz = (v: number) => expMap(v, 20, 20000)
/** Attack 1 ms..10 s and decay 4 ms..10 s, exponential-ish like the original pots. */
export const contourSeconds = (v: number) => 0.002 + 10 * v ** 3

// --- Panel legends -----------------------------------------------------------

const ZERO_TO_TEN = ['0', '', '2', '', '4', '', '6', '', '8', '', '10'] as const
/** One tick per semitone, labelled at the ends and centre. */
const SEMITONES = Array.from({ length: 15 }, (_, i) => (i === 0 ? '-7' : i === 7 ? '0' : i === 14 ? '+7' : ''))
const TUNE = ['-1', '', '', '', '0', '', '', '', '+1'] as const

const RANGES = [['lo', 'LO'], ['32', "32'"], ['16', "16'"], ['8', "8'"], ['4', "4'"], ['2', "2'"]] as const
const WAVES_12 = [
  ['tri', 'TRI'],
  ['trisaw', 'SHK'],
  ['saw', 'SAW'],
  ['square', 'SQR'],
  ['wide', 'WID'],
  ['narrow', 'NAR'],
] as const
const WAVES_3 = [
  ['tri', 'TRI'],
  ['revsaw', 'RSW'],
  ['saw', 'SAW'],
  ['square', 'SQR'],
  ['wide', 'WID'],
  ['narrow', 'NAR'],
] as const

const tenths = (v: number) => (v * 10).toFixed(1)
const time = (v: number) => formatSeconds(contourSeconds(v))
const level = (label: string, def: number) => range(label, def, { scale: ZERO_TO_TEN, format: tenths })
const contour = (label: string, def: number, format = time) => range(label, def, { scale: ZERO_TO_TEN, format })

export const PARAMS = {
  // Controllers
  tune: range('Tune', 0, { min: -1, max: 1, bipolar: true, scale: TUNE, format: (v) => formatCents(tuneCents(v)) }),
  glide: contour('Glide', 0.2, (v) => formatSeconds(glideSeconds(v))),
  glideOn: choice('Glide', ON_OFF, 'off'),
  // Defaults make the LFO usable straight away: flip OSC MOD or FILTER MOD to hear it.
  modMix: range('Mod Mix', 1, { scale: ZERO_TO_TEN, format: tenths }),
  /** Stands in for the Minimoog's mod wheel; a mod wheel (on screen or MIDI) can push it higher. */
  modDepth: range('Mod Depth', 0.5, { scale: ZERO_TO_TEN, format: tenths }),
  modSourceA: choice('Mod Source', [['filterEg', 'FILTER EG'], ['osc3', 'OSC 3']], 'osc3'),
  modSourceB: choice('Mod Source', [['lfo', 'LFO'], ['noise', 'NOISE']], 'lfo'),
  oscMod: choice('Osc Modulation', ON_OFF, 'off'),
  lfoRate: range('LFO Rate', 0.5, { scale: ZERO_TO_TEN, format: (v) => formatHz(lfoHz(v)) }),
  lfoWave: choice('LFO Wave', [['sqr', 'SQUARE'], ['tri', 'TRIANGLE']], 'tri'),

  // Oscillator bank
  osc1Range: choice('Osc 1 Range', RANGES, '8'),
  osc1Wave: choice('Osc 1 Waveform', WAVES_12, 'saw'),
  osc2Range: choice('Osc 2 Range', RANGES, '8'),
  osc2Freq: range('Osc 2 Frequency', 0, {
    min: -1,
    max: 1,
    bipolar: true,
    scale: SEMITONES,
    format: (v) => formatCents(oscFreqCents(v)),
  }),
  osc2Wave: choice('Osc 2 Waveform', WAVES_12, 'saw'),
  osc3Range: choice('Osc 3 Range', RANGES, '8'),
  osc3Freq: range('Osc 3 Frequency', 0, {
    min: -1,
    max: 1,
    bipolar: true,
    scale: SEMITONES,
    format: (v) => formatCents(oscFreqCents(v)),
  }),
  osc3Wave: choice('Osc 3 Waveform', WAVES_3, 'tri'),
  osc3Control: choice('Osc 3 Control', ON_OFF, 'on'),

  // Mixer
  osc1Level: level('Osc 1 Volume', 1),
  osc1On: choice('Osc 1', ON_OFF, 'on'),
  extLevel: level('Ext Input Volume', 0),
  extOn: choice('Ext Input', ON_OFF, 'off'),
  osc2Level: level('Osc 2 Volume', 0.8),
  osc2On: choice('Osc 2', ON_OFF, 'off'),
  noiseLevel: level('Noise Volume', 0.5),
  noiseOn: choice('Noise', ON_OFF, 'off'),
  noiseColor: choice('Noise Color', [['pink', 'PINK'], ['white', 'WHITE']], 'white'),
  osc3Level: level('Osc 3 Volume', 0.8),
  osc3On: choice('Osc 3', ON_OFF, 'off'),

  // Modifiers: filter
  cutoff: range('Cutoff Frequency', 0.6, { scale: ZERO_TO_TEN, format: (v) => formatHz(cutoffHz(v)) }),
  emphasis: level('Emphasis', 0),
  contourAmount: level('Amount of Contour', 0.4),
  filterMod: choice('Filter Modulation', ON_OFF, 'off'),
  keyTrack1: choice('Keyboard Control 1', ON_OFF, 'off'),
  keyTrack2: choice('Keyboard Control 2', ON_OFF, 'off'),
  filterAttack: contour('Filter Attack', 0),
  filterDecay: contour('Filter Decay', 0.35),
  filterSustain: level('Filter Sustain', 0.4),

  // Modifiers: loudness contour
  loudAttack: contour('Loudness Attack', 0),
  loudDecay: contour('Loudness Decay', 0.3),
  loudSustain: level('Loudness Sustain', 1),
  decaySwitch: choice('Decay', ON_OFF, 'off'),

  // Output
  volume: level('Volume', 0.7),
  a440: choice('A-440', ON_OFF, 'off'),

  // Keybed arpeggiator
  arp: choice('Arpeggiator', ON_OFF, 'off'),
  arpMode: choice(
    'Arp Mode',
    [['manual', 'ORD'], ['rise', 'UP'], ['fall', 'DN'], ['risefall', 'U/D'], ['random', 'RND']],
    'rise',
  ),
  arpRange: choice('Arp Range', [['1', '1'], ['2', '2'], ['3', '3']], '1'),
  arpRate: choice(
    'Arp Rate',
    [['4n', '1/4'], ['8n', '1/8'], ['8t', '1/8T'], ['16n', '1/16'], ['16t', '1/16T'], ['32n', '1/32']],
    '16n',
  ),
  arpGate: range('Arp Gate', 0.5, {
    min: 0.05,
    max: 1,
    scale: ['', '', '', '', '50', '', '', '', '', '100'],
    format: (v) => `${Math.round(v * 100)}%`,
  }),
  tempo: range('Tempo', 120, {
    min: 40,
    max: 240,
    scale: ['40', '', '', '', '140', '', '', '', '240'],
    format: (v) => `${v.toFixed(1)} BPM`,
  }),
} satisfies ParamDefs

export type Params = typeof PARAMS
export type ParamId = keyof Params
export type Patch = PatchOf<Params>
export const PARAM_IDS = paramIds(PARAMS)

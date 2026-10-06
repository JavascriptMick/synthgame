// Every XD-4 patch parameter, its range, default and how it reads on the OLED.
// The UI binds to parameters by id, and the engine applies them by id, so this
// file is the single definition of what a program contains.

import { choice, ON_OFF, paramIds, range, type ParamDefs, type PatchOf } from '../core/params'
import { formatCents, formatHz, formatSeconds } from '../core/format'
import {
  bpmDivisionIndex,
  BPM_DIVISIONS,
  cutoffHz,
  delaySeconds,
  envTime,
  lfoHz,
  modFxRateHz,
  reverbDecay,
  to1023,
  vcoPitchCents,
} from './curves'
import { arpTypeForDepth, chordForDepth, unisonDetuneCents } from './modes'

const WAVES = [['sqr', 'SQR'], ['tri', 'TRI'], ['saw', 'SAW']] as const
const OCTAVES = [['16', "16'"], ['8', "8'"], ['4', "4'"], ['2', "2'"]] as const
const ZERO_HALF_FULL = [['0', '0%'], ['50', '50%'], ['100', '100%']] as const

const level = (v: number) => String(to1023(v))
const time = (v: number) => formatSeconds(envTime(v))
const pitch = (v: number) => formatCents(vcoPitchCents(v))
const bipolar1023 = (v: number) => {
  const n = Math.round(v * 511)
  return `${n > 0 ? '+' : ''}${n}`
}

export const PARAMS = {
  // Global
  masterVolume: range('Master', 0.75, { format: level }),
  tempo: range('Tempo', 120, { min: 56, max: 240, format: (v) => `${v.toFixed(1)} BPM` }),
  portamento: range('Portamento', 0, {
    format: (v) => (v === 0 ? 'OFF' : formatSeconds(v ** 2 * 2)),
  }),
  voiceMode: choice('Voice Mode', [['poly', 'POLY'], ['unison', 'UNISON'], ['chord', 'CHORD'], ['arp', 'ARP/LATCH']], 'poly'),
  voiceDepth: range('Voice Mode Depth', 0, {
    format: (v, p) => {
      switch (p.voiceMode) {
        case 'unison':
          return `Detune ${unisonDetuneCents(v).toFixed(1)} cent`
        case 'chord':
          return chordForDepth(v).name
        case 'arp':
          return arpTypeForDepth(v).name
        default:
          return String(to1023(v))
      }
    },
  }),

  // VCO 1
  vco1Wave: choice('VCO1 Wave', WAVES, 'saw'),
  vco1Octave: choice('VCO1 Octave', OCTAVES, '8'),
  vco1Pitch: range('VCO1 Pitch', 0, { min: -1, max: 1, bipolar: true, format: pitch }),
  vco1Shape: range('VCO1 Shape', 0, { format: level }),

  // VCO 2
  vco2Wave: choice('VCO2 Wave', WAVES, 'saw'),
  vco2Octave: choice('VCO2 Octave', OCTAVES, '8'),
  vco2Pitch: range('VCO2 Pitch', 0, { min: -1, max: 1, bipolar: true, format: pitch }),
  vco2Shape: range('VCO2 Shape', 0, { format: level }),
  crossMod: range('Cross Mod Depth', 0, { format: level }),
  // Hard SYNC is not modelled: Web Audio oscillators cannot reset phase mid-cycle.
  ring: choice('Ring', ON_OFF, 'off'),

  // Multi engine
  multiEngine: choice('Multi Engine', [['noise', 'NOISE'], ['vpm', 'VPM']], 'noise'),
  multiNoiseType: choice('Noise Type', [['high', 'High'], ['low', 'Low'], ['peak', 'Peak'], ['decim', 'Decim']], 'high'),
  multiVpmType: choice(
    'VPM Type',
    [
      ['sin1', 'Sin1'],
      ['sin2', 'Sin2'],
      ['sin3', 'Sin3'],
      ['sin4', 'Sin4'],
      ['saw1', 'Saw1'],
      ['saw2', 'Saw2'],
      ['sqr1', 'Sqr1'],
      ['sqr2', 'Sqr2'],
    ],
    'sin1',
  ),
  multiShape: range('Multi Shape', 0.5, { format: level }),

  // Mixer
  vco1Level: range('VCO1 Level', 1, { format: level }),
  vco2Level: range('VCO2 Level', 0, { format: level }),
  multiLevel: range('Multi Level', 0, { format: level }),

  // Filter
  cutoff: range('Cutoff', 1, { format: (v) => formatHz(cutoffHz(v)) }),
  resonance: range('Resonance', 0, { format: level }),
  drive: choice('Drive', ZERO_HALF_FULL, '0'),
  keyTrack: choice('Key Track', ZERO_HALF_FULL, '0'),

  // Amp EG
  ampAttack: range('Amp Attack', 0, { format: time }),
  ampDecay: range('Amp Decay', 0.5, { format: time }),
  ampSustain: range('Amp Sustain', 1, { format: level }),
  ampRelease: range('Amp Release', 0.2, { format: time }),

  // EG
  egAttack: range('EG Attack', 0, { format: time }),
  egDecay: range('EG Decay', 0.5, { format: time }),
  egInt: range('EG Int', 0, { min: -1, max: 1, bipolar: true, format: bipolar1023 }),
  egTarget: choice('EG Target', [['pitch', 'PITCH'], ['pitch2', 'PITCH 2'], ['cutoff', 'CUTOFF']], 'cutoff'),

  // LFO
  lfoWave: choice('LFO Wave', WAVES, 'tri'),
  lfoMode: choice('LFO Mode', [['bpm', 'BPM'], ['normal', 'NORMAL'], ['oneshot', '1-SHOT']], 'normal'),
  lfoRate: range('LFO Rate', 0.5, {
    format: (v, p) => (p.lfoMode === 'bpm' ? BPM_DIVISIONS[bpmDivisionIndex(v)].label : formatHz(lfoHz(v))),
  }),
  lfoInt: range('LFO Int', 0, { format: level }),
  lfoTarget: choice('LFO Target', [['pitch', 'PITCH'], ['shape', 'SHAPE'], ['cutoff', 'CUTOFF']], 'cutoff'),

  // Effects
  modFxOn: choice('Mod FX', ON_OFF, 'off'),
  modFxType: choice('Mod FX Type', [['chorus', 'Chorus'], ['ensemble', 'Ensemble'], ['phaser', 'Phaser'], ['flanger', 'Flanger']], 'chorus'),
  modFxTime: range('Mod FX Time', 0.4, { format: (v) => formatHz(modFxRateHz(v)) }),
  modFxDepth: range('Mod FX Depth', 0.5, { format: level }),
  delayOn: choice('Delay', ON_OFF, 'off'),
  delayType: choice('Delay Type', [['stereo', 'Stereo'], ['pingpong', 'Ping Pong']], 'stereo'),
  delayTime: range('Delay Time', 0.5, { format: (v) => formatSeconds(delaySeconds(v)) }),
  delayDepth: range('Delay Depth', 0.4, { format: level }),
  reverbOn: choice('Reverb', ON_OFF, 'off'),
  reverbType: choice('Reverb Type', [['room', 'Room'], ['plate', 'Plate'], ['hall', 'Hall'], ['space', 'Space']], 'hall'),
  reverbTime: range('Reverb Time', 0.5, { format: (v) => formatSeconds(reverbDecay(v)) }),
  reverbDepth: range('Reverb Depth', 0.4, { format: level }),
} satisfies ParamDefs

export type Params = typeof PARAMS
export type ParamId = keyof Params
export type Patch = PatchOf<Params>
export const PARAM_IDS = paramIds(PARAMS)

// Maps normalised XD-4 panel values (mostly 0..1) to the physical quantities
// the audio engine uses. Shared by the engine and the display formatters so the
// numbers shown on the OLED always match what is heard.

import { signedPow } from '../core/format'

/** VCO PITCH knob (-1..1) -> cents (±1200). */
export function vcoPitchCents(v: number): number {
  return 1200 * signedPow(v, 2)
}

/** Filter CUTOFF (0..1) -> Hz, exponential over 20 Hz..20 kHz. */
export function cutoffHz(v: number): number {
  return 20 * 1000 ** v
}

/** Filter RESONANCE (0..1) -> biquad Q (lowpass Q is specified in dB). */
export function resonanceQ(v: number): number {
  return 0.7 + v * 22
}

/** Envelope time knob (0..1) -> seconds. */
export function envTime(v: number): number {
  return 0.002 + 8 * v ** 3
}

/** EG INT (-1..1) -> signed depth multiplier with a finer centre. */
export function egIntDepth(v: number): number {
  return signedPow(v, 2)
}

/** Free-running LFO RATE (0..1) -> Hz (0.05..30 Hz). */
export function lfoHz(v: number): number {
  return 0.05 * 600 ** v
}

/** Tempo-synced LFO divisions, expressed in beats (quarter notes) per cycle. */
export const BPM_DIVISIONS = [
  { label: '4 Bars', beats: 16 },
  { label: '2 Bars', beats: 8 },
  { label: '1 Bar', beats: 4 },
  { label: '3/4', beats: 3 },
  { label: '1/2', beats: 2 },
  { label: '3/8', beats: 1.5 },
  { label: '1/3', beats: 4 / 3 },
  { label: '1/4', beats: 1 },
  { label: '3/16', beats: 0.75 },
  { label: '1/6', beats: 2 / 3 },
  { label: '1/8', beats: 0.5 },
  { label: '1/12', beats: 1 / 3 },
  { label: '1/16', beats: 0.25 },
  { label: '1/24', beats: 1 / 6 },
  { label: '1/32', beats: 0.125 },
  { label: '1/36', beats: 1 / 9 },
  { label: '1/48', beats: 1 / 12 },
  { label: '1/64', beats: 1 / 16 },
] as const

export function bpmDivisionIndex(rate: number): number {
  return Math.min(BPM_DIVISIONS.length - 1, Math.floor(rate * BPM_DIVISIONS.length))
}

/** LFO rate in BPM mode -> Hz at the given tempo. */
export function lfoSyncedHz(rate: number, bpm: number): number {
  return bpm / 60 / BPM_DIVISIONS[bpmDivisionIndex(rate)].beats
}

/** Mod FX TIME (0..1) -> modulation speed in Hz. */
export function modFxRateHz(v: number): number {
  return 0.05 * 200 ** v
}

/** Delay TIME (0..1) -> seconds. */
export function delaySeconds(v: number): number {
  return 0.02 + 1.4 * v ** 2
}

/** Reverb TIME (0..1) -> decay seconds before the per-type multiplier. */
export function reverbDecay(v: number): number {
  return 0.4 + 9.6 * v ** 2
}

/** Master volume (0..1) -> linear gain. */
export function masterGain(v: number): number {
  return v * v
}

/** The hardware shows most knob positions as 0..1023. */
export function to1023(v: number, min = 0, max = 1): number {
  return Math.round(((v - min) / (max - min)) * 1023)
}

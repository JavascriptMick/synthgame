// Value curves and display formatting shared by all synths.

/** Signed power curve: keeps fine resolution around the centre of bipolar knobs. */
export function signedPow(v: number, exp: number): number {
  return Math.sign(v) * Math.abs(v) ** exp
}

export function formatSeconds(s: number): string {
  return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`
}

export function formatHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : hz >= 10 ? `${Math.round(hz)} Hz` : `${hz.toFixed(2)} Hz`
}

export function formatCents(c: number): string {
  const r = Math.round(c)
  return `${r > 0 ? '+' : ''}${r} cent`
}

/** Exponential mapping of 0..1 onto lo..hi (both > 0). */
export function expMap(v: number, lo: number, hi: number): number {
  return lo * (hi / lo) ** v
}

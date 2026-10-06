// Typed access to the XD-4 patch for its panel components.

import type { Patch } from '~/synth/xd4/params'

export function useXd4() {
  return {
    /** Only valid while the XD-4 is the active synth. */
    patch: useSynth().patch as unknown as Patch,
  }
}

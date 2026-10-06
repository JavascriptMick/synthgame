// All available synths, in the order they appear in the synth switcher.
import type { SynthDefinition } from './core/definition'
import { modelD } from './model-d'
import { xd4 } from './xd4'

export const SYNTHS: readonly SynthDefinition[] = [xd4, modelD]

export function findSynth(id: string): SynthDefinition | undefined {
  return SYNTHS.find((s) => s.id === id)
}

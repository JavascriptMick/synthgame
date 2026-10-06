import type { SynthDefinition } from '../core/definition'
import { ModelDEngine } from './Engine'
import { PARAMS } from './params'
import { programs } from './programs'

export const modelD: SynthDefinition = {
  id: 'model-d',
  name: 'Model D',
  description: 'Monophonic 3-oscillator synth modelled on the Behringer Model D',
  params: PARAMS,
  programs,
  hasSequencer: false,
  createEngine: (patch) => new ModelDEngine(patch),
}

import type { SynthDefinition } from '../core/definition'
import { Xd4Engine } from './Engine'
import { PARAMS } from './params'
import { programs } from './programs'

export const xd4: SynthDefinition = {
  id: 'xd4',
  name: 'XD-4',
  description: '4-voice poly modelled on the Korg minilogue xd',
  params: PARAMS,
  programs,
  hasSequencer: true,
  createEngine: (patch) => new Xd4Engine(patch),
}

import type { SynthEngine } from './engine'
import type { GenericPatch, ParamDefs } from './params'
import type { ProgramBank } from './programs'

/** Everything the app needs to know about one synth model (the panel lives in the UI layer). */
export interface SynthDefinition {
  /** URL segment, e.g. "xd4". */
  id: string
  name: string
  /** One line describing what is being modelled. */
  description: string
  params: ParamDefs
  programs: ProgramBank
  hasSequencer: boolean
  createEngine(patch: GenericPatch): SynthEngine
}

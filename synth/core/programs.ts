// Program memory: factory programs overlaid with user programs written to
// localStorage. Each synth has its own bank and storage key.

import { defaultPatch, sanitizePatch, type GenericPatch, type ParamDefs, type PatchOf } from './params'
import { cloneSteps, emptySteps, sanitizeSteps, type SeqStep } from './Sequencer'

export const PROGRAM_NAME_MAX = 12

export interface Program {
  name: string
  patch: GenericPatch
  /** Sequencer steps; empty for synths without a sequencer. */
  steps: SeqStep[]
}

export interface FactoryProgram<Patch> {
  name: string
  patch: Partial<Patch>
  /** One entry per step: a note, a chord, or null for a rest. */
  sequence?: (number | number[] | null)[]
}

export interface ProgramBank {
  readonly count: number
  load(index: number): Program
  /** Returns false when storage is unavailable (private mode, quota, blocked). */
  save(index: number, program: Program): boolean
  /** Names of all slots, user programs included. */
  names(): string[]
}

export function sanitizeName(name: string): string {
  return name.trim().slice(0, PROGRAM_NAME_MAX) || 'User Program'
}

export function createProgramBank<P extends ParamDefs>(options: {
  params: P
  factory: readonly FactoryProgram<PatchOf<P>>[]
  storageKey: string
  count: number
}): ProgramBank {
  const { params, factory, storageKey, count } = options

  function factoryProgram(index: number): Program {
    const f = factory[index] ?? factory[0]
    const steps = emptySteps()
    f.sequence?.forEach((entry, i) => {
      if (entry !== null) steps[i].notes = Array.isArray(entry) ? [...entry] : [entry]
    })
    return { name: f.name, patch: { ...defaultPatch(params), ...f.patch }, steps }
  }

  function readUser(): Record<string, unknown> {
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed: unknown = raw ? JSON.parse(raw) : {}
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  function fromStored(stored: unknown): Program | null {
    if (typeof stored !== 'object' || stored === null) return null
    const { name, patch, steps } = stored as Record<string, unknown>
    if (typeof patch !== 'object' || patch === null) return null
    return {
      name: typeof name === 'string' ? sanitizeName(name) : 'User Program',
      patch: sanitizePatch(params, patch as Record<string, unknown>),
      steps: sanitizeSteps(steps),
    }
  }

  return {
    count,
    load(index) {
      return fromStored(readUser()[index]) ?? factoryProgram(index)
    },
    save(index, program) {
      try {
        const all = readUser()
        all[index] = { name: sanitizeName(program.name), patch: { ...program.patch }, steps: cloneSteps(program.steps) }
        localStorage.setItem(storageKey, JSON.stringify(all))
        return true
      } catch {
        return false
      }
    },
    names() {
      const user = readUser()
      return Array.from({ length: count }, (_, i) => fromStored(user[i])?.name ?? (factory[i] ?? factory[0]).name)
    },
  }
}

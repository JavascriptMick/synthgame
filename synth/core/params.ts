// The parameter system shared by all synths. Each synth declares a record of
// parameter definitions; a patch is the set of current values for it. The UI
// binds controls to parameters by id and engines apply them by id.

export type PatchValue = number | string
/** A patch of any synth, as seen by synth-agnostic code. */
export type GenericPatch = Record<string, PatchValue>
type PatchLike = Readonly<GenericPatch>

export interface RangeParam {
  kind: 'range'
  label: string
  min: number
  max: number
  default: number
  /** Arc is drawn from the centre and the default is the centre detent. */
  bipolar?: boolean
  /** Panel legend printed around the knob, evenly spaced over its travel. */
  scale?: readonly string[]
  format?: (value: number, patch: PatchLike) => string
}

export interface ChoiceOption<T extends string = string> {
  value: T
  label: string
}

export interface ChoiceParam<T extends string = string> {
  kind: 'choice'
  label: string
  options: readonly ChoiceOption<T>[]
  default: T
}

export type ParamDef = RangeParam | ChoiceParam
export type ParamDefs = Record<string, ParamDef>

type ValueOf<P> = P extends ChoiceParam<infer T> ? T : number
export type PatchOf<P extends ParamDefs> = { [K in keyof P]: ValueOf<P[K]> }

export function range(
  label: string,
  def: number,
  opts: Partial<Omit<RangeParam, 'kind' | 'label' | 'default'>> = {},
): RangeParam {
  return { kind: 'range', label, min: 0, max: 1, default: def, ...opts }
}

export function choice<const T extends string>(
  label: string,
  options: readonly (readonly [T, string])[],
  def: NoInfer<T>,
): ChoiceParam<T> {
  return { kind: 'choice', label, options: options.map(([value, l]) => ({ value, label: l })), default: def }
}

export const ON_OFF = [['off', 'OFF'], ['on', 'ON']] as const

export function paramIds<P extends ParamDefs>(params: P): (keyof P & string)[] {
  return Object.keys(params)
}

export function defaultPatch<P extends ParamDefs>(params: P): PatchOf<P> {
  return Object.fromEntries(Object.entries(params).map(([id, def]) => [id, def.default])) as PatchOf<P>
}

/** Coerces untrusted values (e.g. from localStorage) into a valid patch. */
export function sanitizePatch<P extends ParamDefs>(params: P, input: Partial<Record<string, unknown>>): PatchOf<P> {
  const patch: GenericPatch = defaultPatch(params)
  for (const [id, def] of Object.entries(params)) {
    const v = input[id]
    if (def.kind === 'range' && typeof v === 'number' && Number.isFinite(v)) {
      patch[id] = Math.min(def.max, Math.max(def.min, v))
    } else if (def.kind === 'choice' && typeof v === 'string' && def.options.some((o) => o.value === v)) {
      patch[id] = v
    }
  }
  return patch as PatchOf<P>
}

export function formatParam(params: ParamDefs, id: string, patch: PatchLike): string {
  const def = params[id]
  const value = patch[id]
  if (!def) return String(value)
  if (def.kind === 'choice') return def.options.find((o) => o.value === value)?.label ?? String(value)
  return def.format ? def.format(value as number, patch) : String(value)
}

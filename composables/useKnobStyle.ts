// Each synth panel picks the look of its knobs; knobs below it inherit it.
import { inject, provide, type InjectionKey } from 'vue'

/** modern: value arc around a slim knob (XD-4). vintage: skirted knob with a printed scale (Model D). */
export type KnobStyle = 'modern' | 'vintage'

const KEY: InjectionKey<KnobStyle> = Symbol('knob-style')

export function provideKnobStyle(style: KnobStyle) {
  provide(KEY, style)
}

export function useKnobStyle(): KnobStyle {
  return inject(KEY, 'modern')
}

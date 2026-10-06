<script setup lang="ts">
// A knob bound to a parameter of the active synth by id. Range parameters map
// linearly onto the knob; choice parameters become a stepped knob with one
// detent per option.
import { formatParam, type ParamDef } from '~/synth/core/params'

const props = withDefaults(
  defineProps<{
    param: string
    label?: string
    size?: 'sm' | 'md' | 'lg'
    /** Show option labels around a stepped knob. */
    showDetents?: boolean
  }>(),
  { label: undefined, size: 'md', showDetents: false },
)

const { definition, patch, setParam } = useSynth()

const def = computed<ParamDef>(() => {
  const d = definition.value.params[props.param]
  if (!d) throw new Error(`${definition.value.name} has no parameter "${props.param}"`)
  return d
})

function toPosition(d: ParamDef, value: string | number): number {
  if (d.kind === 'choice') {
    const i = d.options.findIndex((o) => o.value === value)
    return d.options.length > 1 ? Math.max(0, i) / (d.options.length - 1) : 0
  }
  return ((value as number) - d.min) / (d.max - d.min)
}

const position = computed({
  get: () => toPosition(def.value, patch[props.param]),
  set: (pos: number) => {
    const d = def.value
    if (d.kind === 'choice') setParam(props.param, d.options[Math.round(pos * (d.options.length - 1))].value)
    else setParam(props.param, d.min + pos * (d.max - d.min))
  },
})

const steps = computed(() => (def.value.kind === 'choice' ? def.value.options.length : 0))
const defaultPosition = computed(() => toPosition(def.value, def.value.default))
const ringLabels = computed(() => {
  const d = def.value
  if (d.kind === 'choice') return props.showDetents ? d.options.map((o) => o.label) : undefined
  return d.scale
})
const valueText = computed(() => formatParam(definition.value.params, props.param, patch))
</script>

<template>
  <SynthKnob
    v-model="position"
    :label="label ?? def.label"
    :accessible-name="def.label"
    :size="size"
    :steps="steps"
    :default-value="defaultPosition"
    :bipolar="def.kind === 'range' && def.bipolar"
    :ring-labels="ringLabels"
    :value-text="valueText"
  />
</template>

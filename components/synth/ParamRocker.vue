<script setup lang="ts">
// A rocker switch bound to a two-option choice parameter of the active synth.
import type { ChoiceParam } from '~/synth/core/params'

const props = withDefaults(
  defineProps<{ param: string; label?: string; color?: 'blue' | 'orange' | 'white'; legends?: boolean }>(),
  { label: undefined, color: 'white', legends: true },
)

const { definition, patch, setParam } = useSynth()

const def = computed<ChoiceParam>(() => {
  const d = definition.value.params[props.param]
  if (d?.kind !== 'choice' || d.options.length !== 2) {
    throw new Error(`ParamRocker needs a two-option choice parameter, got "${props.param}"`)
  }
  return d
})

const value = computed({
  get: () => String(patch[props.param]),
  set: (v: string) => setParam(props.param, v),
})
</script>

<template>
  <SynthRocker
    v-model="value"
    :options="def.options"
    :label="label ?? def.label"
    :accessible-name="def.label"
    :color="color"
    :legends="legends"
  />
</template>

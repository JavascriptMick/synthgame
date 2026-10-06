<script setup lang="ts">
// A toggle switch bound to a choice parameter of the active synth by id.
import type { ChoiceParam } from '~/synth/core/params'

const props = withDefaults(defineProps<{ param: string; label?: string; hideLabel?: boolean }>(), {
  label: undefined,
  hideLabel: false,
})

const { definition, patch, setParam } = useSynth()

const def = computed<ChoiceParam>(() => {
  const d = definition.value.params[props.param]
  if (d?.kind !== 'choice') throw new Error(`ParamSwitch needs a choice parameter, got "${props.param}"`)
  return d
})

const value = computed({
  get: () => String(patch[props.param]),
  set: (v: string) => setParam(props.param, v),
})
</script>

<template>
  <SynthToggleSwitch v-model="value" :options="def.options" :label="label ?? def.label" :accessible-name="def.label" :hide-label="hideLabel" />
</template>

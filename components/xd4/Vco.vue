<script setup lang="ts">
// VCO 1 / VCO 2. VCO 2 adds cross modulation, sync and ring modulation.
const props = defineProps<{ n: 1 | 2 }>()

const { setParam } = useSynth()
const { patch } = useXd4()

const ids = computed(() =>
  props.n === 1
    ? ({ wave: 'vco1Wave', octave: 'vco1Octave', pitch: 'vco1Pitch', shape: 'vco1Shape' } as const)
    : ({ wave: 'vco2Wave', octave: 'vco2Octave', pitch: 'vco2Pitch', shape: 'vco2Shape' } as const),
)
</script>

<template>
  <SynthSection :title="`VCO ${n}`">
    <SynthParamSwitch :param="ids.wave" label="Wave" />
    <SynthParamKnob :param="ids.octave" label="Octave" show-detents />
    <SynthParamKnob :param="ids.pitch" label="Pitch" />
    <SynthParamKnob :param="ids.shape" label="Shape" />
    <template v-if="n === 2">
      <SynthParamKnob param="crossMod" label="Cross Mod" />
      <div class="flex flex-col gap-2">
        <SynthLedButton
          label="Sync"
          size="sm"
          disabled
          title="Hard sync is not available: Web Audio oscillators cannot reset phase"
        />
        <SynthLedButton
          label="Ring"
          size="sm"
          :led="patch.ring === 'on'"
          @click="setParam('ring', patch.ring === 'on' ? 'off' : 'on')"
        />
      </div>
    </template>
  </SynthSection>
</template>

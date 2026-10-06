<script setup lang="ts">
// Effects: the selector picks which effect the TIME / DEPTH / TYPE controls
// and the ON/OFF button edit. The three LEDs show which effects are running.
import type { ParamId } from '~/synth/xd4/params'

type FxSelect = 'modfx' | 'delay' | 'reverb'

const { setParam } = useSynth()
const { patch } = useXd4()
const fxSelect = ref<FxSelect>('modfx')

const FX = {
  modfx: { label: 'Mod FX', on: 'modFxOn', type: 'modFxType', time: 'modFxTime', depth: 'modFxDepth' },
  delay: { label: 'Delay', on: 'delayOn', type: 'delayType', time: 'delayTime', depth: 'delayDepth' },
  reverb: { label: 'Reverb', on: 'reverbOn', type: 'reverbType', time: 'reverbTime', depth: 'reverbDepth' },
} as const satisfies Record<FxSelect, { label: string; on: ParamId; type: ParamId; time: ParamId; depth: ParamId }>

const options = (Object.keys(FX) as FxSelect[]).map((value) => ({ value, label: FX[value].label }))
const selected = computed(() => FX[fxSelect.value])

function toggleSelected() {
  const id = selected.value.on
  setParam(id, patch[id] === 'on' ? 'off' : 'on')
}
</script>

<template>
  <SynthSection title="Effects">
    <SynthToggleSwitch
      :model-value="fxSelect"
      :options="options"
      label="Select"
      @update:model-value="(v) => (fxSelect = v as FxSelect)"
    />
    <SynthParamKnob :param="selected.type" label="Type" />
    <SynthParamKnob :param="selected.time" label="Time" />
    <SynthParamKnob :param="selected.depth" label="Depth" />
    <div class="flex flex-col items-center gap-2">
      <SynthLedButton label="On/Off" size="sm" :led="patch[selected.on] === 'on'" @click="toggleSelected" />
      <div class="flex gap-1.5" aria-label="Active effects">
        <span
          v-for="(fx, key) in FX"
          :key="key"
          :title="`${fx.label} ${patch[fx.on] === 'on' ? 'on' : 'off'}`"
          class="h-1.5 w-1.5 rounded-full"
          :class="patch[fx.on] === 'on' ? 'bg-led shadow-[0_0_5px_rgba(255,59,48,0.8)]' : 'bg-led-dim'"
        />
      </div>
    </div>
  </SynthSection>
</template>

<script setup lang="ts">
// The mixer's staggered layout: oscillators on the left, external input and
// noise offset on the right, each volume with its on/off rocker.
const SOURCES = [
  { level: 'osc1Level', on: 'osc1On', label: 'Osc 1', column: 1, row: 1 },
  { level: 'extLevel', on: 'extOn', label: 'Ext (FB)', column: 2, row: 2 },
  { level: 'osc2Level', on: 'osc2On', label: 'Osc 2', column: 1, row: 3 },
  { level: 'noiseLevel', on: 'noiseOn', label: 'Noise', column: 2, row: 4 },
  { level: 'osc3Level', on: 'osc3On', label: 'Osc 3', column: 1, row: 5 },
] as const
</script>

<template>
  <ModelDSection title="Mixer">
    <div class="grid grid-cols-2 grid-rows-6 gap-x-5 gap-y-3">
      <div
        v-for="s in SOURCES"
        :key="s.level"
        class="row-span-2 flex items-start gap-2"
        :style="{ gridColumn: s.column, gridRowStart: s.row }"
      >
        <SynthParamKnob :param="s.level" :label="s.label" />
        <SynthParamRocker :param="s.on" label="On" color="blue" :legends="false" />
        <SynthParamRocker v-if="s.level === 'noiseLevel'" param="noiseColor" label="Color" />
      </div>
    </div>
  </ModelDSection>
</template>

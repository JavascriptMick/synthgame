<script setup lang="ts">
// Keybed arpeggiator (not on the original hardware). Settings are part of the
// patch; LATCH is a performance control and is not saved with programs.
import { ON_OFF } from '~/synth/core/params'

const { ui, setArpLatch } = useSynth()

const LATCH_OPTIONS = ON_OFF.map(([value, label]) => ({ value, label }))
const latch = computed({
  get: () => (ui.arpLatch ? 'on' : 'off'),
  set: (v: string) => setArpLatch(v === 'on'),
})
</script>

<template>
  <section class="flex items-start gap-6" aria-label="Arpeggiator">
    <h2 class="self-center text-[11px] font-bold uppercase tracking-[0.3em] text-silk [writing-mode:vertical-rl] rotate-180">
      Arpeggio
    </h2>
    <SynthParamRocker param="arp" label="Arp" color="blue" :legends="false" />
    <SynthRocker v-model="latch" :options="LATCH_OPTIONS" label="Latch" :legends="false" />
    <SynthParamKnob param="tempo" label="Tempo" />
    <SynthParamKnob param="arpRate" label="Rate" show-detents />
    <SynthParamKnob param="arpMode" label="Mode" show-detents />
    <SynthParamKnob param="arpRange" label="Octaves" show-detents />
    <SynthParamKnob param="arpGate" label="Gate" />
  </section>
</template>

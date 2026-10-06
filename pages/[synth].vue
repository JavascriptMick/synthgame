<script setup lang="ts">
// One page per synth (/xd4, /model-d). The route selects the active synth.
import { findSynth } from '~/synth/registry'

const route = useRoute()
const { definition, ui, powerOn, selectSynth } = useSynth()

const synthId = computed(() => String(route.params.synth))

if (!findSynth(synthId.value)) {
  throw createError({ statusCode: 404, statusMessage: `Unknown synth "${synthId.value}"`, fatal: true })
}

watch(synthId, (id) => selectSynth(id), { immediate: true })

useHead({ title: () => `${definition.value.name} · Synth Rack` })
</script>

<template>
  <div class="relative">
    <Xd4Panel v-if="definition.id === 'xd4'" />
    <ModelDPanel v-else-if="definition.id === 'model-d'" />

    <!-- Browsers only allow audio to start from a user gesture. -->
    <div
      v-if="!ui.powered"
      class="absolute inset-0 z-30 flex items-center justify-center rounded-md bg-black/70 backdrop-blur-[2px]"
    >
      <button
        type="button"
        class="flex flex-col items-center gap-3 rounded-lg border border-panel-line bg-panel-raised px-10 py-6 uppercase tracking-[0.3em] text-silk shadow-2xl outline-none ring-led transition hover:border-led/60 focus-visible:ring-2"
        :disabled="ui.powering"
        @click="powerOn"
      >
        <span class="h-3 w-3 rounded-full" :class="ui.powering ? 'animate-pulse bg-led' : 'bg-led-dim'" />
        <span class="text-lg font-semibold">{{ ui.powering ? 'Starting…' : 'Power On' }}</span>
        <span class="text-[10px] tracking-widest text-silk-dim">Click to start audio</span>
      </button>
    </div>
  </div>
</template>

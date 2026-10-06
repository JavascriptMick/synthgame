<script setup lang="ts">
// Synth switcher and program browser, shared by every synth.
const { synths, definition, ui, selectProgram, promptWriteProgram } = useSynth()

const programIndex = computed({
  get: () => ui.program,
  set: (i: number) => selectProgram(i),
})
</script>

<template>
  <header class="mb-4 flex flex-wrap items-end justify-between gap-4 px-2">
    <div class="flex items-end gap-6">
      <h1 class="text-2xl font-bold uppercase tracking-[0.35em] text-silk">
        Synth<span class="text-led">·</span>Rack
      </h1>
      <nav class="flex gap-1" aria-label="Synths">
        <NuxtLink
          v-for="s in synths"
          :key="s.id"
          :to="`/${s.id}`"
          class="rounded-t border-b-2 px-3 py-1 text-sm font-semibold uppercase tracking-[0.2em] transition-colors"
          :class="s.id === definition.id ? 'border-led text-silk' : 'border-transparent text-silk-dim hover:text-silk'"
          :title="s.description"
        >
          {{ s.name }}
        </NuxtLink>
      </nav>
    </div>

    <div class="flex items-center gap-2 text-sm">
      <label for="program-select" class="text-[11px] uppercase tracking-widest text-silk-dim">Program</label>
      <button
        type="button"
        class="h-8 w-8 rounded border border-panel-line bg-panel-raised text-silk hover:border-silk-dim"
        aria-label="Previous program"
        @click="selectProgram(ui.program - 1)"
      >
        ‹
      </button>
      <select
        id="program-select"
        v-model.number="programIndex"
        class="h-8 w-56 rounded border border-panel-line bg-panel-raised px-2 text-silk outline-none focus:border-silk-dim"
      >
        <option v-for="(name, i) in ui.programNames" :key="i" :value="i">
          {{ String(i + 1).padStart(3, '0') }} {{ name }}
        </option>
      </select>
      <button
        type="button"
        class="h-8 w-8 rounded border border-panel-line bg-panel-raised text-silk hover:border-silk-dim"
        aria-label="Next program"
        @click="selectProgram(ui.program + 1)"
      >
        ›
      </button>
      <button
        type="button"
        class="h-8 rounded border border-panel-line bg-panel-raised px-3 text-[11px] font-semibold uppercase tracking-widest text-silk hover:border-led/60"
        @click="promptWriteProgram"
      >
        Write
      </button>
    </div>
    <p class="w-full text-right text-[11px] uppercase tracking-widest text-silk-dim">
      Keys A–; · Octave Z/X · Shift-drag for fine · Double-click a knob to reset
    </p>
  </header>
</template>

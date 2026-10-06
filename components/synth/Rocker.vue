<script setup lang="ts">
// A two-position rocker switch, as on vintage synth panels. The top half
// selects `options[1]` (e.g. ON) and the bottom half `options[0]` (e.g. OFF);
// small legends above and below name the positions.
import type { ChoiceOption } from '~/synth/core/params'

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: readonly [ChoiceOption, ChoiceOption] | readonly ChoiceOption[]
    label: string
    accessibleName?: string
    color?: 'blue' | 'orange' | 'white'
    /** Show the position legends (hide them for plain ON/OFF switches). */
    legends?: boolean
  }>(),
  { accessibleName: undefined, color: 'white', legends: true },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const isUp = computed(() => props.modelValue === props.options[1].value)

const COLORS = {
  blue: 'from-[#4d8ee8] to-[#1f4f9e]',
  orange: 'from-[#f39a45] to-[#b4561a]',
  white: 'from-[#f4f2ea] to-[#b9b6aa]',
} as const

function toggle() {
  emit('update:modelValue', props.options[isUp.value ? 0 : 1].value)
}
</script>

<template>
  <div class="flex select-none flex-col items-center gap-1">
    <span v-if="legends" class="text-[8px] font-semibold uppercase leading-none tracking-wider text-silk-dim">
      {{ options[1].label }}
    </span>
    <button
      type="button"
      role="switch"
      :aria-checked="isUp"
      :aria-label="`${accessibleName ?? label}: ${isUp ? options[1].label : options[0].label}`"
      class="relative h-8 w-[18px] overflow-hidden rounded-[2px] border border-black bg-gradient-to-b shadow-[0_2px_3px_rgba(0,0,0,0.7)] outline-none ring-led/70 focus-visible:ring-2"
      :class="COLORS[color]"
      @click="toggle"
    >
      <!-- The pressed half sits in shadow -->
      <span
        class="absolute inset-x-0 h-1/2 bg-black/45 transition-all duration-75"
        :class="isUp ? 'top-0' : 'top-1/2'"
      />
      <span class="absolute inset-x-0 top-1/2 h-px bg-black/40" />
    </button>
    <span v-if="legends" class="text-[8px] font-semibold uppercase leading-none tracking-wider text-silk-dim">
      {{ options[0].label }}
    </span>
    <span class="silk-label text-center">{{ label }}</span>
  </div>
</template>

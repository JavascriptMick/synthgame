<script setup lang="ts">
// A miniature 2/3-position toggle switch drawn like the hardware's, with the
// option legends beside the lever (listed top to bottom). Clicking the lever
// steps through the positions; clicking a legend selects it directly.
import type { ChoiceOption } from '~/synth/core/params'

const props = defineProps<{
  modelValue: string
  options: readonly ChoiceOption[]
  label: string
  /** Accessible name when the visible label is ambiguous (e.g. "Target"). */
  accessibleName?: string
  /** Hide the caption under the switch (the legends still name the options). */
  hideLabel?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const index = computed(() => Math.max(0, props.options.findIndex((o) => o.value === props.modelValue)))
const count = computed(() => props.options.length)
const leverFraction = computed(() => (count.value > 1 ? index.value / (count.value - 1) : 0.5))

function select(i: number) {
  const value = props.options[i].value
  if (value !== props.modelValue) emit('update:modelValue', value)
}

function cycle() {
  select((index.value + 1) % count.value)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    select(Math.max(0, index.value - 1))
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault()
    select(Math.min(count.value - 1, index.value + 1))
  }
}
</script>

<template>
  <div class="flex select-none flex-col items-center gap-1.5">
    <div class="flex items-stretch gap-1.5" role="radiogroup" :aria-label="accessibleName ?? label">
      <button
        type="button"
        :aria-label="`Change ${accessibleName ?? label}`"
        class="relative w-3.5 rounded-sm border border-black bg-gradient-to-b from-panel-deep to-panel-raised shadow-inner outline-none ring-led/70 focus-visible:ring-2"
        :style="{ height: `${count * 14}px` }"
        @click="cycle"
        @keydown="onKeyDown"
      >
        <span
          class="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-metal-dark bg-gradient-to-b from-metal-light to-metal-dark shadow transition-all duration-75"
          :style="{ top: `calc(5px + (100% - 10px) * ${leverFraction})` }"
        />
      </button>
      <div class="flex flex-col justify-between py-px">
        <button
          v-for="(option, i) in options"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="i === index"
          class="whitespace-nowrap text-left text-[9px] font-semibold uppercase leading-[12px] tracking-wider transition-colors"
          :class="i === index ? 'text-silk' : 'text-silk-dim/70 hover:text-silk-dim'"
          @click="select(i)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
    <span v-if="!hideLabel" class="silk-label">{{ label }}</span>
  </div>
</template>

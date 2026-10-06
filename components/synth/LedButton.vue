<script setup lang="ts">
// A rubber panel button with a status LED above it.
withDefaults(
  defineProps<{
    label?: string
    /** LED state: off, lit, or dim (e.g. a step that holds notes). */
    led?: boolean | 'dim'
    blink?: boolean
    disabled?: boolean
    title?: string
    size?: 'sm' | 'md'
  }>(),
  { label: '', led: false, blink: false, disabled: false, title: undefined, size: 'md' },
)

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <div class="flex select-none flex-col items-center gap-1">
    <span
      class="h-1.5 w-1.5 rounded-full transition-colors duration-75"
      :class="[
        led === true ? 'bg-led shadow-[0_0_6px_1px_rgba(255,59,48,0.8)]' : led === 'dim' ? 'bg-led/40' : 'bg-led-dim',
        blink ? 'animate-pulse' : '',
      ]"
    />
    <button
      type="button"
      :disabled="disabled"
      :title="title"
      :aria-pressed="led === true"
      class="rounded-[3px] border border-black bg-gradient-to-b from-[#3a3a3e] to-[#1d1d20] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_3px_rgba(0,0,0,0.6)] outline-none ring-led/70 transition active:translate-y-px active:shadow-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-35"
      :class="size === 'sm' ? 'h-5 w-7' : 'h-6 w-10'"
      @click="$emit('click', $event)"
    >
      <span class="sr-only">{{ label }}</span>
    </button>
    <span v-if="label" class="silk-label whitespace-nowrap" :class="disabled ? 'opacity-40' : ''">{{ label }}</span>
  </div>
</template>

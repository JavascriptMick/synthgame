<script setup lang="ts">
// Spring-loaded joystick: X bends pitch (±2 semitones), Y+ adds vibrato and
// Y- adds filter wobble, both driven by the voice LFO.

const { setPitchBend, setModulation } = useSynth()

const pad = ref<HTMLElement | null>(null)
const x = ref(0)
const y = ref(0)
const pointerId = ref<number | null>(null)

function update(e: PointerEvent) {
  const rect = pad.value!.getBoundingClientRect()
  const clamp = (v: number) => Math.min(1, Math.max(-1, v))
  x.value = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1)
  y.value = clamp(1 - ((e.clientY - rect.top) / rect.height) * 2)
  setPitchBend(x.value)
  setModulation(y.value)
}

function onPointerDown(e: PointerEvent) {
  pointerId.value = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  update(e)
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerId === pointerId.value) update(e)
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId.value) return
  pointerId.value = null
  x.value = 0
  y.value = 0
  setPitchBend(0)
  setModulation(0)
}
</script>

<template>
  <div class="flex select-none flex-col items-center gap-2">
    <div
      ref="pad"
      class="relative h-24 w-24 touch-none rounded-full border-2 border-black bg-gradient-to-b from-panel-deep to-panel-raised shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)]"
      role="application"
      aria-label="Joystick: X pitch bend, Y modulation"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-silk/10" />
      <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-silk/10" />
      <div
        class="pointer-events-none absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-gradient-to-br from-metal-light via-metal to-metal-dark shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
        :class="pointerId === null ? 'transition-all duration-150 ease-out' : ''"
        :style="{ left: `${50 + x * 35}%`, top: `${50 - y * 35}%` }"
      />
    </div>
    <span class="silk-label">Joystick</span>
  </div>
</template>

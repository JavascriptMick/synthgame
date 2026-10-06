<script setup lang="ts">
// Pitch and modulation wheels. Drag up/down; the pitch wheel springs back to
// centre on release, the mod wheel stays where it is left. Arrow keys work too.

const { setPitchBend, setModulation } = useSynth()

const WHEEL_TRAVEL_PX = 90

const pitch = ref(0) // -1..1
const mod = ref(0) // 0..1

let drag: { wheel: 'pitch' | 'mod'; pointerId: number; y: number; start: number } | null = null
const draggingPitch = ref(false)

function apply(wheel: 'pitch' | 'mod', value: number) {
  if (wheel === 'pitch') {
    pitch.value = Math.max(-1, Math.min(1, value))
    setPitchBend(pitch.value)
  } else {
    mod.value = Math.max(0, Math.min(1, value))
    setModulation(mod.value)
  }
}

function onPointerDown(wheel: 'pitch' | 'mod', e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag = { wheel, pointerId: e.pointerId, y: e.clientY, start: wheel === 'pitch' ? pitch.value : mod.value }
  draggingPitch.value = wheel === 'pitch'
}

function onPointerMove(e: PointerEvent) {
  if (!drag || drag.pointerId !== e.pointerId) return
  const span = drag.wheel === 'pitch' ? 2 : 1
  apply(drag.wheel, drag.start + ((drag.y - e.clientY) / WHEEL_TRAVEL_PX) * span)
}

function onPointerUp(e: PointerEvent) {
  if (!drag || drag.pointerId !== e.pointerId) return
  if (drag.wheel === 'pitch') apply('pitch', 0)
  drag = null
  draggingPitch.value = false
}

function onKeyDown(wheel: 'pitch' | 'mod', e: KeyboardEvent) {
  const delta = e.key === 'ArrowUp' ? 0.1 : e.key === 'ArrowDown' ? -0.1 : 0
  if (!delta) return
  e.preventDefault()
  apply(wheel, (wheel === 'pitch' ? pitch.value : mod.value) + delta)
}

/** Marker position from the top of the wheel, in %. */
const pitchMarker = computed(() => 50 - pitch.value * 40)
const modMarker = computed(() => 90 - mod.value * 80)
</script>

<template>
  <div class="flex gap-3">
    <div
      v-for="w in (['pitch', 'mod'] as const)"
      :key="w"
      class="flex flex-col items-center gap-2"
    >
      <div class="rounded-sm border border-black bg-panel-deep p-1 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
        <div
          role="slider"
          tabindex="0"
          :aria-label="w === 'pitch' ? 'Pitch wheel' : 'Modulation wheel'"
          :aria-valuemin="w === 'pitch' ? -1 : 0"
          aria-valuemax="1"
          :aria-valuenow="w === 'pitch' ? pitch : mod"
          class="relative h-28 w-7 cursor-ns-resize touch-none overflow-hidden rounded-[3px] bg-[repeating-linear-gradient(180deg,#2a2a2a_0px,#2a2a2a_2px,#121212_2px,#121212_5px)] outline-none ring-led/70 focus-visible:ring-2"
          @pointerdown="onPointerDown(w, $event)"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @keydown="onKeyDown(w, $event)"
        >
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/70" />
          <div
            class="pointer-events-none absolute inset-x-0 h-1 -translate-y-1/2 bg-silk"
            :class="w === 'pitch' && !draggingPitch ? 'transition-all duration-150 ease-out' : ''"
            :style="{ top: `${w === 'pitch' ? pitchMarker : modMarker}%` }"
          />
        </div>
      </div>
      <span class="silk-label">{{ w === 'pitch' ? 'Pitch' : 'Mod' }}</span>
    </div>
  </div>
</template>

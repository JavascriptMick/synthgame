<script setup lang="ts">
// A rotary knob working in normalised position (0..1).
// Drag vertically or horizontally (Shift for fine), use the mouse wheel or
// arrow keys, and double-click to return to the default position. While it
// is being changed, the value is shown in a bubble above the knob.
// The look ("modern" or "vintage") comes from the surrounding synth panel.

const props = withDefaults(
  defineProps<{
    modelValue: number
    label: string
    /** Accessible name when the visible label is ambiguous (e.g. "Int"). */
    accessibleName?: string
    /** Number of detents for stepped knobs; 0 for continuous. */
    steps?: number
    defaultValue?: number
    bipolar?: boolean
    size?: 'sm' | 'md' | 'lg'
    /** Legend printed around the knob, evenly spaced over its travel ('' draws a tick only). */
    ringLabels?: readonly string[]
    valueText?: string
  }>(),
  {
    accessibleName: undefined,
    steps: 0,
    defaultValue: 0,
    bipolar: false,
    size: 'md',
    ringLabels: undefined,
    valueText: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const style = useKnobStyle()

const SWEEP = 270
const START_ANGLE = -135
const DRAG_PIXELS = 180
const FINE_FACTOR = 6
const BUBBLE_MS = 900

const sizePx = computed(() => ({ sm: 38, md: 46, lg: 64 })[props.size])

const angle = computed(() => START_ANGLE + props.modelValue * SWEEP)

function polar(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) }
}

function arc(fromDeg: number, toDeg: number, r: number): string {
  const [a, b] = fromDeg <= toDeg ? [fromDeg, toDeg] : [toDeg, fromDeg]
  if (b - a < 0.01) return ''
  const s = polar(a, r)
  const e = polar(b, r)
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${e.x} ${e.y}`
}

const trackPath = arc(START_ANGLE, START_ANGLE + SWEEP, 44)
const valuePath = computed(() => arc(props.bipolar ? 0 : START_ANGLE, angle.value, 44))
const pointerStart = computed(() => polar(angle.value, style === 'vintage' ? 10 : 0))
const pointerEnd = computed(() => polar(angle.value, style === 'vintage' ? 33 : 26))

const ring = computed(() => {
  const labels = props.ringLabels
  if (!labels || labels.length < 2) return []
  return labels.map((text, i) => {
    const deg = START_ANGLE + (i / (labels.length - 1)) * SWEEP
    const label = polar(deg, 61)
    return {
      key: i,
      text,
      left: `${label.x}%`,
      top: `${label.y}%`,
      tickFrom: polar(deg, 40),
      tickTo: polar(deg, text ? 47 : 44),
    }
  })
})

function quantise(pos: number): number {
  const clamped = Math.min(1, Math.max(0, pos))
  if (props.steps < 2) return clamped
  return Math.round(clamped * (props.steps - 1)) / (props.steps - 1)
}

// --- Value bubble ---------------------------------------------------------------

const dragging = ref(false)
const recentlyChanged = ref(false)
let bubbleTimer: ReturnType<typeof setTimeout> | undefined
const showBubble = computed(() => !!props.valueText && (dragging.value || recentlyChanged.value))

function pokeBubble() {
  recentlyChanged.value = true
  clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => (recentlyChanged.value = false), BUBBLE_MS)
}
onBeforeUnmount(() => clearTimeout(bubbleTimer))

function commit(pos: number) {
  const next = quantise(pos)
  if (next !== props.modelValue) emit('update:modelValue', next)
  pokeBubble()
}

// --- Input -------------------------------------------------------------------------

// Dragging keeps an unquantised position so stepped knobs move smoothly between detents.
let drag: { pointerId: number; x: number; y: number; pos: number } | null = null

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  ;(e.currentTarget as HTMLElement).focus()
  drag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, pos: props.modelValue }
  dragging.value = true
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const scale = e.shiftKey ? DRAG_PIXELS * FINE_FACTOR : DRAG_PIXELS
  drag.pos = Math.min(1, Math.max(0, drag.pos + (drag.y - e.clientY + (e.clientX - drag.x)) / scale))
  drag.x = e.clientX
  drag.y = e.clientY
  commit(drag.pos)
}

function onPointerUp(e: PointerEvent) {
  if (drag?.pointerId !== e.pointerId) return
  drag = null
  dragging.value = false
  pokeBubble()
}

function nudge(direction: number, coarse: boolean) {
  const step = props.steps >= 2 ? 1 / (props.steps - 1) : coarse ? 0.1 : 0.01
  commit(props.modelValue + direction * step)
}

function onWheel(e: WheelEvent) {
  const direction = e.deltaY < 0 ? 1 : -1
  if (props.steps >= 2) nudge(direction, false)
  else commit(props.modelValue + direction * (e.shiftKey ? 0.002 : 0.015))
}

function onKeyDown(e: KeyboardEvent) {
  const keys: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }
  if (e.key in keys) {
    e.preventDefault()
    nudge(keys[e.key], e.shiftKey)
  } else if (e.key === 'Home') {
    commit(0)
  } else if (e.key === 'End') {
    commit(1)
  }
}
</script>

<template>
  <div class="flex select-none flex-col items-center gap-1.5">
    <div class="relative" :style="{ width: `${sizePx}px`, height: `${sizePx}px` }">
      <template v-for="r in ring" :key="r.key">
        <span
          v-if="r.text"
          class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[8px] font-medium leading-none"
          :class="style === 'vintage' ? 'text-silk' : 'text-silk-dim'"
          :style="{ left: r.left, top: r.top }"
        >
          {{ r.text }}
        </span>
      </template>
      <span
        v-if="showBubble"
        class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-silk shadow-lg ring-1 ring-white/10"
      >
        {{ valueText }}
      </span>
      <div
        role="slider"
        tabindex="0"
        :aria-label="accessibleName ?? label"
        :aria-valuenow="Math.round(modelValue * 1000) / 1000"
        aria-valuemin="0"
        aria-valuemax="1"
        :aria-valuetext="valueText"
        class="h-full w-full cursor-ns-resize touch-none rounded-full outline-none ring-led/70 focus-visible:ring-2"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel.prevent="onWheel"
        @keydown="onKeyDown"
        @dblclick="commit(defaultValue)"
      >
        <svg v-if="style === 'vintage'" viewBox="0 0 100 100" class="h-full w-full overflow-visible">
          <defs>
            <radialGradient id="knob-vintage-cap" cx="45%" cy="35%" r="70%">
              <stop offset="0%" stop-color="#3a3a3a" />
              <stop offset="100%" stop-color="#050505" />
            </radialGradient>
          </defs>
          <line
            v-for="r in ring"
            :key="r.key"
            :x1="r.tickFrom.x"
            :y1="r.tickFrom.y"
            :x2="r.tickTo.x"
            :y2="r.tickTo.y"
            stroke="#e9e9e4"
            stroke-width="1.6"
          />
          <circle cx="50" cy="50" r="36" fill="#0b0b0b" stroke="#000" stroke-width="1.5" />
          <circle cx="50" cy="50" r="33" fill="none" stroke="#262626" stroke-width="4" stroke-dasharray="1.6 1.8" />
          <circle cx="50" cy="50" r="23" fill="url(#knob-vintage-cap)" stroke="#000" stroke-width="1" />
          <line
            :x1="pointerStart.x"
            :y1="pointerStart.y"
            :x2="pointerEnd.x"
            :y2="pointerEnd.y"
            stroke="#f2f2ee"
            stroke-width="3.5"
            stroke-linecap="round"
          />
        </svg>
        <svg v-else viewBox="0 0 100 100" class="h-full w-full overflow-visible">
          <defs>
            <radialGradient id="knob-cap" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stop-color="#3b3b40" />
              <stop offset="100%" stop-color="#0b0b0d" />
            </radialGradient>
          </defs>
          <path :d="trackPath" fill="none" stroke="#3a3a3f" stroke-width="4" stroke-linecap="round" />
          <path
            v-if="valuePath"
            :d="valuePath"
            fill="none"
            stroke="#ff3b30"
            stroke-width="4"
            stroke-linecap="round"
          />
          <circle cx="50" cy="50" r="36" fill="#050506" />
          <circle cx="50" cy="50" r="34" fill="none" stroke="#2a2a2e" stroke-width="3" stroke-dasharray="2 2.4" />
          <circle cx="50" cy="50" r="30" fill="url(#knob-cap)" stroke="#000" stroke-width="1" />
          <line
            :x1="pointerStart.x"
            :y1="pointerStart.y"
            :x2="pointerEnd.x"
            :y2="pointerEnd.y"
            stroke="#f2f2ee"
            stroke-width="4"
            stroke-linecap="round"
          />
        </svg>
      </div>
    </div>
    <span class="silk-label max-w-[80px] text-center">{{ label }}</span>
  </div>
</template>

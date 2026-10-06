<script setup lang="ts">
// OLED display: program number and name, the value of the last-touched
// control, and a live oscilloscope of the master output.
import { formatParam } from '~/synth/core/params'

const { definition, ui, patch, analyser } = useSynth()
const { patch: xdPatch } = useXd4()

const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0

const programNumber = computed(() => String(ui.program + 1).padStart(3, '0'))
const flashTitle = computed(() => (ui.flashParam ? (definition.value.params[ui.flashParam]?.label ?? null) : null))
const flashValue = computed(() =>
  ui.flashParam ? formatParam(definition.value.params, ui.flashParam, patch) : ui.flashMessage,
)

const SCOPE_SAMPLES = 512

function draw() {
  frame = requestAnimationFrame(draw)
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return

  const dpr = window.devicePixelRatio || 1
  const w = Math.round(el.clientWidth * dpr)
  const h = Math.round(el.clientHeight * dpr)
  if (el.width !== w || el.height !== h) {
    el.width = w
    el.height = h
  }
  ctx.clearRect(0, 0, w, h)

  // Centre line
  ctx.strokeStyle = 'rgba(215, 243, 255, 0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()

  const values = analyser.value?.getValue()
  if (!values) return

  // Trigger on a rising zero crossing so periodic waves stand still.
  let start = 0
  for (let i = 1; i < values.length - SCOPE_SAMPLES; i++) {
    if (values[i - 1] < 0 && values[i] >= 0) {
      start = i
      break
    }
  }

  ctx.strokeStyle = '#d7f3ff'
  ctx.lineWidth = 1.5 * dpr
  ctx.shadowColor = 'rgba(160, 220, 255, 0.8)'
  ctx.shadowBlur = 4 * dpr
  ctx.beginPath()
  for (let i = 0; i < SCOPE_SAMPLES; i++) {
    const v = values[start + i] ?? 0
    const x = (i / (SCOPE_SAMPLES - 1)) * w
    const y = h / 2 - v * (h / 2) * 0.9
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
}

onMounted(() => {
  frame = requestAnimationFrame(draw)
})
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div
    class="flex h-[108px] w-[248px] flex-col rounded-sm border-[3px] border-black bg-oled-bg px-2.5 py-1.5 font-oled text-oled shadow-[inset_0_0_16px_rgba(0,0,0,0.9)]"
    aria-live="polite"
  >
    <div class="flex h-6 items-baseline justify-between gap-2 text-[19px] leading-6">
      <template v-if="flashValue">
        <span class="truncate">{{ flashTitle ?? '' }}</span>
        <span class="shrink-0">{{ flashValue }}</span>
      </template>
      <template v-else>
        <span class="shrink-0">P{{ programNumber }}</span>
        <span class="truncate">{{ ui.programName }}</span>
      </template>
    </div>
    <canvas ref="canvas" class="min-h-0 w-full flex-1" aria-hidden="true" />
    <div class="flex justify-between text-[14px] leading-4 text-oled/60">
      <span>{{ formatParam(definition.params, 'voiceMode', patch) }}</span>
      <span>{{ xdPatch.tempo.toFixed(1) }} BPM</span>
      <span>{{ ui.midiInputs > 0 ? `MIDI ${ui.midiInputs}` : 'NO MIDI' }}</span>
    </div>
  </div>
</template>

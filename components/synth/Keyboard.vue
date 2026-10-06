<script setup lang="ts">
// 37-key keyboard (C to C). Play with mouse/touch (slide for glissando, lower
// on the key is louder) or the computer keyboard: A W S E D F T G Y H U J K O L P ;
// with Z / X to shift the octave.

const KEY_COUNT = 37
const LOWEST_NOTE = 48 // C3 at octave 0
const COMPUTER_BASE = 60 // C4 at octave 0
const COMPUTER_KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';']
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

const { ui, activeNotes, pressKey, releaseKey, releaseAllKeys, shiftKeyboardOctave } = useSynth()

const lowest = computed(() => LOWEST_NOTE + ui.keyboardOctave * 12)
const computerBase = computed(() => COMPUTER_BASE + ui.keyboardOctave * 12)

interface Key {
  note: number
  black: boolean
  /** Left edge and width, as a percentage of the keyboard width. */
  left: number
  width: number
  hint?: string
}

const keys = computed<Key[]>(() => {
  const whiteCount = Array.from({ length: KEY_COUNT }, (_, i) => i).filter((i) => !BLACK_PITCH_CLASSES.has(i % 12)).length
  const whiteWidth = 100 / whiteCount
  const blackWidth = whiteWidth * 0.6
  let whiteIndex = 0
  return Array.from({ length: KEY_COUNT }, (_, i) => {
    const note = lowest.value + i
    const black = BLACK_PITCH_CLASSES.has(i % 12)
    const offset = note - computerBase.value
    const hint = offset >= 0 && offset < COMPUTER_KEYS.length ? COMPUTER_KEYS[offset].toUpperCase() : undefined
    if (black) return { note, black, left: whiteIndex * whiteWidth - blackWidth / 2, width: blackWidth, hint }
    return { note, black, left: whiteIndex++ * whiteWidth, width: whiteWidth, hint }
  })
})
const whiteKeys = computed(() => keys.value.filter((k) => !k.black))
const blackKeys = computed(() => keys.value.filter((k) => k.black))

// --- Pointer input: each pointer (finger) plays one note -----------------------

const pointerNotes = new Map<number, number>()

function hitTest(e: PointerEvent): { note: number; velocity: number } | null {
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
  const keyEl = el?.closest<HTMLElement>('[data-note]')
  if (!keyEl) return null
  const rect = keyEl.getBoundingClientRect()
  const depth = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
  return { note: Number(keyEl.dataset.note), velocity: 0.45 + depth * 0.55 }
}

function playPointer(e: PointerEvent) {
  const hit = hitTest(e)
  const current = pointerNotes.get(e.pointerId)
  if (hit?.note === current) return
  if (current !== undefined) {
    pointerNotes.delete(e.pointerId)
    if (![...pointerNotes.values()].includes(current)) releaseKey(current)
  }
  if (hit) {
    pointerNotes.set(e.pointerId, hit.note)
    pressKey(hit.note, hit.velocity)
  }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  playPointer(e)
}

function onPointerMove(e: PointerEvent) {
  if (pointerNotes.has(e.pointerId)) playPointer(e)
}

function onPointerUp(e: PointerEvent) {
  const note = pointerNotes.get(e.pointerId)
  pointerNotes.delete(e.pointerId)
  if (note !== undefined && ![...pointerNotes.values()].includes(note)) releaseKey(note)
}

// --- Computer keyboard -------------------------------------------------------------

/** Notes are remembered per key so an octave change mid-hold still releases correctly. */
const computerNotes = new Map<string, number>()

function isTyping(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  return !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return
  const key = e.key.toLowerCase()
  if (key === 'z' || key === 'x') {
    shiftKeyboardOctave(key === 'z' ? -1 : 1)
    return
  }
  const offset = COMPUTER_KEYS.indexOf(key)
  if (offset < 0 || computerNotes.has(key)) return
  e.preventDefault()
  const note = computerBase.value + offset
  computerNotes.set(key, note)
  pressKey(note)
}

function onKeyUp(e: KeyboardEvent) {
  const key = e.key.toLowerCase()
  const note = computerNotes.get(key)
  if (note === undefined) return
  computerNotes.delete(key)
  releaseKey(note)
}

function onBlur() {
  computerNotes.clear()
  pointerNotes.clear()
  releaseAllKeys()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
})
</script>

<template>
  <div
    class="relative h-40 w-full touch-none select-none rounded-b-sm border-t-[6px] border-[#2b0f0d]"
    role="group"
    aria-label="Keyboard"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      v-for="k in whiteKeys"
      :key="k.note"
      :data-note="k.note"
      class="absolute top-0 flex h-full items-end justify-center rounded-b-[4px] border border-[#999] pb-2 text-[10px] font-semibold transition-colors duration-75"
      :class="activeNotes.has(k.note) ? 'bg-gradient-to-b from-[#d8d8d4] to-[#bdbdb8] text-led' : 'bg-gradient-to-b from-[#f4f4f0] to-[#dcdcd6] text-black/30'"
      :style="{ left: `${k.left}%`, width: `${k.width}%` }"
    >
      {{ k.hint }}
    </div>
    <div
      v-for="k in blackKeys"
      :key="k.note"
      :data-note="k.note"
      class="absolute top-0 z-10 flex h-[62%] items-end justify-center rounded-b-[3px] border border-black pb-1.5 text-[9px] font-semibold shadow-[0_3px_4px_rgba(0,0,0,0.6)] transition-colors duration-75"
      :class="activeNotes.has(k.note) ? 'bg-[#3a1512] text-led' : 'bg-gradient-to-b from-[#26262a] to-[#0c0c0e] text-white/30'"
      :style="{ left: `${k.left}%`, width: `${k.width}%` }"
    >
      {{ k.hint }}
    </div>
  </div>
</template>

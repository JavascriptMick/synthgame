<script setup lang="ts">
// 16-step sequencer. Press REC then play notes or chords to fill steps
// (REST inserts a rest). While playing, REC overdubs onto the current step.
// Clicking a step mutes or unmutes it.
const { seq, sequencer } = useSynth()

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

function stepTitle(i: number): string {
  const step = seq.steps[i]
  const notes = step.notes.length ? step.notes.map(noteName).join(' ') : 'Rest'
  return `Step ${i + 1}: ${notes}${step.on ? '' : ' (muted)'}`
}

function stepLed(i: number): boolean | 'dim' {
  if (seq.currentStep === i) return true
  if (seq.recording && !seq.playing && seq.recStep === i) return true
  const step = seq.steps[i]
  return step.on && step.notes.length > 0 ? 'dim' : false
}
</script>

<template>
  <div class="flex items-end gap-6 px-3">
    <div class="flex items-end gap-2">
      <SynthLedButton label="Rec" :led="seq.recording" :blink="seq.recording" @click="sequencer.toggleRecord()" />
      <SynthLedButton label="Play" :led="seq.playing" @click="sequencer.togglePlay()" />
      <SynthLedButton label="Rest" :disabled="!seq.recording || seq.playing" @click="sequencer.rest()" />
      <SynthLedButton label="Clear" @click="sequencer.clear()" />
    </div>
    <div class="flex flex-1 justify-between gap-1" role="group" aria-label="Sequencer steps">
      <div v-for="(step, i) in seq.steps" :key="i" :title="stepTitle(i)">
        <SynthLedButton
          :label="String(i + 1)"
          :led="stepLed(i)"
          :blink="seq.recording && !seq.playing && seq.recStep === i"
          :class="step.on ? '' : 'opacity-50'"
          @click="sequencer.toggleStep(i)"
        />
      </div>
    </div>
  </div>
</template>

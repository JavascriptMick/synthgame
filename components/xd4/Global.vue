<script setup lang="ts">
// Top row: master/tempo, keyboard octave, display with program select and
// write, voice mode and portamento.
const { definition, ui, setParam, selectProgram, promptWriteProgram, shiftKeyboardOctave, setArpLatch } = useSynth()
const { patch } = useXd4()

const OCTAVES = [-2, -1, 0, 1, 2]
const VOICE_MODES = [
  { value: 'poly', label: 'Poly' },
  { value: 'unison', label: 'Unison' },
  { value: 'chord', label: 'Chord' },
  { value: 'arp', label: 'Arp/Latch' },
] as const

const programCount = computed(() => definition.value.programs.count)
const programPosition = computed({
  get: () => ui.program / (programCount.value - 1),
  set: (pos: number) => selectProgram(Math.round(pos * (programCount.value - 1))),
})

/** As on the hardware, pressing ARP/LATCH again while in arp mode toggles latch. */
function selectVoiceMode(mode: (typeof VOICE_MODES)[number]['value']) {
  if (mode === 'arp' && patch.voiceMode === 'arp') {
    setArpLatch(!ui.arpLatch)
    return
  }
  setParam('voiceMode', mode)
}
</script>

<template>
  <div class="flex items-start justify-between gap-2">
    <SynthSection title="Master">
      <SynthParamKnob param="masterVolume" label="Master" />
      <SynthParamKnob param="tempo" label="Tempo" />
    </SynthSection>

    <SynthSection title="Octave">
      <div class="flex flex-col items-center gap-2">
        <div class="flex gap-2" role="img" :aria-label="`Keyboard octave ${ui.keyboardOctave}`">
          <span
            v-for="o in OCTAVES"
            :key="o"
            class="h-1.5 w-1.5 rounded-full"
            :class="o === ui.keyboardOctave ? 'bg-led shadow-[0_0_6px_rgba(255,59,48,0.8)]' : 'bg-led-dim'"
          />
        </div>
        <div class="flex gap-2">
          <SynthLedButton label="Down (Z)" size="sm" @click="shiftKeyboardOctave(-1)" />
          <SynthLedButton label="Up (X)" size="sm" @click="shiftKeyboardOctave(1)" />
        </div>
      </div>
    </SynthSection>

    <div class="flex items-center gap-4 px-3">
      <Xd4Display />
      <div class="flex flex-col items-center gap-3">
        <SynthKnob
          v-model="programPosition"
          label="Program"
          :steps="programCount"
          :value-text="`${ui.program + 1} ${ui.programName}`"
        />
        <div class="flex gap-2">
          <SynthLedButton label="-" size="sm" @click="selectProgram(ui.program - 1)" />
          <SynthLedButton label="+" size="sm" @click="selectProgram(ui.program + 1)" />
          <SynthLedButton label="Write" size="sm" @click="promptWriteProgram" />
        </div>
      </div>
    </div>

    <SynthSection title="Voice Mode">
      <SynthParamKnob param="voiceDepth" label="Depth" />
      <div class="grid grid-cols-2 gap-x-3 gap-y-1">
        <SynthLedButton
          v-for="m in VOICE_MODES"
          :key="m.value"
          :label="m.label"
          size="sm"
          :led="patch.voiceMode === m.value"
          :blink="m.value === 'arp' && patch.voiceMode === 'arp' && ui.arpLatch"
          :title="m.value === 'arp' ? 'Press again in arp mode to toggle latch' : undefined"
          @click="selectVoiceMode(m.value)"
        />
      </div>
    </SynthSection>

    <SynthSection title="Portamento">
      <SynthParamKnob param="portamento" label="Time" />
    </SynthSection>
  </div>
</template>

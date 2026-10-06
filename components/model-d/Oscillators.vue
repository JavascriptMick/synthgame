<template>
  <ModelDSection title="Oscillator Bank">
    <div class="grid grid-cols-[auto_auto_auto_auto] items-start gap-x-6 gap-y-5">
      <span class="silk-label self-center text-silk-dim">1</span>
      <SynthParamKnob param="osc1Range" label="Range" show-detents />
      <div />
      <SynthParamKnob param="osc1Wave" label="Waveform" show-detents />

      <span class="silk-label self-center text-silk-dim">2</span>
      <SynthParamKnob param="osc2Range" label="Range" show-detents />
      <SynthParamKnob param="osc2Freq" label="Frequency" />
      <SynthParamKnob param="osc2Wave" label="Waveform" show-detents />

      <SynthParamRocker param="osc3Control" label="Osc 3 Ctrl" color="orange" :legends="false" />
      <SynthParamKnob param="osc3Range" label="Range" show-detents />
      <SynthParamKnob param="osc3Freq" label="Frequency" />
      <SynthParamKnob param="osc3Wave" label="Waveform" show-detents />
    </div>
  </ModelDSection>
</template>

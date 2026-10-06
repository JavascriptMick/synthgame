<template>
  <ModelDSection title="Modifiers">
    <div class="flex flex-col gap-4">
      <div class="flex items-start gap-5">
        <SynthParamKnob param="cutoff" label="Cutoff" size="lg" />
        <SynthParamKnob param="emphasis" label="Emphasis" />
        <SynthParamKnob param="contourAmount" label="Contour Amt" />
        <SynthParamRocker param="filterMod" label="Filter Mod" color="blue" :legends="false" />
        <SynthParamRocker param="keyTrack1" label="Kbd 1" color="orange" :legends="false" />
        <SynthParamRocker param="keyTrack2" label="Kbd 2" color="orange" :legends="false" />
      </div>
      <div class="flex items-start gap-8">
        <div class="flex flex-col gap-2">
          <span class="silk-label text-silk-dim">Filter Contour</span>
          <div class="flex gap-5">
            <SynthParamKnob param="filterAttack" label="Attack" />
            <SynthParamKnob param="filterDecay" label="Decay" />
            <SynthParamKnob param="filterSustain" label="Sustain" />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="silk-label text-silk-dim">Loudness Contour</span>
          <div class="flex gap-5">
            <SynthParamKnob param="loudAttack" label="Attack" />
            <SynthParamKnob param="loudDecay" label="Decay" />
            <SynthParamKnob param="loudSustain" label="Sustain" />
          </div>
        </div>
      </div>
    </div>
  </ModelDSection>
</template>

<template>
  <ModelDSection title="Controllers">
    <div class="flex flex-col gap-5">
      <div class="grid grid-cols-3 gap-x-6 gap-y-5">
        <SynthParamKnob param="tune" label="Tune" />
        <SynthParamKnob param="glide" label="Glide" />
        <SynthParamKnob param="lfoRate" label="LFO Rate" />
        <SynthParamKnob param="modMix" label="Mod Mix" />
        <SynthParamKnob param="modDepth" label="Mod Depth" />
      </div>
      <div class="flex justify-between gap-3">
        <SynthParamRocker param="oscMod" label="Osc Mod" color="blue" :legends="false" />
        <SynthParamRocker param="modSourceA" label="Source A" />
        <SynthParamRocker param="modSourceB" label="Source B" />
        <SynthParamRocker param="lfoWave" label="LFO" />
      </div>
    </div>
  </ModelDSection>
</template>

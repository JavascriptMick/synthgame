<script setup lang="ts">
// The Model D instrument: black panel between wood cheeks, with a keybed
// holding the arpeggiator, the glide/decay switches and the pitch and mod wheels.
provideKnobStyle('vintage')
</script>

<template>
  <div class="flex overflow-hidden rounded-md shadow-2xl">
    <div class="wood-cheek w-7 rounded-l-md" />
    <div class="flex-1 bg-[#121212]">
      <div class="flex items-stretch justify-between divide-x divide-white/10 border-b-4 border-black">
        <ModelDControllers />
        <ModelDOscillators />
        <ModelDMixer />
        <ModelDModifiers />
        <ModelDOutput />
      </div>
      <div class="border-b border-black bg-panel-deep px-6 pb-3 pt-6">
        <ModelDArpeggiator />
      </div>
      <div class="flex items-center gap-6 bg-panel-deep px-6 py-4">
        <div class="flex items-center gap-5">
          <div class="flex gap-3">
            <SynthParamRocker param="glideOn" label="Glide" color="white" :legends="false" />
            <SynthParamRocker param="decaySwitch" label="Decay" color="white" :legends="false" />
          </div>
          <ModelDWheels />
        </div>
        <SynthKeyboard class="flex-1" />
      </div>
    </div>
    <div class="wood-cheek w-7 rounded-r-md" />
  </div>
</template>

<style scoped>
/* Walnut side panels: a base gradient with fine grain lines over it. */
.wood-cheek {
  background:
    repeating-linear-gradient(
      92deg,
      rgba(0, 0, 0, 0.18) 0px,
      rgba(0, 0, 0, 0) 2px,
      rgba(255, 255, 255, 0.05) 4px,
      rgba(0, 0, 0, 0) 7px
    ),
    linear-gradient(90deg, #3b2211, #8a5530 45%, #6f4423 70%, #3b2211);
}
</style>

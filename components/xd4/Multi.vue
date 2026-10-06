<script setup lang="ts">
// Multi engine: filtered noise or VPM (FM). TYPE selects within the engine.
const { patch } = useXd4()
</script>

<template>
  <SynthSection title="Multi Engine">
    <SynthParamSwitch param="multiEngine" label="Engine" />
    <SynthParamKnob :param="patch.multiEngine === 'noise' ? 'multiNoiseType' : 'multiVpmType'" label="Type" />
    <SynthParamKnob param="multiShape" label="Shape" />
  </SynthSection>
</template>

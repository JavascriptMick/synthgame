<template>
  <ModelDSection title="Output">
    <div class="flex flex-col items-center gap-6">
      <SynthParamKnob param="volume" label="Volume" />
      <SynthParamRocker param="a440" label="A-440" :legends="false" />
    </div>
  </ModelDSection>
</template>

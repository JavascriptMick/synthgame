<script setup lang="ts">
// The XD-4 instrument: black panel between aluminium cheeks, joystick and keyboard.
provideKnobStyle('modern')
</script>

<template>
  <div class="flex rounded-md bg-gradient-to-b from-metal-light to-metal-dark p-[3px] shadow-2xl">
    <div class="w-4 rounded-l bg-gradient-to-r from-metal-dark via-metal-light to-metal" />
    <div class="flex-1 bg-panel">
      <div class="flex flex-col gap-6 border-b border-black px-2 py-5">
        <Xd4Global />
        <div class="flex items-start justify-between border-t border-panel-line pt-5">
          <Xd4Vco :n="1" />
          <Xd4Vco :n="2" />
          <Xd4Multi />
          <Xd4Mixer />
        </div>
        <div class="flex items-start justify-between border-t border-panel-line pt-5">
          <Xd4Filter />
          <Xd4AmpEg />
          <Xd4Eg />
          <Xd4Lfo />
          <Xd4Effects />
        </div>
        <div class="border-t border-panel-line pt-4">
          <Xd4Sequencer />
        </div>
      </div>
      <div class="flex items-center gap-6 bg-panel-deep px-6 py-4">
        <Xd4Joystick />
        <SynthKeyboard class="flex-1" />
      </div>
    </div>
    <div class="w-4 rounded-r bg-gradient-to-l from-metal-dark via-metal-light to-metal" />
  </div>
</template>

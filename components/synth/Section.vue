<script setup lang="ts">
// A titled panel section, like the silkscreened groups on the hardware.
defineProps<{ title: string }>()
</script>

<template>
  <section class="flex flex-col gap-3 px-2" :aria-label="title">
    <h2 class="section-title">{{ title }}</h2>
    <div class="flex flex-1 items-start justify-center gap-3">
      <slot />
    </div>
  </section>
</template>

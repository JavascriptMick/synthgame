<script setup lang="ts">
// A Model D panel section: controls above, name on the silver strip below.
defineProps<{ title: string }>()
</script>

<template>
  <section class="flex flex-col" :aria-label="title">
    <div class="flex flex-1 items-start justify-center px-4 pb-4 pt-5">
      <slot />
    </div>
    <h2
      class="border-y border-black bg-gradient-to-b from-[#e4e2da] to-[#b8b5aa] py-1 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-black"
    >
      {{ title }}
    </h2>
  </section>
</template>

<script setup lang="ts">
import { SYNTHS } from '~/synth/registry'

await navigateTo(`/${SYNTHS[0].id}`, { replace: true })
</script>

<template>
  <div />
</template>

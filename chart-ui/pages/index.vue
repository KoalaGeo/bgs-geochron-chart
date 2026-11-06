<template>
  <template v-if="config.icsBranding">
    <StratigraphyHeader class="no-print" />
    <main id="main-content"><DynamicChart /></main>
    <StratigraphyFooter />
  </template>
  <template v-else>
    <BgsApp />
  </template>
</template>
<script setup lang="ts">
const config = useChartConfig()
</script>

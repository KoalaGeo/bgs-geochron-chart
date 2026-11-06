<script setup lang="ts">
const base = useRuntimeConfig().app.baseURL
</script>

<template>
  <div class="bgs-site-header">
    <a class="bgs-skip-link" href="#main-content">Skip to main content</a>
    <header>
      <p class="bgs-org">British Geological Survey</p>
      <h1>Geochronological Chart</h1>
      <p>
        The BGS Geochronology vocabulary laid out on the structure of the International Chronostratigraphic
        Chart, with British and NW European regional series and stages, and Marine Isotope Stages, alongside.
        Ages, names and colours are those published by BGS.
      </p>
      <p>
        Source vocabulary:
        <a href="http://data.bgs.ac.uk/ref/Geochronology/Division">http://data.bgs.ac.uk/ref/Geochronology/Division</a>.
        Select any unit for its definition and identifier.
        Chart data: <a :href="`${base}data/bgs-chart.ttl`">Turtle</a>,
        <a :href="`${base}data/bgs-chart-report.json`">build report</a>
        (every ICS join, fallback and age difference).
      </p>
    </header>
  </div>
</template>

<style scoped>
.bgs-site-header {
  font-family: Arial, Helvetica, sans-serif;
  max-width: 70rem;
  margin: 0 auto 1.5rem;
  padding: 1.5rem 1rem 0;
}
.bgs-org {
  margin: 0;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
h1 {
  margin: 0.2rem 0 0.8rem;
  font-weight: 600;
}
p {
  line-height: 1.45;
}
.bgs-skip-link {
  position: absolute;
  left: -999px;
}
.bgs-skip-link:focus {
  left: 1rem;
  top: 1rem;
}
</style>

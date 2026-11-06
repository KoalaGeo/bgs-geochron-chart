<script setup lang="ts">
import type { BgsTab } from './BgsHeader.vue'

const emit = defineEmits<{
  (e: 'selectTab', tab: BgsTab): void
}>()
</script>

<template>
  <footer class="bgs-site-footer no-print">
    <div class="bgs-footer-inner">
      <p>
        Built from the
        <a href="https://github.com/BritishGeologicalSurvey/vocabularies" target="_blank" rel="noreferrer">BGS vocabularies</a>
        (Geochronology, Lexicon of Named Rock Units &amp; Rock Classification Scheme).
        Linked data at <a href="https://data.bgs.ac.uk/" target="_blank" rel="noreferrer">data.bgs.ac.uk</a>.
      </p>
      <p>
        Chart structure, ordering and GSSP/GSSA ratification from the
        <a href="https://stratigraphy.org/chart" target="_blank" rel="noreferrer">International Chronostratigraphic Chart</a>
        © International Commission on Stratigraphy, used under
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.
        Chart software adapted from
        <a href="https://github.com/i-c-stratigraphy/chart" target="_blank" rel="noreferrer">i-c-stratigraphy/chart</a>.
      </p>
      <p class="bgs-footer-links">
        <a href="?tab=geochron" @click.prevent="emit('selectTab', 'geochron')">Geochronological Chart</a> ·
        <a href="?tab=lexicon" @click.prevent="emit('selectTab', 'lexicon')">Lexicon</a> ·
        <a href="?tab=browse" @click.prevent="emit('selectTab', 'browse')">Browse all units</a> ·
        <a href="?tab=rcs" @click.prevent="emit('selectTab', 'rcs')">Rock Classification Scheme</a> ·
        <a href="?tab=about" @click.prevent="emit('selectTab', 'about')">About the data</a> ·
        <a href="https://www.bgs.ac.uk/technologies/the-bgs-lexicon-of-named-rock-units/" target="_blank" rel="noreferrer">About the Lexicon</a> ·
        <a href="https://www.bgs.ac.uk/technologies/bgs-rock-classification-scheme/" target="_blank" rel="noreferrer">About the RCS</a>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.bgs-site-footer {
  margin-top: auto;
  border-top: 1px solid #d9e0e2;
  background: #ffffff;
  color: #5a6a73;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 0.875rem;
}

.bgs-footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 16px 28px;
}

.bgs-footer-inner p {
  margin: 0 0 0.6em;
  line-height: 1.5;
}

.bgs-footer-inner p:last-child {
  margin-bottom: 0;
}

.bgs-footer-inner a {
  color: #005b80;
  text-underline-offset: 2px;
}

.bgs-footer-inner a:hover {
  color: #00394d;
}
</style>

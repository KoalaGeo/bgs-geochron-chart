<script setup lang="ts">
export type BgsTab = 'geochron' | 'lexicon' | 'rcs' | 'browse' | 'about'

defineProps<{
  activeTab: BgsTab
}>()

const emit = defineEmits<{
  (e: 'selectTab', tab: BgsTab): void
}>()

const base = useRuntimeConfig().app.baseURL

const tabs: { id: BgsTab; label: string; href: string }[] = [
  { id: 'geochron', label: 'Geochronological Chart', href: '?tab=geochron' },
  { id: 'lexicon', label: 'Lexicon', href: '?tab=lexicon' },
  { id: 'rcs', label: 'Rock Classification Scheme', href: '?tab=rcs' },
  { id: 'browse', label: 'Browse A–Z', href: '?tab=browse' },
  { id: 'about', label: 'About the data', href: '?tab=about' },
]
</script>

<template>
  <div class="bgs-header-wrapper no-print">
    <a class="bgs-skip-link" href="#main-content">Skip to main content</a>
    <header class="bgs-topbar">
      <div class="bgs-topbar-inner">
        <a class="bgs-brand" :href="base" @click.prevent="emit('selectTab', 'geochron')">
          <span class="bgs-brand-mark" aria-hidden="true"></span>
          <span class="bgs-brand-text">
            <span class="bgs-brand-org">British Geological Survey</span>
            <span class="bgs-brand-name">Geochronology, Lexicon &amp; Rock Classification</span>
          </span>
        </a>
        <nav class="bgs-site-nav" aria-label="BGS vocabulary tools">
          <a
            v-for="t in tabs"
            :key="t.id"
            :href="t.href"
            :aria-current="activeTab === t.id ? 'page' : undefined"
            @click.prevent="emit('selectTab', t.id)"
          >
            {{ t.label }}
          </a>
        </nav>
      </div>
    </header>

    <div v-if="activeTab === 'geochron'" class="bgs-chart-intro">
      <h1>BGS Geochronological Chart</h1>
      <p>
        The BGS Geochronology vocabulary laid out on the structure of the International Chronostratigraphic
        Chart, with British and NW European regional series and stages, and Marine Isotope Stages, alongside.
        Ages, names and colours are those published by BGS.
      </p>
      <p>
        Source vocabulary:
        <a href="http://data.bgs.ac.uk/ref/Geochronology/Division">http://data.bgs.ac.uk/ref/Geochronology/Division</a>.
        Select any unit for its definition, identifier and Lexicon rock units of that age.
        Chart data: <a :href="`${base}data/bgs-chart.ttl`">Turtle</a>,
        <a :href="`${base}data/bgs-chart-report.json`">build report</a>
        (every ICS join, fallback and age difference).
      </p>
    </div>
  </div>
</template>

<style scoped>
.bgs-header-wrapper {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.bgs-topbar {
  background: #00394d;
  color: #ffffff;
}

.bgs-topbar-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 12px 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 28px;
}

.bgs-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}

.bgs-brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  flex: none;
  background: linear-gradient(
    180deg,
    #9ad1d4 0 22%,
    #f2c14e 22% 40%,
    #c9744d 40% 58%,
    #7a8b99 58% 78%,
    #3d5a6c 78% 100%
  );
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%);
}

.bgs-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.bgs-brand-org {
  font-size: 0.75rem;
  opacity: 0.82;
  letter-spacing: 0.02em;
}

.bgs-brand-name {
  font-weight: 650;
  font-size: 1.05rem;
}

.bgs-site-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: auto;
}

.bgs-site-nav a {
  color: #ffffff;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.94rem;
  opacity: 0.9;
  transition: background 0.15s, opacity 0.15s;
}

.bgs-site-nav a:hover {
  background: rgb(255 255 255 / 12%);
  opacity: 1;
}

.bgs-site-nav a[aria-current="page"] {
  background: rgb(255 255 255 / 20%);
  opacity: 1;
  font-weight: 600;
}

.bgs-chart-intro {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.25rem 1rem 0.5rem;
  color: #17252d;
}

.bgs-chart-intro h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  font-weight: 650;
}

.bgs-chart-intro p {
  margin: 0 0 0.6rem;
  line-height: 1.5;
  max-width: 85ch;
}

.bgs-chart-intro a {
  color: #005b80;
}

.bgs-skip-link {
  position: absolute;
  left: -9999px;
}

.bgs-skip-link:focus {
  left: 1rem;
  top: 0.75rem;
  z-index: 100;
  background: #ffffff;
  color: #17252d;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
}
</style>

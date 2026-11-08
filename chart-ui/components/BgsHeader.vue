<script setup lang="ts">
import { onMounted } from 'vue'
import { bgsPidHref, useBgsVocabs } from '~/utils/bgsVocabs'

export type BgsTab = 'geochron' | 'lexicon' | 'rcs' | 'browse' | 'about'

defineProps<{
  activeTab: BgsTab
}>()

const emit = defineEmits<{
  (e: 'selectTab', tab: BgsTab): void
}>()

const config = useRuntimeConfig()
const base = config.app.baseURL
const siteName = config.public.siteName as string
const { ensureAboutLoaded, vocabFileUrl } = useBgsVocabs()

onMounted(() => {
  ensureAboutLoaded().catch(() => {})
})

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
    <!-- Layout follows the BGS www-apps header include: corporate links strip,
         logo band, then breadcrumbs. The BGS mega-menu (nav.htm + jQuery) is
         replaced by this site's own sections. -->
    <header class="bgs-masthead">
      <div class="bgs-topnav">
        <nav class="bgs-topnav-inner" aria-label="British Geological Survey">
          <a href="https://www.bgs.ac.uk/news/">News &amp; Events</a>
          <a href="https://shop.bgs.ac.uk/Shop">BGS Shop</a>
          <a href="https://www.bgs.ac.uk/hosted-websites/">Hosted sites</a>
        </nav>
      </div>

      <div class="bgs-logonav">
        <a class="bgs-logo" href="https://www.bgs.ac.uk/">
          <img
            :src="`${base}images/bgs/BGS-Logo-Pos-RGB.svg`"
            alt="British Geological Survey home"
            width="122"
            height="51"
          >
        </a>
        <nav class="bgs-site-nav" :aria-label="siteName">
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

      <div class="bgs-breadcrumbs">
        <nav class="bgs-breadcrumbs-inner" aria-label="Site breadcrumb">
          <a href="https://www.bgs.ac.uk/">Home</a>
          <span class="bgs-crumb-sep" aria-hidden="true"></span>
          <a :href="base" @click.prevent="emit('selectTab', 'geochron')">{{ siteName }}</a>
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
        <a :href="bgsPidHref('http://data.bgs.ac.uk/ref/Geochronology/Division')" target="_blank" rel="noreferrer">http://data.bgs.ac.uk/ref/Geochronology/Division</a>
        (<a :href="vocabFileUrl('Geochronology.ttl')" target="_blank" rel="noreferrer">Geochronology.ttl</a> ·
        <a :href="vocabFileUrl('Geochronology.csv')" target="_blank" rel="noreferrer">Geochronology.csv</a>).
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
  font-family: var(--bgs-font);
  color: var(--bgs-blue);
}

.bgs-header-wrapper a:focus-visible {
  outline: 3px solid var(--bgs-blue);
  outline-offset: 2px;
}

/* Corporate links strip (header.htm section.topnav) */
.bgs-topnav {
  background: var(--bgs-blue);
  color: var(--bgs-white);
}

.bgs-topnav-inner {
  max-width: var(--bgs-max-width);
  margin: 0 auto;
  padding: 0 24px 0 16px;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.bgs-topnav-inner a {
  color: var(--bgs-white);
  text-decoration: none;
  padding: 11px 16px 10px;
  border-left: 1px solid var(--bgs-white);
}

.bgs-topnav-inner a:last-child {
  border-right: 1px solid var(--bgs-white);
}

.bgs-topnav-inner a:hover {
  background: var(--bgs-highlight);
}

.bgs-topnav-inner a:focus-visible {
  outline-color: var(--bgs-lt-ochre);
  outline-offset: -3px;
}

@media (max-width: 576px) {
  .bgs-topnav-inner {
    padding: 0;
    justify-content: center;
  }

  .bgs-topnav-inner a {
    padding: 8px 10px;
    font-size: 14px;
  }
}

/* Logo band (section.logonav) */
.bgs-logonav {
  max-width: var(--bgs-max-width);
  min-height: 80px;
  margin: 0 auto;
  padding: 5px 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 24px;
  background: var(--bgs-white);
}

.bgs-logo {
  flex: none;
  display: block;
}

.bgs-logo img {
  display: block;
  height: 51px;
  width: auto;
  margin: 10px 0;
}

.bgs-site-nav {
  display: flex;
  flex-wrap: wrap;
  margin-left: auto;
}

/* Nav links as in main.css article.nav: black text, ochre 3px underline. */
.bgs-site-nav a {
  color: var(--bgs-black);
  text-decoration: none;
  padding: 5px;
  margin: 8px 10px;
  border-bottom: 3px solid transparent;
}

.bgs-site-nav a:hover {
  border-bottom-color: var(--bgs-ochre);
}

.bgs-site-nav a[aria-current="page"] {
  font-weight: 700;
  border-bottom-color: var(--bgs-ochre);
}

/* Breadcrumbs band (section.breadcrumbs) */
.bgs-breadcrumbs {
  background: var(--bgs-lt-gray);
  box-shadow: 0 -2px 4px 0 rgb(183 183 183 / 50%);
  padding: 5px 16px;
}

/* Side padding lines the crumb text up with the logo above. */
.bgs-breadcrumbs-inner {
  max-width: var(--bgs-max-width);
  margin: 0 auto;
  padding: 0 11px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: 14px;
}

.bgs-breadcrumbs-inner a {
  color: var(--bgs-black);
  text-decoration: none;
  padding: 5px;
}

.bgs-breadcrumbs-inner a:hover {
  text-decoration: underline;
}

.bgs-crumb-sep {
  width: 7px;
  height: 7px;
  margin: 0 8px 0 4px;
  border-top: 1.5px solid var(--bgs-blue);
  border-right: 1.5px solid var(--bgs-blue);
  transform: rotate(45deg);
}

/* Chart tab introduction */
.bgs-chart-intro {
  max-width: var(--bgs-max-width);
  margin: 0 auto;
  padding: 1.25rem 1rem 0.5rem;
  color: var(--bgs-black);
}

.bgs-chart-intro h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--bgs-blue);
}

.bgs-chart-intro p {
  margin: 0 0 0.6rem;
  line-height: 1.5;
  max-width: 85ch;
}

.bgs-chart-intro a {
  color: var(--bgs-blue);
}

.bgs-chart-intro a:hover {
  text-decoration-color: var(--bgs-ochre);
  text-decoration-thickness: 2px;
}

.bgs-skip-link {
  position: absolute;
  left: -9999px;
}

.bgs-skip-link:focus {
  left: 1rem;
  top: 0.75rem;
  z-index: 100;
  background: var(--bgs-white);
  color: var(--bgs-blue);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
}
</style>

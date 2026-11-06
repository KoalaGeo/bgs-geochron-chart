<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type BgsTab = 'geochron' | 'lexicon' | 'rcs' | 'browse' | 'about'

const props = withDefaults(defineProps<{
  initialTab?: BgsTab
}>(), {
  initialTab: 'geochron',
})

const route = useRoute()
const router = useRouter()

const qTab = useRouteQuery<string>('tab', props.initialTab)
const qUnit = useRouteQuery<string>('unit', '')
const qAge = useRouteQuery<string>('age', '')
const qMode = useRouteQuery<string>('mode', 'overlaps')
const qLith = useRouteQuery<string>('lith', '')
const qPub = useRouteQuery<string>('pub', '')
const qRcsCode = useRouteQuery<string>('rcsCode', '')
const qRcsLegacy = useRouteQuery<string>('rcs_code', '')
const qTarget = useRouteQuery<string>('target', '')

const VALID_TABS: BgsTab[] = ['geochron', 'lexicon', 'rcs', 'browse', 'about']

const activeTab = computed<BgsTab>(() => {
  const raw = String(qTab.value || props.initialTab).toLowerCase() as BgsTab
  return VALID_TABS.includes(raw) ? raw : props.initialTab
})

onMounted(() => {
  // Deep-link detection when ?tab= is not explicitly specified in the URL
  if (!route.query.tab) {
    if (qUnit.value || qAge.value || qLith.value || qPub.value) {
      qTab.value = 'lexicon'
    } else if (qRcsCode.value || qRcsLegacy.value) {
      qTab.value = 'rcs'
    }
  }
})

function selectTab(tab: BgsTab) {
  if (tab === 'lexicon' && qUnit.value && activeTab.value === 'lexicon') {
    // Clicking Lexicon tab while viewing a unit returns to the Lexicon search table
    qUnit.value = ''
  }
  qTab.value = tab
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleOpenLexiconAge(code: string, mode: 'overlaps' | 'oldest') {
  qUnit.value = ''
  qAge.value = code
  qMode.value = mode
  qTab.value = 'lexicon'
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleOpenGeochron(divisionIri: string) {
  qTarget.value = divisionIri
  qTab.value = 'geochron'
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleOpenRcs(code: string) {
  qRcsCode.value = code
  qTab.value = 'rcs'
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleOpenLexiconLith(code: string) {
  qUnit.value = ''
  qLith.value = code
  qTab.value = 'lexicon'
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleOpenUnit(code: string) {
  qUnit.value = code
  qTab.value = 'lexicon'
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="bgs-shell">
    <BgsHeader
      class="no-print"
      :active-tab="activeTab"
      @select-tab="selectTab"
    />
    <main id="main-content">
      <div v-show="activeTab === 'geochron'">
        <DynamicChart @open-lexicon-age="handleOpenLexiconAge" />
      </div>
      <LexiconTab
        v-if="activeTab === 'lexicon'"
        @open-rcs="handleOpenRcs"
        @open-geochron="handleOpenGeochron"
        @open-browse="selectTab('browse')"
      />
      <RcsTab
        v-else-if="activeTab === 'rcs'"
        @open-lexicon-lith="handleOpenLexiconLith"
      />
      <LexiconBrowseTab
        v-else-if="activeTab === 'browse'"
        @open-unit="handleOpenUnit"
        @open-lexicon="selectTab('lexicon')"
      />
      <AboutTab
        v-else-if="activeTab === 'about'"
      />
    </main>
    <BgsFooter
      class="no-print"
      @select-tab="selectTab"
    />
  </div>
</template>

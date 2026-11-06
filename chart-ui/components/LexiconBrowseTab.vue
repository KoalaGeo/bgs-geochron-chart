<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouteQuery } from '@vueuse/router'
import { useBgsVocabs, type LexiconRow } from '~/utils/bgsVocabs'

const emit = defineEmits<{
  (e: 'openUnit', code: string): void
  (e: 'openLexicon'): void
}>()

const {
  lexiconRows,
  loadingLexicon,
  lexiconError,
  ensureLexiconLoaded,
} = useBgsVocabs()

const selectedLetter = useRouteQuery<string>('letter', '')

onMounted(async () => {
  await ensureLexiconLoaded()
})

const groups = computed(() => {
  const map = new Map<string, LexiconRow[]>()
  for (const u of lexiconRows.value || []) {
    const first = (u.name.replace(/^[^A-Za-z0-9]+/, '')[0] || '#').toUpperCase()
    const key = /[A-Z]/.test(first) ? first : '0-9'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(u)
  }
  return map
})

const keys = computed(() =>
  [...groups.value.keys()].sort((a, b) => (a === '0-9' ? -1 : b === '0-9' ? 1 : a.localeCompare(b)))
)

const currentKey = computed(() => {
  const k = (selectedLetter.value || '').toUpperCase()
  return groups.value.has(k) ? k : ''
})

const currentList = computed(() => {
  if (!currentKey.value) return []
  return [...(groups.value.get(currentKey.value) || [])].sort(
    (a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code)
  )
})
</script>

<template>
  <div class="bgs-view bgs-wrap">
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="#lexicon" @click.prevent="emit('openLexicon')">Lexicon</a>
      <span class="sep">›</span>
      <template v-if="currentKey">
        <a href="#browse" @click.prevent="selectedLetter = ''">Browse</a>
        <span class="sep">›</span>
        <span aria-current="page">{{ currentKey }}</span>
      </template>
      <span v-else aria-current="page">Browse</span>
    </nav>

    <header class="page-head">
      <h1 v-if="currentKey">Units beginning {{ currentKey }}</h1>
      <h1 v-else>Browse all units</h1>
      <p class="lede">
        <template v-if="loadingLexicon">Loading Lexicon…</template>
        <template v-else-if="currentKey">
          {{ currentList.length.toLocaleString('en-GB') }} {{ currentList.length === 1 ? 'unit' : 'units' }}.
        </template>
        <template v-else>
          {{ (lexiconRows?.length || 0).toLocaleString('en-GB') }} units in the Lexicon, current and obsolete, listed by name.
        </template>
      </p>
    </header>

    <div v-if="lexiconError" class="bgs-card notice">
      Could not load the Lexicon data: {{ lexiconError }}
    </div>

    <template v-else>
      <nav class="letters" aria-label="Initial letter">
        <button
          type="button"
          :aria-current="!currentKey ? 'page' : undefined"
          @click="selectedLetter = ''"
        >
          All
        </button>
        <button
          v-for="k in keys"
          :key="k"
          type="button"
          :aria-current="currentKey === k ? 'page' : undefined"
          @click="selectedLetter = k.toLowerCase()"
        >
          {{ k }}
        </button>
      </nav>

      <ul v-if="!currentKey" class="browse-summary">
        <li v-for="k in keys" :key="k" @click="selectedLetter = k.toLowerCase()">
          <a :href="`?tab=browse&letter=${k.toLowerCase()}`" @click.prevent="selectedLetter = k.toLowerCase()">
            <strong>{{ k }}</strong>
          </a>
          <span class="muted">{{ (groups.get(k)?.length || 0).toLocaleString('en-GB') }}</span>
        </li>
      </ul>

      <div v-else class="bgs-card" style="overflow-x: auto;">
        <table class="simple-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Code</th>
              <th scope="col">Rank</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in currentList" :key="u.code">
              <td>
                <a :href="`?tab=lexicon&unit=${encodeURIComponent(u.code)}`" @click.prevent="emit('openUnit', u.code)">
                  {{ u.name }}
                </a>
              </td>
              <td><code>{{ u.notation }}</code></td>
              <td>{{ u.rank }}</td>
              <td>
                <span v-if="u.deprecated" class="pill pill-obsolete">Obsolete</span>
                <span v-else class="pill pill-current">Current</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

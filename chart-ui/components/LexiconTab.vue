<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouteQuery } from '@vueuse/router'
import {
  bgsPidHref,
  downloadCsv,
  fmtMa,
  useBgsVocabs,
  wildcardMatcher,
  type LexiconRow,
  type LexiconUnitDetail,
} from '~/utils/bgsVocabs'

const emit = defineEmits<{
  (e: 'openRcs', code: string): void
  (e: 'openGeochron', divisionIri: string): void
  (e: 'openBrowse'): void
}>()

const {
  lexiconRows,
  lexiconByCode,
  geochronList,
  geochronByCode,
  rcsByCode,
  loadingLexicon,
  lexiconError,
  ensureLexiconLoaded,
  ensureRcsLoaded,
  ensureAboutLoaded,
  loadUnitDetail,
  getGeochronDescendants,
  vocabFileUrl,
} = useBgsVocabs()

// URL-mirrored filter and unit state
const selectedUnitCode = useRouteQuery<string>('unit', '')
const filterCode = useRouteQuery<string>('code', '')
const filterName = useRouteQuery<string>('q', '')
const filterRank = useRouteQuery<string>('rank', '')
const filterStatus = useRouteQuery<string>('status', '')
const filterAge = useRouteQuery<string>('age', '')
const filterMode = useRouteQuery<string>('mode', 'overlaps')
const filterLith = useRouteQuery<string>('lith', '')
const filterMap = useRouteQuery<string>('map', '')
const filterText = useRouteQuery<string>('text', '')

// Support legacy lex_list.cfm parameters (pub, desc)
const legacyPub = useRouteQuery<string>('pub', '')
const legacyDesc = useRouteQuery<string>('desc', '')

const sortField = ref<'notation' | 'name' | 'rank' | 'oldestMa' | 'mapCode' | 'status'>('name')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = 100

const activeUnit = ref<LexiconUnitDetail | null>(null)
const loadingUnit = ref(false)
const unitError = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([
    ensureLexiconLoaded(),
    ensureRcsLoaded().catch(() => {}),
    ensureAboutLoaded().catch(() => {}),
  ])
  applyLegacyParams()
  if (selectedUnitCode.value) {
    await fetchSelectedUnit(selectedUnitCode.value)
  }
})

function applyLegacyParams() {
  const clean = (v: string) => (v || '').trim() === '%' ? '' : (v || '').trim()
  const pub = clean(legacyPub.value)
  const desc = clean(legacyDesc.value)
  if (pub && !filterCode.value && !selectedUnitCode.value) {
    if (!/[%*]/.test(pub) && lexiconByCode.value.has(pub.toUpperCase())) {
      selectedUnitCode.value = pub.toUpperCase()
    } else {
      filterCode.value = pub.toUpperCase()
    }
  }
  if (desc && !filterName.value) {
    filterName.value = desc
  }
  // Resolve age if passed as a label (legacy DIC_GEOCHRON.TRANSLATION)
  const rawAge = clean(filterAge.value)
  if (rawAge && geochronList.value && !geochronByCode.value.has(rawAge)) {
    const want = rawAge.toLowerCase()
    const hit =
      geochronList.value.find(d => d.label.toLowerCase() === want) ||
      geochronList.value.find(
        d => d.label.toLowerCase().replace(/\s+(eon|era|period|sub-period|epoch|age|stage)$/, '') === want
      )
    if (hit) filterAge.value = hit.code
  }
}

async function fetchSelectedUnit(code: string) {
  if (!code) {
    activeUnit.value = null
    unitError.value = null
    return
  }
  loadingUnit.value = true
  unitError.value = null
  try {
    await ensureLexiconLoaded()
    const detail = await loadUnitDetail(code)
    if (!detail) {
      unitError.value = `No Lexicon unit found with code "${code}".`
      activeUnit.value = null
    } else {
      activeUnit.value = detail
    }
  } catch (e: any) {
    unitError.value = e?.message || String(e)
    activeUnit.value = null
  } finally {
    loadingUnit.value = false
  }
}

watch(selectedUnitCode, (code) => {
  fetchSelectedUnit(code)
})

const availableRanks = computed(() => {
  const set = new Set<string>()
  for (const r of lexiconRows.value || []) {
    if (r.rank) set.add(r.rank)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

const anyMapCode = computed(() =>
  (lexiconRows.value || []).some(r => Boolean(r.mapCode))
)

const filteredRows = computed<LexiconRow[]>(() => {
  const all = lexiconRows.value || []
  const codeMatch = wildcardMatcher(filterCode.value)
  const nameWords = String(filterName.value || '')
    .toLowerCase()
    .replace(/%/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const textWords = String(filterText.value || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const rankVal = filterRank.value
  const statusVal = filterStatus.value
  const ageCode = filterAge.value
  const mode = filterMode.value || 'overlaps'
  const lithVal = filterLith.value.trim().toUpperCase()
  const mapVal = filterMap.value.trim().toUpperCase()

  const dv = ageCode ? geochronByCode.value.get(ageCode) : undefined
  const descSet = ageCode ? getGeochronDescendants(ageCode) : null

  const filtered = all.filter((d) => {
    if (codeMatch && !codeMatch.test(d.notation.toUpperCase()) && !codeMatch.test(d.code.toUpperCase())) {
      return false
    }
    if (nameWords.length > 0 && !nameWords.every(w => d.searchName.includes(w))) {
      return false
    }
    if (textWords.length > 0 && !textWords.every(w => d.searchText.includes(w))) {
      return false
    }
    if (rankVal && d.rank !== rankVal) {
      return false
    }
    if (statusVal && d.status !== statusVal) {
      return false
    }
    if (ageCode) {
      if (mode === 'oldest' || !dv || dv.max == null || d.oldestMa == null) {
        if (mode === 'oldest') {
          if (!descSet?.has(d.oldest)) return false
        } else if (!descSet?.has(d.oldest) && !descSet?.has(d.youngest)) {
          return false
        }
      } else {
        const o = d.oldestMa
        const y = d.youngestMa != null ? d.youngestMa : o
        const eps = 1e-6
        if (mode === 'within') {
          if (!(y >= (dv.min ?? 0) - eps && o <= dv.max + eps)) return false
        } else {
          if (!(y <= dv.max + eps && o >= (dv.min ?? 0) - eps)) return false
        }
      }
    }
    if (lithVal && !d.lith.includes(` ${lithVal} `)) {
      return false
    }
    if (mapVal && mapVal !== '%' && d.mapCode.toUpperCase() !== mapVal) {
      return false
    }
    return true
  })

  const dir = sortDir.value === 'asc' ? 1 : -1
  const sf = sortField.value
  return [...filtered].sort((a, b) => {
    if (sf === 'oldestMa') {
      return ((a.oldestMa ?? -1) - (b.oldestMa ?? -1)) * dir
    }
    const av = String(a[sf] || '')
    const bv = String(b[sf] || '')
    return av.localeCompare(bv) * dir || a.code.localeCompare(b.code)
  })
})

watch(
  [filterCode, filterName, filterRank, filterStatus, filterAge, filterMode, filterLith, filterMap, filterText],
  () => {
    page.value = 1
  }
)

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)))
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredRows.value.slice(start, start + pageSize)
})

function toggleSort(field: typeof sortField.value) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
}

function clearFilters() {
  filterCode.value = ''
  filterName.value = ''
  filterRank.value = ''
  filterStatus.value = ''
  filterAge.value = ''
  filterMode.value = 'overlaps'
  filterLith.value = ''
  filterMap.value = ''
  filterText.value = ''
  legacyPub.value = ''
  legacyDesc.value = ''
  page.value = 1
}

function exportCsv() {
  const headers = ['Code', 'Name', 'Rank', 'Oldest Age', 'Youngest Age', 'Oldest Ma', 'Youngest Ma', 'Lithology', 'Map Code', 'Status']
  const rows = filteredRows.value.map((r) => [
    r.notation,
    r.name,
    r.rank,
    geochronByCode.value.get(r.oldest)?.label || r.oldest,
    geochronByCode.value.get(r.youngest)?.label || r.youngest,
    r.oldestMa,
    r.youngestMa,
    r.lithCodes.join(' '),
    r.mapCode,
    r.status,
  ])
  downloadCsv('bgs-lexicon-units.csv', headers, rows)
}

function selectUnit(code: string) {
  selectedUnitCode.value = code
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleFilterLithFromUnit(code: string) {
  selectedUnitCode.value = ''
  filterLith.value = code
}

function handleFilterAgeFromUnit(code: string) {
  selectedUnitCode.value = ''
  filterAge.value = code
  filterMode.value = 'overlaps'
}
</script>

<template>
  <div class="bgs-view bgs-wrap">
    <div v-if="lexiconError" class="bgs-card notice">
      Could not load the Lexicon data: {{ lexiconError }}
    </div>

    <template v-else-if="selectedUnitCode">
      <div v-if="loadingUnit" class="bgs-card">
        <p class="muted" style="margin: 0;">Loading unit {{ selectedUnitCode }}…</p>
      </div>
      <div v-else-if="unitError" class="bgs-card">
        <p class="notice">{{ unitError }}</p>
        <button type="button" class="btn btn-ghost" @click="selectedUnitCode = ''">
          ← Back to Lexicon search
        </button>
      </div>
      <LexiconUnitView
        v-else-if="activeUnit"
        :unit="activeUnit"
        :units-by-code="lexiconByCode"
        :geochron-by-code="geochronByCode"
        :rcs-by-code="rcsByCode"
        @back="selectedUnitCode = ''"
        @select-unit="selectUnit"
        @filter-lith="handleFilterLithFromUnit"
        @filter-age="handleFilterAgeFromUnit"
        @open-rcs="c => emit('openRcs', c)"
        @open-geochron="iri => emit('openGeochron', iri)"
      />
    </template>

    <template v-else>
      <header class="page-head">
        <h1>Lexicon of Named Rock Units</h1>
        <p class="lede">
          BGS definitions of the rock units that appear on BGS maps and in BGS publications.
          Type in the column headers to filter, or combine with age, rock type and description search below.
        </p>
        <p class="muted small" style="margin-top: 6px; margin-bottom: 0;">
          Source vocabulary:
          <a :href="bgsPidHref('http://data.bgs.ac.uk/ref/Lexicon/NamedRockUnit')" target="_blank" rel="noreferrer">http://data.bgs.ac.uk/ref/Lexicon/NamedRockUnit</a>
          · Bulk files:
          <a :href="vocabFileUrl('NamedRockUnit.ttl')" target="_blank" rel="noreferrer">NamedRockUnit.ttl</a>,
          <a :href="vocabFileUrl('NamedRockUnit.csv')" target="_blank" rel="noreferrer">NamedRockUnit.csv</a>
        </p>
      </header>

      <section class="bgs-card controls" aria-label="Filters">
        <div class="control">
          <label for="f-age">Age</label>
          <select id="f-age" v-model="filterAge">
            <option value="">Any age</option>
            <option v-for="d in geochronList || []" :key="d.code" :value="d.code">
              {{ '\u2003'.repeat(Math.min(d.depth, 6)) + d.label + (d.max != null ? ` (${d.max}${d.min != null ? '–' + d.min : ''} Ma)` : '') }}
            </option>
          </select>
        </div>
        <div class="control">
          <label for="f-mode">Match</label>
          <select id="f-mode" v-model="filterMode">
            <option value="overlaps">Unit overlaps this age</option>
            <option value="within">Unit lies entirely within it</option>
            <option value="oldest">Unit's oldest age is in it</option>
          </select>
        </div>
        <div class="control">
          <label for="f-lith">Rock type (RCS code)</label>
          <input
            id="f-lith"
            v-model="filterLith"
            type="text"
            autocomplete="off"
            placeholder="e.g. MDST, TR, BA"
            spellcheck="false"
          />
        </div>
        <div class="control">
          <label for="f-text">Description / full text</label>
          <input
            id="f-text"
            v-model="filterText"
            type="search"
            autocomplete="off"
            placeholder="e.g. red mudstone"
          />
        </div>
        <div class="control">
          <label for="f-map">Preferred map code</label>
          <input
            id="f-map"
            v-model="filterMap"
            type="text"
            autocomplete="off"
            placeholder="e.g. MMG, EILD"
            spellcheck="false"
          />
        </div>
        <div class="control control-actions">
          <button type="button" class="btn btn-ghost" @click="clearFilters">Clear all filters</button>
          <button type="button" class="btn" title="Export currently filtered table rows as CSV" @click="exportCsv">Export table CSV</button>
          <a
            class="btn btn-ghost"
            :href="vocabFileUrl('NamedRockUnit.csv')"
            target="_blank"
            rel="noreferrer"
            title="Download full NamedRockUnit.csv from BGS vocabularies repository"
          >Vocabulary CSV</a>
        </div>

        <p v-if="filterLith.trim() || (filterMap.trim() && !anyMapCode)" class="control-wide muted small">
          <template v-if="filterLith.trim()">
            Showing units containing RCS code
            <a href="#rcs" @click.prevent="emit('openRcs', filterLith.trim().toUpperCase())">
              <strong>{{ filterLith.trim().toUpperCase() }}</strong>
              <template v-if="rcsByCode.get(filterLith.trim().toUpperCase())">
                ({{ rcsByCode.get(filterLith.trim().toUpperCase())!.name }})
              </template>
            </a>.
          </template>
          <template v-if="filterMap.trim() && !anyMapCode">
            Preferred map codes are not in the vocabulary export yet, so the map-code filter cannot match anything.
          </template>
        </p>
      </section>

      <div class="result-bar">
        <p class="result-count" aria-live="polite">
          <template v-if="loadingLexicon">Loading units…</template>
          <template v-else>
            {{ filteredRows.length.toLocaleString('en-GB') }} of {{ (lexiconRows?.length || 0).toLocaleString('en-GB') }} units
          </template>
        </p>
        <p class="muted small" style="margin: 0;">
          Prefer to browse?
          <a href="#browse" @click.prevent="emit('openBrowse')">All units A–Z</a>
        </p>
      </div>

      <div class="data-table-wrap">
        <div class="data-table-scroll">
          <table class="bgs-data-table">
            <thead>
              <tr>
                <th style="width: 130px;">
                  <div class="th-sort" @click="toggleSort('notation')">
                    <span>Code</span>
                    <span v-if="sortField === 'notation'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </div>
                  <div class="th-filter">
                    <input v-model="filterCode" type="text" placeholder="e.g. MMG or M%" aria-label="Filter by code" />
                  </div>
                </th>
                <th style="min-width: 220px;">
                  <div class="th-sort" @click="toggleSort('name')">
                    <span>Name</span>
                    <span v-if="sortField === 'name'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </div>
                  <div class="th-filter">
                    <input v-model="filterName" type="text" placeholder="Name or former name" aria-label="Filter by name" />
                  </div>
                </th>
                <th style="width: 170px;">
                  <div class="th-sort" @click="toggleSort('rank')">
                    <span>Rank</span>
                    <span v-if="sortField === 'rank'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </div>
                  <div class="th-filter">
                    <select v-model="filterRank" aria-label="Filter by rank">
                      <option value="">Any</option>
                      <option v-for="r in availableRanks" :key="r" :value="r">{{ r }}</option>
                    </select>
                  </div>
                </th>
                <th style="min-width: 210px;">
                  <div class="th-sort" @click="toggleSort('oldestMa')">
                    <span>Age</span>
                    <span v-if="sortField === 'oldestMa'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </div>
                </th>
                <th style="width: 120px; text-align: right;">
                  <div class="th-sort" style="justify-content: flex-end;" @click="toggleSort('oldestMa')">
                    <span>Ma</span>
                    <span v-if="sortField === 'oldestMa'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </div>
                </th>
                <th v-if="anyMapCode" style="width: 120px;">
                  <div class="th-sort" @click="toggleSort('mapCode')">
                    <span>Map code</span>
                    <span v-if="sortField === 'mapCode'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </div>
                </th>
                <th style="width: 130px;">
                  <div class="th-sort" @click="toggleSort('status')">
                    <span>Status</span>
                    <span v-if="sortField === 'status'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </div>
                  <div class="th-filter">
                    <select v-model="filterStatus" aria-label="Filter by status">
                      <option value="">All</option>
                      <option value="Current">Current</option>
                      <option value="Obsolete">Obsolete</option>
                    </select>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!loadingLexicon && pagedRows.length === 0">
                <td :colspan="anyMapCode ? 7 : 6" class="muted" style="text-align: center; padding: 24px;">
                  No units match these filters.
                </td>
              </tr>
              <tr v-for="row in pagedRows" :key="row.code" @click="selectUnit(row.code)">
                <td>
                  <a :href="`?tab=lexicon&unit=${encodeURIComponent(row.code)}`" @click.prevent="selectUnit(row.code)">
                    <code>{{ row.notation }}</code>
                  </a>
                </td>
                <td>
                  <a :href="`?tab=lexicon&unit=${encodeURIComponent(row.code)}`" @click.prevent="selectUnit(row.code)">
                    {{ row.name }}
                  </a>
                </td>
                <td>{{ row.rank }}</td>
                <td>
                  <template v-if="row.oldest">
                    <span>{{ geochronByCode.get(row.oldest)?.label || row.oldest }}</span>
                    <template v-if="row.youngest && row.youngest !== row.oldest">
                      <span class="muted"> to </span>
                      <span>{{ geochronByCode.get(row.youngest)?.label || row.youngest }}</span>
                    </template>
                  </template>
                  <span v-else class="muted">Not entered</span>
                </td>
                <td class="num">
                  <template v-if="row.oldestMa != null">
                    {{ row.youngestMa != null && row.youngestMa !== row.oldestMa ? `${fmtMa(row.oldestMa)}–${fmtMa(row.youngestMa)}` : fmtMa(row.oldestMa) }}
                  </template>
                </td>
                <td v-if="anyMapCode">
                  <code v-if="row.mapCode">{{ row.mapCode }}</code>
                </td>
                <td>
                  <span v-if="row.deprecated" class="pill pill-obsolete">Obsolete</span>
                  <span v-else class="pill pill-current">Current</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="totalPages > 1" class="table-pager">
          <span>Page {{ page }} of {{ totalPages.toLocaleString('en-GB') }}</span>
          <div class="pager-btns">
            <button type="button" class="btn btn-ghost" :disabled="page <= 1" @click="page = 1">First</button>
            <button type="button" class="btn btn-ghost" :disabled="page <= 1" @click="page--">Previous</button>
            <button type="button" class="btn btn-ghost" :disabled="page >= totalPages" @click="page++">Next</button>
            <button type="button" class="btn btn-ghost" :disabled="page >= totalPages" @click="page = totalPages">Last</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

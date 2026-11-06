<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouteQuery } from '@vueuse/router'
import { downloadCsv, useBgsVocabs, type RcsRow } from '~/utils/bgsVocabs'

const emit = defineEmits<{
  (e: 'openLexiconLith', code: string): void
}>()

const {
  rcsRows,
  rcsByCode,
  loadingRcs,
  rcsError,
  ensureRcsLoaded,
} = useBgsVocabs()

const selectedCode = useRouteQuery<string>('rcsCode', '')
const legacyCode = useRouteQuery<string>('code', '')
const filterAny = useRouteQuery<string>('rcsQ', '')
const includeObsolete = useRouteQuery<string>('obsolete', '')

const filterColCode = useRouteQuery<string>('f_code', '')
const filterColName = useRouteQuery<string>('f_name', '')
const filterColParent = useRouteQuery<string>('f_parentName', '')
const filterColType = useRouteQuery<string>('f_type', '')
const filterColDef = useRouteQuery<string>('f_definition', '')

// Legacy search_rcs.cfm parameters
const legacyRcsDesc = useRouteQuery<string>('rcs_desc', '')
const legacyRcsCode = useRouteQuery<string>('rcs_code', '')

const sortField = ref<'code' | 'name' | 'parentName' | 'type' | 'units' | 'definition' | 'status'>('name')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)
const pageSize = 100
const detailEl = ref<HTMLElement | null>(null)

const showObsolete = computed({
  get: () => includeObsolete.value === '1',
  set: (v: boolean) => { includeObsolete.value = v ? '1' : '' },
})

onMounted(async () => {
  await ensureRcsLoaded()
  const clean = (v: string) => (v || '').trim() === '%' ? '' : (v || '').trim()
  if (clean(legacyRcsDesc.value) && !filterColName.value) {
    filterColName.value = clean(legacyRcsDesc.value)
  }
  if (clean(legacyRcsCode.value) && !filterColCode.value) {
    filterColCode.value = clean(legacyRcsCode.value)
  }
  const initCode = (selectedCode.value || legacyCode.value || '').trim().toUpperCase()
  if (initCode) {
    selectCode(initCode)
  }
})

watch(legacyCode, (val) => {
  const c = (val || '').trim().toUpperCase()
  if (c && rcsByCode.value.has(c)) {
    selectCode(c)
  }
})

function selectCode(code: string) {
  const c = code.trim().toUpperCase()
  const row = rcsByCode.value.get(c)
  if (row) {
    if (row.deprecated && !showObsolete.value) {
      showObsolete.value = true
    }
    selectedCode.value = c
  } else if (c) {
    filterColCode.value = c
  }
}

const selectedRow = computed<RcsRow | null>(() => {
  const c = (selectedCode.value || '').trim().toUpperCase()
  return c ? rcsByCode.value.get(c) || null : null
})

const selectedChildren = computed(() => {
  if (!selectedRow.value) return []
  return selectedRow.value.children
    .filter(c => rcsByCode.value.has(c))
    .sort((a, b) => (rcsByCode.value.get(a)?.name || a).localeCompare(rcsByCode.value.get(b)?.name || b))
})

const filteredRows = computed<RcsRow[]>(() => {
  const all = rcsRows.value || []
  const qWords = String(filterAny.value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const cCode = String(filterColCode.value || '').toLowerCase().replace(/%/g, '').trim()
  const cName = String(filterColName.value || '').toLowerCase().replace(/%/g, '').trim()
  const cParent = String(filterColParent.value || '').toLowerCase().replace(/%/g, '').trim()
  const cType = String(filterColType.value || '').trim()
  const cDef = String(filterColDef.value || '').toLowerCase().replace(/%/g, '').trim()
  const obs = showObsolete.value

  const filtered = all.filter((d) => {
    if (!obs && d.deprecated) return false
    if (qWords.length > 0 && !qWords.every(w => d.search.includes(w))) return false
    if (cCode && !d.code.toLowerCase().includes(cCode)) return false
    if (cName && !d.name.toLowerCase().includes(cName)) return false
    if (cParent && !d.parentName.toLowerCase().includes(cParent)) return false
    if (cType && d.type !== cType) return false
    if (cDef && !d.definition.toLowerCase().includes(cDef)) return false
    return true
  })

  const dir = sortDir.value === 'asc' ? 1 : -1
  const sf = sortField.value
  return [...filtered].sort((a, b) => {
    if (sf === 'units') {
      return (a.units - b.units) * dir || a.name.localeCompare(b.name)
    }
    const av = String(a[sf] || '')
    const bv = String(b[sf] || '')
    return av.localeCompare(bv) * dir || a.code.localeCompare(b.code)
  })
})

watch(
  [filterAny, includeObsolete, filterColCode, filterColName, filterColParent, filterColType, filterColDef],
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
    sortDir.value = field === 'units' ? 'desc' : 'asc'
  }
}

function clearFilters() {
  filterAny.value = ''
  showObsolete.value = false
  filterColCode.value = ''
  filterColName.value = ''
  filterColParent.value = ''
  filterColType.value = ''
  filterColDef.value = ''
  legacyRcsDesc.value = ''
  legacyRcsCode.value = ''
  page.value = 1
}

function exportCsv() {
  const headers = ['Code', 'Name', 'Parent', 'Type', 'Lexicon Units', 'Definition', 'Index Form', 'Status']
  const rows = filteredRows.value.map((r) => [
    r.code,
    r.name,
    r.parentName,
    r.type,
    r.units,
    r.definition,
    r.indexName,
    r.status,
  ])
  downloadCsv('bgs-rcs.csv', headers, rows)
}

function handleRowClick(row: RcsRow) {
  selectCode(row.code)
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1040px)').matches) {
    detailEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <div class="bgs-view bgs-wrap">
    <header class="page-head">
      <h1>BGS Rock Classification Scheme</h1>
      <p class="lede">
        The approved names and codes BGS uses for rocks and sediments at the scale of an exposure,
        hand specimen or thin section. Type in the column headers to filter, and select a row for its full definition.
      </p>
    </header>

    <div v-if="rcsError" class="bgs-card notice">
      Could not load the RCS data: {{ rcsError }}
    </div>

    <div v-else class="rcs-layout">
      <div>
        <section class="bgs-card controls" aria-label="Filters">
          <div class="control control-grow">
            <label for="rcs-f-any">Search code, name or definition</label>
            <input
              id="rcs-f-any"
              v-model="filterAny"
              type="search"
              autocomplete="off"
              placeholder="e.g. trachyte, albite"
            />
          </div>
          <div class="control control-check">
            <label>
              <input v-model="showObsolete" type="checkbox" />
              Include obsolete codes
            </label>
          </div>
          <div class="control control-actions">
            <button type="button" class="btn btn-ghost" @click="clearFilters">Clear</button>
            <button type="button" class="btn" @click="exportCsv">Download CSV</button>
          </div>
        </section>

        <div class="result-bar">
          <p class="result-count" aria-live="polite">
            <template v-if="loadingRcs">Loading rock types…</template>
            <template v-else>
              {{ filteredRows.length.toLocaleString('en-GB') }} of {{ (rcsRows?.length || 0).toLocaleString('en-GB') }} rock types
            </template>
          </p>
        </div>

        <div class="data-table-wrap">
          <div class="data-table-scroll">
            <table class="bgs-data-table">
              <thead>
                <tr>
                  <th style="width: 105px;">
                    <div class="th-sort" @click="toggleSort('code')">
                      <span>Code</span>
                      <span v-if="sortField === 'code'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                    </div>
                    <div class="th-filter">
                      <input v-model="filterColCode" type="text" placeholder="e.g. MDST" aria-label="Filter by code" />
                    </div>
                  </th>
                  <th style="min-width: 170px;">
                    <div class="th-sort" @click="toggleSort('name')">
                      <span>Name</span>
                      <span v-if="sortField === 'name'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                    </div>
                    <div class="th-filter">
                      <input v-model="filterColName" type="text" placeholder="e.g. sandstone" aria-label="Filter by name" />
                    </div>
                  </th>
                  <th style="min-width: 130px;">
                    <div class="th-sort" @click="toggleSort('parentName')">
                      <span>Parent</span>
                      <span v-if="sortField === 'parentName'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                    </div>
                    <div class="th-filter">
                      <input v-model="filterColParent" type="text" placeholder="Filter" aria-label="Filter by parent" />
                    </div>
                  </th>
                  <th style="width: 120px;">
                    <div class="th-sort" @click="toggleSort('type')">
                      <span>Type</span>
                      <span v-if="sortField === 'type'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                    </div>
                    <div class="th-filter">
                      <select v-model="filterColType" aria-label="Filter by type">
                        <option value="">All</option>
                        <option value="Rock name">Rock name</option>
                        <option value="Composite">Composite</option>
                        <option value="Dummy">Dummy</option>
                      </select>
                    </div>
                  </th>
                  <th style="width: 82px; text-align: right;" title="Number of Lexicon units containing this rock type">
                    <div class="th-sort" style="justify-content: flex-end;" @click="toggleSort('units')">
                      <span>Units</span>
                      <span v-if="sortField === 'units'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                    </div>
                  </th>
                  <th style="min-width: 200px;">
                    <div class="th-sort" @click="toggleSort('definition')">
                      <span>Definition</span>
                      <span v-if="sortField === 'definition'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                    </div>
                    <div class="th-filter">
                      <input v-model="filterColDef" type="text" placeholder="Words in definition" aria-label="Filter by definition" />
                    </div>
                  </th>
                  <th v-if="showObsolete" style="width: 110px;">
                    <div class="th-sort" @click="toggleSort('status')">
                      <span>Status</span>
                      <span v-if="sortField === 'status'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!loadingRcs && pagedRows.length === 0">
                  <td :colspan="showObsolete ? 7 : 6" class="muted" style="text-align: center; padding: 24px;">
                    No rock types match these filters.
                  </td>
                </tr>
                <tr
                  v-for="row in pagedRows"
                  :key="row.code"
                  :class="{ 'is-selected': selectedRow?.code === row.code }"
                  @click="handleRowClick(row)"
                >
                  <td><code style="font-weight: 600;">{{ row.code }}</code></td>
                  <td>{{ row.name }}</td>
                  <td>{{ row.parentName }}</td>
                  <td>{{ row.type }}</td>
                  <td class="num" @click.stop>
                    <a
                      v-if="row.units > 0"
                      :href="`?tab=lexicon&lith=${encodeURIComponent(row.code)}`"
                      @click.prevent="emit('openLexiconLith', row.code)"
                    >
                      {{ row.units.toLocaleString('en-GB') }}
                    </a>
                    <span v-else class="muted">0</span>
                  </td>
                  <td :title="row.definition">
                    <template v-if="row.definition">
                      {{ row.definition.length > 140 ? row.definition.slice(0, 137) + '…' : row.definition }}
                    </template>
                    <span v-else class="muted">No definition</span>
                  </td>
                  <td v-if="showObsolete">
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
      </div>

      <aside ref="detailEl" class="side" aria-live="polite">
        <section v-if="selectedRow" class="bgs-card rcs-detail">
          <p class="eyebrow">
            {{ selectedRow.type }}
            <template v-if="selectedRow.deprecated">
              · <span class="pill pill-obsolete">Obsolete</span>
            </template>
          </p>
          <h2>{{ selectedRow.name }}</h2>
          <dl>
            <dt>Code</dt>
            <dd><code class="big">{{ selectedRow.code }}</code></dd>

            <template v-if="selectedRow.indexName">
              <dt>Index form</dt>
              <dd>{{ selectedRow.indexName }}</dd>
            </template>

            <dt>Definition</dt>
            <dd>
              <template v-if="selectedRow.definition">{{ selectedRow.definition }}</template>
              <span v-else class="muted">No definition currently exists.</span>
            </dd>

            <template v-if="selectedRow.qualifiers.length">
              <dt>Qualifiers</dt>
              <dd>{{ selectedRow.qualifiers.join(', ') }}</dd>
            </template>

            <template v-if="selectedRow.parents.length">
              <dt>Broader</dt>
              <dd>
                <div v-for="p in selectedRow.parents" :key="p">
                  <a href="#rcs" @click.prevent="selectCode(p)">
                    {{ rcsByCode.get(p)?.name || p }}
                  </a>
                  <code>{{ p }}</code>
                </div>
              </dd>
            </template>

            <template v-if="selectedChildren.length">
              <dt>Narrower ({{ selectedChildren.length }})</dt>
              <dd>
                <div v-for="c in selectedChildren.slice(0, 40)" :key="c">
                  <a href="#rcs" @click.prevent="selectCode(c)">
                    {{ rcsByCode.get(c)?.name || c }}
                  </a>
                  <code>{{ c }}</code>
                </div>
                <div v-if="selectedChildren.length > 40" class="muted">
                  …and {{ selectedChildren.length - 40 }} more
                </div>
              </dd>
            </template>

            <dt>Lexicon units</dt>
            <dd>
              <a
                v-if="selectedRow.units > 0"
                href="#lexicon"
                @click.prevent="emit('openLexiconLith', selectedRow.code)"
              >
                {{ selectedRow.units.toLocaleString('en-GB') }} units contain {{ selectedRow.name.toLowerCase() }}
              </a>
              <span v-else class="muted">None recorded</span>
            </dd>

            <dt>Linked data</dt>
            <dd>
              <a
                class="mono-link"
                :href="`http://data.bgs.ac.uk/id/EarthMaterialClass/RockClassAll/${encodeURIComponent(selectedRow.code)}`"
                target="_blank"
                rel="noreferrer"
              >
                data.bgs.ac.uk/id/EarthMaterialClass/RockClassAll/{{ selectedRow.code }}
              </a>
              <template v-if="selectedRow.sameAs">
                <br />
                <a class="mono-link" :href="selectedRow.sameAs" target="_blank" rel="noreferrer">
                  {{ selectedRow.sameAs.replace('http://', '') }}
                </a>
              </template>
            </dd>
          </dl>
        </section>
        <section v-else class="bgs-card">
          <p class="muted" style="margin: 0;">
            Select a rock type to see its definition, place in the classification and the Lexicon units it occurs in.
          </p>
        </section>
      </aside>
    </div>

    <details class="bgs-card caveat" style="margin-top: 16px;">
      <summary>About the definitions</summary>
      <p style="margin-bottom: 0;">
        "Thumbnail" definitions attached to some entries are an interim attempt to give short descriptions of the
        unqualified rock types in the scheme. Minor contradictions or omissions may be present; feedback is welcome via
        the <a href="https://www.bgs.ac.uk/technologies/bgs-rock-classification-scheme/" target="_blank" rel="noreferrer">RCS page</a>.
      </p>
    </details>
  </div>
</template>

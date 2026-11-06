import { ref, shallowRef } from 'vue'

export interface GeochronDivision {
  code: string
  iri: string
  label: string
  rank: string
  depth: number
  min: number | null
  max: number | null
  color: string | null
  parent: string | null
}

export interface LexiconRow {
  code: string
  notation: string
  name: string
  rank: string
  oldest: string
  youngest: string
  oldestMa: number | null
  youngestMa: number | null
  status: 'Current' | 'Obsolete'
  deprecated: boolean
  lith: string
  lithCodes: string[]
  mapCode: string
  names: string
  text: string
  searchName: string
  searchText: string
}

export interface LexiconNestedItem {
  type: string | null
  text: string
}

export interface LexiconUnitDetail {
  code: string
  iri: string
  notation: string
  name: string
  obsoleteNote: string | null
  deprecated: boolean
  definition: string
  rank: string | null
  rankLabel: string | null
  oldest: string | null
  youngest: string | null
  oldestMa: number | null
  youngestMa: number | null
  predominantAge: string | null
  periods: string[]
  lithology: string[]
  lithDesc: string
  lower: string
  upper: string
  thickness: string
  geoLimits: string
  mapCode: string
  mapSheets: string[]
  definitionStatus: string | null
  formality: string | null
  parents: string[]
  chain: string[]
  children: string[]
  altNames: string[]
  obsoleteAltNames: string[]
  previous: string[]
  replacedBy: string[]
  lateral: string[]
  typeLocalities: LexiconNestedItem[]
  references: LexiconNestedItem[]
}

export interface RcsRow {
  code: string
  name: string
  type: string
  status: 'Current' | 'Obsolete'
  deprecated: boolean
  parents: string[]
  parentName: string
  children: string[]
  definition: string
  units: number
  qualifiers: string[]
  sameAs: string
  indexName: string
  search: string
}

export interface CoverageField {
  field: string
  expected: 'present' | 'partial' | 'missing'
  all: number
  current: number
}

export interface CoverageSection {
  total: number
  current: number
  fields: CoverageField[]
}

export interface CoverageReport {
  lexicon: CoverageSection
  rcs: CoverageSection
}

export interface BuildMetadata {
  builtAt: string
  source: string
  lexiconVersion: string | null
  lexiconFingerprint: string | null
  units: number
  rcs: number
  vocabularies: Record<string, {
    version?: string
    title?: string
    concepts?: string
    triples?: string
    fingerprint?: string
  }>
}

export function unitBucketKey(code = ''): string {
  const first = (String(code).replace(/^[^A-Za-z0-9]+/, '')[0] || '').toLowerCase()
  return /[a-z]/.test(first) ? first : '0-9'
}

export function fmtMa(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ''
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(3))
}

/** Split database prose into paragraphs and lines (safe for rendering without raw HTML). */
export function splitProse(text: string | null | undefined): string[][] {
  if (!text) return []
  return String(text)
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .map(p => p.split('\n').map(l => l.trim()).filter(Boolean))
    .filter(p => p.length > 0)
}

/** "%" and "*" act as wildcards, as in the legacy Lexicon form; otherwise "contains". */
export function wildcardMatcher(v: string): { test: (x: string) => boolean } | null {
  const s = String(v || '').trim().toUpperCase()
  if (!s || s === '%') return null
  if (/[%*]/.test(s)) {
    const rx = new RegExp('^' + s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$')
    return { test: (x: string) => rx.test(x) }
  }
  return { test: (x: string) => x.includes(s) }
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const escCell = (val: string | number | null | undefined) => {
    const s = val == null ? '' : String(val)
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const lines = [
    headers.map(escCell).join(','),
    ...rows.map(r => r.map(escCell).join(',')),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Cached singletons across tab switches
const lexiconRowsCache = shallowRef<LexiconRow[] | null>(null)
const lexiconByCodeCache = shallowRef<Map<string, LexiconRow>>(new Map())
const geochronListCache = shallowRef<GeochronDivision[] | null>(null)
const geochronByCodeCache = shallowRef<Map<string, GeochronDivision>>(new Map())
const geochronDescendantsCache = new Map<string, Set<string>>()
const unitBucketsCache = new Map<string, Record<string, LexiconUnitDetail>>()
const rcsRowsCache = shallowRef<RcsRow[] | null>(null)
const rcsByCodeCache = shallowRef<Map<string, RcsRow>>(new Map())
const coverageCache = shallowRef<CoverageReport | null>(null)
const buildMetaCache = shallowRef<BuildMetadata | null>(null)
const chartReportCache = shallowRef<Record<string, any> | null>(null)

let lexiconLoadPromise: Promise<void> | null = null
let rcsLoadPromise: Promise<void> | null = null
let aboutLoadPromise: Promise<void> | null = null

export function useBgsVocabs() {
  const base = useRuntimeConfig().app.baseURL || '/'
  const loadingLexicon = ref(false)
  const lexiconError = ref<string | null>(null)
  const loadingRcs = ref(false)
  const rcsError = ref<string | null>(null)
  const loadingAbout = ref(false)
  const aboutError = ref<string | null>(null)

  async function ensureLexiconLoaded() {
    if (lexiconRowsCache.value && geochronListCache.value) return
    if (lexiconLoadPromise) return lexiconLoadPromise

    loadingLexicon.value = true
    lexiconError.value = null
    lexiconLoadPromise = (async () => {
      try {
        const [indexRes, geoRes] = await Promise.all([
          fetch(`${base}data/lexicon-index.json`),
          fetch(`${base}data/geochronology.json`),
        ])
        if (!indexRes.ok) throw new Error(`HTTP ${indexRes.status} loading lexicon-index.json`)
        if (!geoRes.ok) throw new Error(`HTTP ${geoRes.status} loading geochronology.json`)

        const indexJson: { cols: string[], rows: any[][] } = await indexRes.json()
        const geoJson: GeochronDivision[] = await geoRes.json()

        const geoMap = new Map<string, GeochronDivision>()
        for (const d of geoJson) {
          geoMap.set(d.code, d)
        }
        geochronListCache.value = geoJson
        geochronByCodeCache.value = geoMap
        geochronDescendantsCache.clear()

        const ix: Record<string, number> = {}
        indexJson.cols.forEach((c, i) => { ix[c] = i })

        const rows: LexiconRow[] = []
        const byCode = new Map<string, LexiconRow>()
        for (const r of indexJson.rows) {
          const code = String(r[ix.code] || '')
          const notation = String(r[ix.notation] || code)
          const name = String(r[ix.name] || code)
          const names = String(r[ix.names] || '')
          const text = ix.text != null ? String(r[ix.text] || '') : ''
          const lithRaw = String(r[ix.lith] || '').trim()
          const deprecated = Boolean(r[ix.obsolete])
          const row: LexiconRow = {
            code,
            notation,
            name,
            rank: String(r[ix.rank] || ''),
            oldest: String(r[ix.oldest] || ''),
            youngest: String(r[ix.youngest] || ''),
            oldestMa: r[ix.oldestMa] != null ? Number(r[ix.oldestMa]) : null,
            youngestMa: r[ix.youngestMa] != null ? Number(r[ix.youngestMa]) : null,
            status: deprecated ? 'Obsolete' : 'Current',
            deprecated,
            lith: ` ${lithRaw} `,
            lithCodes: lithRaw ? lithRaw.split(/\s+/).filter(Boolean) : [],
            mapCode: String(r[ix.mapCode] || ''),
            names,
            text,
            searchName: `${name} | ${names}`.toLowerCase(),
            searchText: `${name} | ${names} | ${text}`.toLowerCase(),
          }
          rows.push(row)
          byCode.set(code, row)
        }
        lexiconRowsCache.value = rows
        lexiconByCodeCache.value = byCode
      } catch (e: any) {
        lexiconError.value = e?.message || String(e)
        lexiconLoadPromise = null
        throw e
      } finally {
        loadingLexicon.value = false
      }
    })()
    return lexiconLoadPromise
  }

  function getGeochronDescendants(code: string): Set<string> {
    const cached = geochronDescendantsCache.get(code)
    if (cached) return cached
    const list = geochronListCache.value || []
    const kids = new Map<string, string[]>()
    for (const d of list) {
      if (d.parent) {
        const arr = kids.get(d.parent) || []
        arr.push(d.code)
        kids.set(d.parent, arr)
      }
    }
    const set = new Set<string>()
    const stack = [code]
    while (stack.length > 0) {
      const c = stack.pop()!
      if (set.has(c)) continue
      set.add(c)
      for (const k of kids.get(c) || []) stack.push(k)
    }
    geochronDescendantsCache.set(code, set)
    return set
  }

  async function loadUnitDetail(code: string): Promise<LexiconUnitDetail | null> {
    if (!code) return null
    const key = unitBucketKey(code)
    if (!unitBucketsCache.has(key)) {
      const res = await fetch(`${base}data/units/${key}.json`)
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`HTTP ${res.status} loading units/${key}.json`)
      }
      const map: Record<string, LexiconUnitDetail> = await res.json()
      unitBucketsCache.set(key, map)
    }
    const bucket = unitBucketsCache.get(key)!
    if (bucket[code]) return bucket[code]
    const upper = code.toUpperCase()
    if (bucket[upper]) return bucket[upper]
    const found = Object.values(bucket).find(
      u => u.code.toUpperCase() === upper || u.notation.toUpperCase() === upper
    )
    return found || null
  }

  async function ensureRcsLoaded() {
    if (rcsRowsCache.value) return
    if (rcsLoadPromise) return rcsLoadPromise

    loadingRcs.value = true
    rcsError.value = null
    rcsLoadPromise = (async () => {
      try {
        const res = await fetch(`${base}data/rcs.json`)
        if (!res.ok) throw new Error(`HTTP ${res.status} loading rcs.json`)
        const json: { cols: string[], rows: any[][] } = await res.json()
        const ix: Record<string, number> = {}
        json.cols.forEach((c, i) => { ix[c] = i })

        const byCode = new Map<string, RcsRow>()
        const rows: RcsRow[] = json.rows.map((r) => {
          const code = String(r[ix.code] || '')
          const name = String(r[ix.name] || code)
          const deprecated = Boolean(r[ix.obsolete])
          const parents = r[ix.parents] ? String(r[ix.parents]).split(' ').filter(Boolean) : []
          const children = r[ix.children] ? String(r[ix.children]).split(' ').filter(Boolean) : []
          const definition = String(r[ix.definition] || '')
          const indexName = String(r[ix.indexName] || '')
          const row: RcsRow = {
            code,
            name,
            type: String(r[ix.type] || 'Rock name'),
            status: deprecated ? 'Obsolete' : 'Current',
            deprecated,
            parents,
            parentName: '',
            children,
            definition,
            units: Number(r[ix.units] || 0),
            qualifiers: r[ix.qualifiers] ? String(r[ix.qualifiers]).split(' | ').filter(Boolean) : [],
            sameAs: String(r[ix.sameAs] || ''),
            indexName,
            search: '',
          }
          byCode.set(code, row)
          return row
        })

        for (const d of rows) {
          d.parentName = d.parents.map(p => byCode.get(p)?.name || p).join('; ')
          d.search = `${d.code} ${d.name} ${d.indexName} ${d.definition}`.toLowerCase()
        }

        rcsRowsCache.value = rows
        rcsByCodeCache.value = byCode
      } catch (e: any) {
        rcsError.value = e?.message || String(e)
        rcsLoadPromise = null
        throw e
      } finally {
        loadingRcs.value = false
      }
    })()
    return rcsLoadPromise
  }

  async function ensureAboutLoaded() {
    if (coverageCache.value && buildMetaCache.value) return
    if (aboutLoadPromise) return aboutLoadPromise

    loadingAbout.value = true
    aboutError.value = null
    aboutLoadPromise = (async () => {
      try {
        const [covRes, buildRes, chartRes] = await Promise.all([
          fetch(`${base}data/coverage.json`),
          fetch(`${base}data/build.json`),
          fetch(`${base}data/bgs-chart-report.json`).catch(() => null),
        ])
        if (!covRes.ok) throw new Error(`HTTP ${covRes.status} loading coverage.json`)
        if (!buildRes.ok) throw new Error(`HTTP ${buildRes.status} loading build.json`)
        coverageCache.value = await covRes.json()
        buildMetaCache.value = await buildRes.json()
        if (chartRes && chartRes.ok) {
          chartReportCache.value = await chartRes.json()
        }
      } catch (e: any) {
        aboutError.value = e?.message || String(e)
        aboutLoadPromise = null
        throw e
      } finally {
        loadingAbout.value = false
      }
    })()
    return aboutLoadPromise
  }

  return {
    lexiconRows: lexiconRowsCache,
    lexiconByCode: lexiconByCodeCache,
    geochronList: geochronListCache,
    geochronByCode: geochronByCodeCache,
    rcsRows: rcsRowsCache,
    rcsByCode: rcsByCodeCache,
    coverage: coverageCache,
    buildMeta: buildMetaCache,
    chartReport: chartReportCache,
    loadingLexicon,
    lexiconError,
    loadingRcs,
    rcsError,
    loadingAbout,
    aboutError,
    ensureLexiconLoaded,
    ensureRcsLoaded,
    ensureAboutLoaded,
    loadUnitDetail,
    getGeochronDescendants,
  }
}

<script setup lang="ts">
import { onMounted } from 'vue'
import { useBgsVocabs, type CoverageSection } from '~/utils/bgsVocabs'

const base = useRuntimeConfig().app.baseURL || '/'

const {
  coverage,
  buildMeta,
  chartReport,
  loadingAbout,
  aboutError,
  ensureAboutLoaded,
  vocabFileUrl,
} = useBgsVocabs()

onMounted(async () => {
  await ensureAboutLoaded()
})

function pct(n: number, d: number): string {
  return d ? `${Math.round((100 * n) / d)}%` : '–'
}
</script>

<template>
  <div class="bgs-view bgs-wrap">
    <header class="page-head">
      <h1>About the data</h1>
      <p class="lede">
        This site is generated from the BGS vocabulary files (Turtle), which are exported from the BGS corporate
        databases. Nothing on it queries a database at request time.
      </p>
    </header>

    <div v-if="aboutError" class="bgs-card notice">
      Could not load coverage metadata: {{ aboutError }}
    </div>
    <div v-else-if="loadingAbout && !coverage" class="bgs-card">
      <p class="muted" style="margin: 0;">Loading data coverage report…</p>
    </div>

    <template v-else-if="coverage">
      <section class="bgs-card">
        <h2>Data coverage: Lexicon of Named Rock Units</h2>
        <p class="muted">
          How many entries have each field in the current vocabulary export. Fields marked "Not in export" are held in
          the database and shown by the legacy Lexicon application, but are not yet published in the linked data. Each
          unit view shows them automatically once they are added to the export.
        </p>
        <div style="overflow-x: auto;">
          <table class="simple-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Export status</th>
                <th scope="col" class="num">Current entries</th>
                <th scope="col" class="num">All entries</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in coverage.lexicon.fields" :key="f.field">
                <td>{{ f.field }}</td>
                <td>
                  <span v-if="f.expected === 'present'" class="pill pill-current">In export</span>
                  <span v-else-if="f.expected === 'partial'" class="pill pill-partial">Partial</span>
                  <span v-else class="pill pill-obsolete">Not in export</span>
                </td>
                <td class="num">
                  {{ f.current.toLocaleString('en-GB') }}
                  <span class="muted">({{ pct(f.current, coverage.lexicon.current) }})</span>
                </td>
                <td class="num">{{ f.all.toLocaleString('en-GB') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="bgs-card">
        <h2>Data coverage: Rock Classification Scheme</h2>
        <div style="overflow-x: auto;">
          <table class="simple-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Export status</th>
                <th scope="col" class="num">Current entries</th>
                <th scope="col" class="num">All entries</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in coverage.rcs.fields" :key="f.field">
                <td>{{ f.field }}</td>
                <td>
                  <span v-if="f.expected === 'present'" class="pill pill-current">In export</span>
                  <span v-else-if="f.expected === 'partial'" class="pill pill-partial">Partial</span>
                  <span v-else class="pill pill-obsolete">Not in export</span>
                </td>
                <td class="num">
                  {{ f.current.toLocaleString('en-GB') }}
                  <span class="muted">({{ pct(f.current, coverage.rcs.current) }})</span>
                </td>
                <td class="num">{{ f.all.toLocaleString('en-GB') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="chartReport?.summary" class="bgs-card">
        <h2>Geochronological Chart join &amp; fallback summary</h2>
        <p class="muted">
          Each ICS unit is joined to a BGS Geochronology division through CGI <code>skos:exactMatch</code> (or by label
          when the CGI link is missing). Full details are in
          <a :href="`${base}data/bgs-chart-report.json`" target="_blank" rel="noreferrer">bgs-chart-report.json</a>.
        </p>
        <div style="overflow-x: auto;">
          <table class="simple-table">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col" class="num">Count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ICS units in chart structure</td>
                <td class="num">{{ chartReport.summary.ics_units }}</td>
              </tr>
              <tr>
                <td>Joined to BGS by CGI <code>skos:exactMatch</code></td>
                <td class="num">{{ chartReport.summary.matched_cgi }}</td>
              </tr>
              <tr>
                <td>Joined to BGS by label fallback</td>
                <td class="num">{{ chartReport.summary.matched_label }}</td>
              </tr>
              <tr>
                <td>Filled entirely from ICS</td>
                <td class="num">{{ chartReport.summary.ics_fallbacks }}</td>
              </tr>
              <tr>
                <td>ICS colour fallback used</td>
                <td class="num">{{ chartReport.summary.colour_fallbacks }}</td>
              </tr>
              <tr>
                <td>Units whose BGS numeric ages differ from ICS</td>
                <td class="num">{{ chartReport.summary.age_differences }}</td>
              </tr>
              <tr>
                <td>Marine Isotope Stages with inferred young boundary</td>
                <td class="num">{{ chartReport.summary.mis_inferred }}</td>
              </tr>
              <tr v-for="(count, colId) in chartReport.summary.regional_units || {}" :key="colId">
                <td>Regional column: <code>{{ colId }}</code></td>
                <td class="num">{{ count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="buildMeta" class="bgs-card">
        <h2>Source files</h2>
        <div style="overflow-x: auto;">
          <table class="simple-table">
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Downloads</th>
                <th scope="col">Title</th>
                <th scope="col">Export version</th>
                <th scope="col" class="num">Concepts</th>
                <th scope="col" class="num">Triples</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, file) in buildMeta.vocabularies || {}" :key="file">
                <td><code>{{ file }}</code></td>
                <td>
                  <a :href="vocabFileUrl(String(file))" target="_blank" rel="noreferrer">TTL</a>
                  ·
                  <a :href="vocabFileUrl(String(file).replace(/\.ttl$/i, '.csv'))" target="_blank" rel="noreferrer">CSV</a>
                </td>
                <td>{{ m.title || '' }}</td>
                <td>{{ m.version || 'unknown' }}</td>
                <td class="num">{{ m.concepts || '' }}</td>
                <td class="num">{{ m.triples || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted small" style="margin-top: 8px; margin-bottom: 0;">
          Built {{ buildMeta.builtAt }} from <code>{{ buildMeta.source }}</code>.
          Machine-readable coverage: <a :href="`${base}data/coverage.json`" target="_blank" rel="noreferrer">coverage.json</a>.
        </p>
      </section>

      <section class="bgs-card">
        <h2>Reusing the data</h2>
        <ul style="margin-bottom: 0;">
          <li>
            Every chronostratigraphic division, rock unit and rock type has a permanent linked-data identifier under
            <a href="https://data.bgs.ac.uk/" target="_blank" rel="noreferrer">data.bgs.ac.uk</a>.
          </li>
          <li>
            Bulk downloads (N-Triples, Turtle, CSV) are in the
            <a href="https://github.com/BritishGeologicalSurvey/vocabularies" target="_blank" rel="noreferrer">BGS vocabularies repository</a>.
          </li>
          <li>
            Generated data files served by this site:
            <a :href="`${base}data/bgs-chart.ttl`" target="_blank" rel="noreferrer">bgs-chart.ttl</a>,
            <a :href="`${base}data/bgs-chart-report.json`" target="_blank" rel="noreferrer">bgs-chart-report.json</a>,
            <a :href="`${base}data/lexicon-index.json`" target="_blank" rel="noreferrer">lexicon-index.json</a>,
            <a :href="`${base}data/rcs.json`" target="_blank" rel="noreferrer">rcs.json</a>,
            <a :href="`${base}data/geochronology.json`" target="_blank" rel="noreferrer">geochronology.json</a>,
            <a :href="`${base}data/coverage.json`" target="_blank" rel="noreferrer">coverage.json</a>.
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

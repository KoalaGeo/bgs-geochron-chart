<script setup lang="ts">
import { computed } from 'vue'
import {
  fmtMa,
  splitProse,
  type GeochronDivision,
  type LexiconRow,
  type LexiconUnitDetail,
  type RcsRow,
} from '~/utils/bgsVocabs'

const props = defineProps<{
  unit: LexiconUnitDetail
  unitsByCode: Map<string, LexiconRow>
  geochronByCode: Map<string, GeochronDivision>
  rcsByCode: Map<string, RcsRow>
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'selectUnit', code: string): void
  (e: 'filterLith', code: string): void
  (e: 'filterAge', code: string): void
  (e: 'openRcs', code: string): void
  (e: 'openGeochron', divisionIri: string): void
}>()

function getUnitMeta(code: string) {
  return props.unitsByCode.get(code)
}

function getDivision(code: string | null): GeochronDivision | undefined {
  if (!code) return undefined
  return props.geochronByCode.get(code)
}

function getRcs(code: string): RcsRow | undefined {
  return props.rcsByCode.get(code)
}

const sameAge = computed(() => !props.unit.youngest || props.unit.youngest === props.unit.oldest)

const maRangeText = computed(() => {
  const { oldestMa, youngestMa } = props.unit
  if (oldestMa == null) return ''
  if (youngestMa != null && youngestMa !== oldestMa) {
    return `${fmtMa(oldestMa)}–${fmtMa(youngestMa)} Ma`
  }
  return `${fmtMa(oldestMa)} Ma`
})

const ageSubtitle = computed(() => {
  const parts: string[] = []
  if (maRangeText.value) parts.push(maRangeText.value)
  if (props.unit.periods?.length) parts.push(props.unit.periods.join(' to '))
  return parts.join(' · ')
})

const unlinkedPrevious = computed(() => {
  const prevNames = new Set(
    props.unit.previous
      .map(c => getUnitMeta(c)?.name?.toLowerCase())
      .filter(Boolean) as string[]
  )
  return [...new Set(props.unit.obsoleteAltNames)].filter(
    n => !prevNames.has(n.toLowerCase())
  )
})

const hasOtherNames = computed(() =>
  props.unit.altNames.length > 0 ||
  props.unit.previous.length > 0 ||
  unlinkedPrevious.value.length > 0
)

const earthwiseUrl = computed(() =>
  `https://earthwise.bgs.ac.uk/index.php?search=${encodeURIComponent(`"${props.unit.name}"`)}`
)

function openAgeOnChart(code: string | null) {
  if (!code) return
  const div = getDivision(code)
  const iri = div?.iri || `http://data.bgs.ac.uk/id/Geochronology/Division/${code}`
  emit('openGeochron', iri)
}
</script>

<template>
  <div class="bgs-unit-view">
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="#lexicon" @click.prevent="emit('back')">← Lexicon search</a>
      <template v-for="c in unit.chain" :key="c">
        <span class="sep" aria-hidden="true">›</span>
        <a href="#unit" @click.prevent="emit('selectUnit', c)">
          {{ getUnitMeta(c)?.name || c }}
        </a>
      </template>
      <span class="sep" aria-hidden="true">›</span>
      <span aria-current="page">{{ unit.name }}</span>
    </nav>

    <div class="unit-layout">
      <article class="unit">
        <header class="unit-head">
          <p class="eyebrow">{{ unit.rankLabel || 'Named rock unit' }}</p>
          <h1>{{ unit.name }}</h1>
          <p v-if="unit.definition" class="lede">{{ unit.definition }}</p>
        </header>

        <div v-if="unit.deprecated || unit.replacedBy.length" class="notice" role="note">
          <strong>Obsolete name.</strong>
          <template v-if="unit.replacedBy.length">
            Use
            <template v-for="(c, idx) in unit.replacedBy" :key="c">
              <template v-if="idx > 0">, </template>
              <a href="#unit" @click.prevent="emit('selectUnit', c)">
                {{ getUnitMeta(c)?.name || c }}
              </a>
              <code>{{ getUnitMeta(c)?.notation || c }}</code>
            </template>
            instead.
          </template>
          <template v-else-if="unit.obsoleteNote">
            {{ unit.obsoleteNote }}
          </template>
        </div>

        <section class="bgs-card facts" aria-label="Summary">
          <dl class="facts-grid">
            <div class="fact">
              <dt>Computer code</dt>
              <dd><code class="big">{{ unit.notation }}</code></dd>
            </div>
            <div v-if="unit.mapCode" class="fact">
              <dt>Preferred map code</dt>
              <dd><code class="big">{{ unit.mapCode }}</code></dd>
            </div>
            <div v-if="unit.rankLabel" class="fact">
              <dt>Rank</dt>
              <dd>{{ unit.rankLabel }}</dd>
            </div>
            <div class="fact">
              <dt>Status</dt>
              <dd>
                <span v-if="unit.deprecated" class="pill pill-obsolete">Obsolete</span>
                <span v-else class="pill pill-current">Current</span>
                <span v-if="unit.definitionStatus" class="muted"> · {{ unit.definitionStatus }}</span>
              </dd>
            </div>
            <div v-if="unit.parents.length" class="fact">
              <dt>Parent unit</dt>
              <dd>
                <div v-for="p in unit.parents" :key="p">
                  <a href="#unit" @click.prevent="emit('selectUnit', p)">
                    {{ getUnitMeta(p)?.name || p }}
                  </a>
                  <code>{{ getUnitMeta(p)?.notation || p }}</code>
                  <span v-if="getUnitMeta(p)?.deprecated" class="pill pill-obsolete">Obsolete</span>
                </div>
              </dd>
            </div>
            <div v-if="unit.oldest" class="fact fact-wide">
              <dt>{{ sameAge ? 'Age' : 'Age range' }}</dt>
              <dd>
                <div class="age-row">
                  <button
                    type="button"
                    class="age-chip"
                    :title="`View ${getDivision(unit.oldest)?.label || unit.oldest} on the Geochronological Chart`"
                    @click="openAgeOnChart(unit.oldest)"
                  >
                    <span
                      v-if="getDivision(unit.oldest)?.color"
                      class="swatch"
                      :style="{ '--sw': getDivision(unit.oldest)!.color! }"
                    ></span>
                    <span>{{ getDivision(unit.oldest)?.label || unit.oldest }}</span>
                    <code>{{ unit.oldest }}</code>
                  </button>
                  <template v-if="!sameAge && unit.youngest">
                    <span class="age-to" aria-label="to">→</span>
                    <button
                      type="button"
                      class="age-chip"
                      :title="`View ${getDivision(unit.youngest)?.label || unit.youngest} on the Geochronological Chart`"
                      @click="openAgeOnChart(unit.youngest)"
                    >
                      <span
                        v-if="getDivision(unit.youngest)?.color"
                        class="swatch"
                        :style="{ '--sw': getDivision(unit.youngest)!.color! }"
                      ></span>
                      <span>{{ getDivision(unit.youngest)?.label || unit.youngest }}</span>
                      <code>{{ unit.youngest }}</code>
                    </button>
                  </template>
                </div>
                <p v-if="ageSubtitle" class="muted small" style="margin-top: 6px; margin-bottom: 0;">
                  {{ ageSubtitle }}
                </p>
              </dd>
            </div>
          </dl>
        </section>

        <section v-if="unit.lithDesc || unit.lithology.length" class="bgs-card" aria-labelledby="sec-lithology">
          <h2 id="sec-lithology">Lithology</h2>
          <div v-if="unit.lithDesc" class="prose">
            <p v-for="(para, pIdx) in splitProse(unit.lithDesc)" :key="pIdx">
              <template v-for="(line, lIdx) in para" :key="lIdx">
                <br v-if="lIdx > 0" />{{ line }}
              </template>
            </p>
          </div>
          <template v-if="unit.lithology.length">
            <p class="label">Rock types (BGS Rock Classification Scheme)</p>
            <div class="chips">
              <button
                v-for="c in unit.lithology"
                :key="c"
                type="button"
                class="chip"
                :title="`${getRcs(c)?.name || c} in the Rock Classification Scheme`"
                @click="emit('openRcs', c)"
              >
                <span>{{ getRcs(c)?.name || c }}</span>
                <code>{{ c }}</code>
              </button>
            </div>
            <p class="small muted chips-note">
              Find other units with
              <template v-for="(c, idx) in unit.lithology" :key="c">
                <template v-if="idx > 0">, </template>
                <a href="#lith" @click.prevent="emit('filterLith', c)">
                  {{ (getRcs(c)?.name || c).toLowerCase() }}
                </a>
              </template>.
            </p>
          </template>
        </section>

        <section v-if="unit.lower || unit.upper" class="bgs-card" aria-labelledby="sec-boundaries">
          <h2 id="sec-boundaries">Boundaries</h2>
          <div class="two-col">
            <div>
              <h3>Lower boundary</h3>
              <div v-if="unit.lower" class="prose">
                <p v-for="(para, pIdx) in splitProse(unit.lower)" :key="pIdx">
                  <template v-for="(line, lIdx) in para" :key="lIdx">
                    <br v-if="lIdx > 0" />{{ line }}
                  </template>
                </p>
              </div>
              <p v-else class="muted">None recorded</p>
            </div>
            <div>
              <h3>Upper boundary</h3>
              <div v-if="unit.upper" class="prose">
                <p v-for="(para, pIdx) in splitProse(unit.upper)" :key="pIdx">
                  <template v-for="(line, lIdx) in para" :key="lIdx">
                    <br v-if="lIdx > 0" />{{ line }}
                  </template>
                </p>
              </div>
              <p v-else class="muted">None recorded</p>
            </div>
          </div>
        </section>

        <section v-if="unit.thickness" class="bgs-card" aria-labelledby="sec-thickness">
          <h2 id="sec-thickness">Thickness</h2>
          <div class="prose">
            <p v-for="(para, pIdx) in splitProse(unit.thickness)" :key="pIdx">
              <template v-for="(line, lIdx) in para" :key="lIdx">
                <br v-if="lIdx > 0" />{{ line }}
              </template>
            </p>
          </div>
        </section>

        <section v-if="unit.geoLimits" class="bgs-card" aria-labelledby="sec-extent">
          <h2 id="sec-extent">Geographical limits</h2>
          <div class="prose">
            <p v-for="(para, pIdx) in splitProse(unit.geoLimits)" :key="pIdx">
              <template v-for="(line, lIdx) in para" :key="lIdx">
                <br v-if="lIdx > 0" />{{ line }}
              </template>
            </p>
          </div>
        </section>

        <section v-if="unit.typeLocalities.length" class="bgs-card" aria-labelledby="sec-stratotypes">
          <h2 id="sec-stratotypes">Stratotypes</h2>
          <dl class="kv">
            <template v-for="(t, idx) in unit.typeLocalities" :key="idx">
              <dt>{{ t.type || 'Type locality' }}</dt>
              <dd>
                <template v-if="t.text">
                  <p v-for="(para, pIdx) in splitProse(t.text)" :key="pIdx">
                    <template v-for="(line, lIdx) in para" :key="lIdx">
                      <br v-if="lIdx > 0" />{{ line }}
                    </template>
                  </p>
                </template>
                <span v-else class="muted">No description</span>
              </dd>
            </template>
          </dl>
        </section>

        <section v-if="unit.children.length" class="bgs-card" aria-labelledby="sec-children">
          <h2 id="sec-children">
            Subdivisions <span class="count">{{ unit.children.length }}</span>
          </h2>
          <ul class="link-list cols">
            <li v-for="c in unit.children" :key="c">
              <a href="#unit" @click.prevent="emit('selectUnit', c)">
                {{ getUnitMeta(c)?.name || c }}
              </a>
              <code>{{ getUnitMeta(c)?.notation || c }}</code>
              <span v-if="getUnitMeta(c)?.rank" class="muted"> · {{ getUnitMeta(c)?.rank }}</span>
              <span v-if="getUnitMeta(c)?.deprecated" class="pill pill-obsolete">Obsolete</span>
            </li>
          </ul>
        </section>

        <section v-if="hasOtherNames" class="bgs-card" aria-labelledby="sec-names">
          <h2 id="sec-names">Other names</h2>
          <template v-if="unit.altNames.length">
            <h3>Alternative names</h3>
            <ul class="plain">
              <li v-for="n in unit.altNames" :key="n">{{ n }}</li>
            </ul>
          </template>
          <template v-if="unit.previous.length || unlinkedPrevious.length">
            <h3>Previous names</h3>
            <ul class="plain">
              <li v-for="c in unit.previous" :key="c">
                <a href="#unit" @click.prevent="emit('selectUnit', c)">
                  {{ getUnitMeta(c)?.name || c }}
                </a>
                <code>{{ getUnitMeta(c)?.notation || c }}</code>
                <span v-if="getUnitMeta(c)?.deprecated" class="pill pill-obsolete">Obsolete</span>
              </li>
              <li v-for="n in unlinkedPrevious" :key="n">{{ n }}</li>
            </ul>
          </template>
        </section>

        <section v-if="unit.lateral.length" class="bgs-card" aria-labelledby="sec-lateral">
          <h2 id="sec-lateral">Lateral equivalents</h2>
          <ul class="link-list">
            <li v-for="c in unit.lateral" :key="c">
              <a href="#unit" @click.prevent="emit('selectUnit', c)">
                {{ getUnitMeta(c)?.name || c }}
              </a>
              <code>{{ getUnitMeta(c)?.notation || c }}</code>
              <span v-if="getUnitMeta(c)?.rank" class="muted"> · {{ getUnitMeta(c)?.rank }}</span>
            </li>
          </ul>
        </section>

        <section v-if="unit.references.length" class="bgs-card" aria-labelledby="sec-references">
          <h2 id="sec-references">References</h2>
          <ol class="refs">
            <li v-for="(r, idx) in unit.references" :key="idx">
              {{ r.text }}
              <span v-if="r.type" class="muted small">({{ r.type }})</span>
            </li>
          </ol>
        </section>

        <section v-if="unit.mapSheets.length" class="bgs-card" aria-labelledby="sec-sheets">
          <h2 id="sec-sheets">1:50 000 map sheets</h2>
          <p class="muted small">Sheets on which this unit is shown.</p>
          <div class="chips">
            <a
              v-for="s in unit.mapSheets"
              :key="s"
              class="chip"
              :href="`https://shop.bgs.ac.uk/Shop/search/mapSheet/${encodeURIComponent(s)}`"
              target="_blank"
              rel="noreferrer"
            >
              {{ s }}
            </a>
          </div>
        </section>
      </article>

      <aside class="side">
        <section class="bgs-card">
          <h2 class="h-small">Linked data</h2>
          <p>
            <a class="mono-link" :href="unit.iri" target="_blank" rel="noreferrer">
              {{ unit.iri.replace('http://', '') }}
            </a>
          </p>
          <p class="muted small" style="margin-bottom: 0;">
            The permanent identifier for this unit. Request it with <code>Accept: text/turtle</code> for RDF.
          </p>
        </section>
        <section class="bgs-card">
          <h2 class="h-small">Elsewhere</h2>
          <ul class="plain" style="margin-bottom: 0;">
            <li>
              <a :href="earthwiseUrl" target="_blank" rel="noreferrer">Search BGS Earthwise</a>
            </li>
            <li v-if="unit.oldest">
              <a href="#chart" @click.prevent="openAgeOnChart(unit.oldest)">
                View {{ getDivision(unit.oldest)?.label || unit.oldest }} on Geochronological Chart
              </a>
            </li>
            <li v-if="unit.oldest">
              <a href="#age" @click.prevent="emit('filterAge', unit.oldest!)">
                Other Lexicon units of this age
              </a>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

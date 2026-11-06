<script setup lang="ts">
// Zoomed Quaternary view: ICS-structured epochs/ages beside the British and
// NW European regional stages and the Marine Isotope Stages. The main chart
// gives the whole Quaternary a few rows, which is far too small for ~100 MIS.
import { computed, ref } from "vue"
import type { chartNode, RegionalColumn, RegionalUnit } from "@/utils/util"
import { useLabelContext } from "@/utils/label"
import { assignLanes, unitFill, unitTitle, MIS_WARM, MIS_COLD } from "@/utils/regional"

const props = defineProps<{
    quaternary: chartNode
    columns: RegionalColumn[]
}>()
const emit = defineEmits<{ (e: 'view', node: string): void }>()
const { getLabel } = useLabelContext()

const HEIGHT = 1800
const LOG_OFFSET = 0.01 // Ma; keeps the Holocene readable on the log scale
const scale = ref<'log' | 'linear'>('log')

const ageOf = (t: chartNode['hasBeginning']) => typeof t.inMYA === 'number' ? t.inMYA : t.inMYA.value
const oldest = computed(() => ageOf(props.quaternary.hasBeginning))
const youngest = computed(() => ageOf(props.quaternary.hasEnd))

function y(age: number): number {
    const a = Math.min(Math.max(age, youngest.value), oldest.value)
    if (scale.value === 'linear') return HEIGHT * (a - youngest.value) / (oldest.value - youngest.value)
    const f = (v: number) => Math.log10(v - youngest.value + LOG_OFFSET)
    return HEIGHT * (f(a) - f(youngest.value)) / (f(oldest.value) - f(youngest.value))
}

type Box = { id: string, label: string, title: string, top: number, height: number, left: string, width: string, fill: string, inferred?: boolean, fallback?: boolean }

function chartBoxes(nodes: chartNode[]): Box[] {
    return nodes.map(n => {
        const top = y(ageOf(n.hasEnd)), bottom = y(ageOf(n.hasBeginning))
        const label = getLabel(n.id)
        return { id: n.id, label, title: `${label}: ${ageOf(n.hasBeginning)}–${ageOf(n.hasEnd)} Ma`,
                 top, height: bottom - top, left: '0%', width: '100%', fill: n.color, fallback: !!n.fallback }
    })
}

const epochs = computed(() => props.quaternary.narrower ?? [])
const ages = computed(() => epochs.value.flatMap(e => e.narrower ?? [e]))

const columnsInRange = computed(() => props.columns
    .map(col => {
        const units = col.units.filter(u => u.begin > youngest.value && u.end < oldest.value)
        const boxes: Box[] = assignLanes(units).map(({ unit, lane, lanes }) => {
            const top = y(unit.end), bottom = y(unit.begin)
            return { id: unit.id, label: (unit as RegionalUnit).shortLabel, title: unitTitle(unit as RegionalUnit),
                     top, height: Math.max(1, bottom - top), left: `${(100 / lanes) * lane}%`, width: `${100 / lanes}%`,
                     fill: unitFill(unit as RegionalUnit, col.scheme), inferred: (unit as RegionalUnit).inferred }
        })
        return { col, boxes }
    })
    .filter(c => c.boxes.length))

const ticks = computed(() => {
    const set = new Set<number>([youngest.value, oldest.value])
    for (const a of ages.value) { set.add(ageOf(a.hasBeginning)); set.add(ageOf(a.hasEnd)) }
    return [...set].sort((a, b) => a - b).map(a => ({ age: a, top: y(a) }))
})
</script>

<template>
    <section class="quaternary">
        <header class="q-head">
            <h2>Quaternary detail</h2>
            <label class="no-print">Scale:
                <select v-model="scale">
                    <option value="log">Logarithmic</option>
                    <option value="linear">Linear</option>
                </select>
            </label>
            <span class="legend">
                <span class="swatch" :style="{ background: MIS_WARM }"></span> MIS warm (odd)
                <span class="swatch" :style="{ background: MIS_COLD }"></span> MIS cold (even)
                <span class="swatch inferred"></span> dashed: MIS range inferred, or ICS value used
            </span>
        </header>
        <div class="q-grid">
            <div class="q-col">
                <div class="q-colhead">Epoch</div>
                <div class="q-body" :style="{ height: `${HEIGHT}px` }">
                    <div v-for="b in chartBoxes(epochs)" :key="b.id" class="q-box" :class="{ fallback: b.fallback }"
                        :style="{ top: `${b.top}px`, height: `${b.height}px`, background: b.fill }" :title="b.title" @click="emit('view', b.id)">
                        <span class="q-label">{{ b.label }}</span>
                    </div>
                </div>
            </div>
            <div class="q-col wide">
                <div class="q-colhead">Age</div>
                <div class="q-body" :style="{ height: `${HEIGHT}px` }">
                    <div v-for="b in chartBoxes(ages)" :key="b.id" class="q-box" :class="{ fallback: b.fallback }"
                        :style="{ top: `${b.top}px`, height: `${b.height}px`, background: b.fill }" :title="b.title" @click="emit('view', b.id)">
                        <span v-if="b.height >= 11" class="q-label">{{ b.label }}</span>
                    </div>
                </div>
            </div>
            <div v-for="{ col, boxes } in columnsInRange" :key="col.id" class="q-col"
                :class="{ wide: col.scheme === 'mis' || col.id.endsWith('-stage') }">
                <div class="q-colhead">{{ col.schemeLabel }}<br v-if="col.scheme !== 'mis'" />{{ col.scheme !== 'mis' ? col.label.toLowerCase() : '' }}</div>
                <div class="q-body" :style="{ height: `${HEIGHT}px` }">
                    <div v-for="b in boxes" :key="b.id" class="q-box" :class="{ inferred: b.inferred }"
                        :style="{ top: `${b.top}px`, height: `${b.height}px`, left: b.left, width: b.width, background: b.fill }"
                        :title="b.title" @click="emit('view', b.id)">
                        <span v-if="b.height >= 11" class="q-label">{{ b.label }}</span>
                    </div>
                </div>
            </div>
            <div class="q-col axis">
                <div class="q-colhead">Ma</div>
                <div class="q-body" :style="{ height: `${HEIGHT}px` }">
                    <span v-for="t in ticks" :key="t.age" class="tick" :style="{ top: `${t.top}px` }">{{ t.age }}</span>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.quaternary {
    margin-top: 3rem;
}
.q-head {
    display: flex;
    align-items: baseline;
    gap: 1.5rem;
    flex-wrap: wrap;
}
.q-head h2 {
    margin: 0;
    font-weight: 500;
}
.legend {
    font-size: 0.8rem;
}
.swatch {
    display: inline-block;
    width: 0.9rem;
    height: 0.9rem;
    vertical-align: middle;
    outline: black solid 1px;
    margin: 0 0.25rem 0 0.75rem;
}
.swatch.inferred {
    outline-style: dashed;
    background: #F2F2F2;
}
.q-grid {
    display: flex;
    margin-top: 1rem;
}
.q-col {
    flex: 1 1 0;
    min-width: 2.5rem;
}
.q-col.wide {
    flex: 2 1 0;
}
.q-col.axis {
    flex: 0 0 4.5rem;
}
.q-colhead {
    font-size: 0.8rem;
    height: 2.4rem;
    padding-left: 4px;
    line-height: 1.1;
}
.q-body {
    position: relative;
}
.q-box {
    position: absolute;
    left: 0;
    width: 100%;
    outline: black solid 1px;
    overflow: hidden;
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
}
.q-box.inferred,
.q-box.fallback {
    outline-style: dashed;
}
.q-label {
    display: block;
    padding: 0.12rem 0.18rem 0;
}
.tick {
    position: absolute;
    left: 0.3rem;
    transform: translateY(-50%);
    font-size: 0.75rem;
    white-space: nowrap;
}
.tick::before {
    content: "";
    position: absolute;
    left: -0.3rem;
    top: 50%;
    width: 0.25rem;
    border-top: 1px solid black;
}
</style>

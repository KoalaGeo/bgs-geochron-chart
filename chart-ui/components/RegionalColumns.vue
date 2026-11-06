<script setup lang="ts">
// BGS regional series/stages drawn beside a chart segment, aligned in time.
// Row heights depend on the selected scale, so rather than recomputing the
// layout this measures where each lowest-level ICS cell actually rendered
// (data-begin / data-end on the cell) and interpolates ages within it.
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from "vue"
import type { RegionalColumn, RegionalUnit } from "@/utils/util"
import { assignLanes, unitFill, unitTitle } from "@/utils/regional"

const props = defineProps<{
    columns: RegionalColumn[]
    anchor: HTMLElement | null
}>()
const emit = defineEmits<{ (e: 'view', node: string): void }>()

type Row = { top: number, bottom: number, begin: number, end: number }
const root = ref<HTMLElement | null>(null)
const rows = ref<Row[]>([])

function measure() {
    if (!root.value || !props.anchor) return
    const origin = root.value.getBoundingClientRect().top
    rows.value = Array.from(props.anchor.querySelectorAll<HTMLElement>('[data-leaf="1"]'))
        .map(el => {
            const r = el.getBoundingClientRect()
            return { top: r.top - origin, bottom: r.bottom - origin, begin: Number(el.dataset.begin), end: Number(el.dataset.end) }
        })
        .filter(r => Number.isFinite(r.begin) && Number.isFinite(r.end))
        .sort((a, b) => a.end - b.end)
}

const range = computed(() => rows.value.length
    ? { young: rows.value[0].end, old: rows.value[rows.value.length - 1].begin }
    : null)

function yOf(age: number): number {
    const rs = rows.value
    if (age <= rs[0].end) return rs[0].top
    for (const r of rs) {
        if (age <= r.begin) {
            const f = r.begin === r.end ? 0 : (age - r.end) / (r.begin - r.end)
            return r.top + f * (r.bottom - r.top)
        }
    }
    return rs[rs.length - 1].bottom
}

type Placed = { unit: RegionalUnit, top: number, height: number, left: string, width: string, clippedTop: boolean, clippedBottom: boolean }

const placed = computed(() => {
    const rg = range.value
    if (!rg) return [] as { col: RegionalColumn, boxes: Placed[] }[]
    return props.columns
        .map(col => {
            const inRange = col.units
                .filter(u => u.begin > rg.young && u.end < rg.old)
                .map(u => ({ ...u, b: Math.min(u.begin, rg.old), e: Math.max(u.end, rg.young) }))
            const boxes = assignLanes(inRange.map(u => ({ ...u, begin: u.b, end: u.e }))).map(({ unit, lane, lanes }) => {
                const top = yOf(unit.end)
                const bottom = yOf(unit.begin)
                const orig = col.units.find(x => x.id === unit.id)!
                return {
                    unit: orig, top, height: Math.max(1, bottom - top),
                    left: `${(100 / lanes) * lane}%`, width: `${100 / lanes}%`,
                    clippedTop: orig.end < rg.young, clippedBottom: orig.begin > rg.old,
                }
            })
            return { col, boxes }
        })
        .filter(c => c.boxes.length > 0)
})

const headerHeight = computed(() => rows.value[0]?.top ?? 0)
const totalHeight = computed(() => rows.value.length ? rows.value[rows.value.length - 1].bottom : 0)

let observer: ResizeObserver | null = null
const remeasure = () => requestAnimationFrame(() => measure())
onMounted(async () => {
    await nextTick()
    remeasure()
    observer = new ResizeObserver(remeasure)
    if (props.anchor) observer.observe(props.anchor)
})
watch(() => props.anchor, (el, old) => {
    if (old) observer?.unobserve(old)
    if (el) { observer?.observe(el); remeasure() }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
    <div ref="root" class="regional" :style="{ height: `${totalHeight}px` }" v-show="placed.length">
        <div v-for="{ col, boxes } in placed" :key="col.id" class="rcol">
            <div class="rhead" :style="{ height: `${headerHeight}px` }">
                <span class="rhead-text">{{ col.schemeLabel }} {{ col.label.toLowerCase() }}</span>
            </div>
            <div v-for="b in boxes" :key="b.unit.id" class="rbox" :class="{ inferred: b.unit.inferred }"
                :style="{ top: `${b.top}px`, height: `${b.height}px`, left: b.left, width: b.width, background: unitFill(b.unit, col.scheme) }"
                :title="unitTitle(b.unit)" @click="emit('view', b.unit.id)">
                <span v-if="b.height >= 11" class="rlabel">{{ b.unit.shortLabel }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.regional {
    display: flex;
    flex: none;
    margin-left: 0.4rem;
    position: relative;
}
.rcol {
    position: relative;
    width: 3.6rem;
    height: 100%;
}
.rhead {
    position: relative;
}
.rhead-text {
    position: absolute;
    left: 0.6rem;
    bottom: 0.5rem;
    transform: rotate(-45deg);
    transform-origin: 0 100%;
    white-space: nowrap;
    font-size: 0.8rem;
}
.rbox {
    position: absolute;
    outline: black solid 1px;
    overflow: hidden;
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
}
.rbox.inferred {
    outline-style: dashed;
}
.rlabel {
    display: block;
    padding: 0.12rem 0.18rem 0;
    overflow-wrap: anywhere;
}
</style>

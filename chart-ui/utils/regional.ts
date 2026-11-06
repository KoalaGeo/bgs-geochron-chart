import type { RegionalUnit } from './util'

// Fill for units BGS gives no colour (regional units mostly have none).
const SCHEME_FILL: Record<string, string> = {
  'uk': '#EFE8D8',
  'nw-europe': '#DDE7EF',
  'mis': '#F2F2F2',
}

// Conventional MIS shading: odd stages / a-c-e substages warm (interglacial),
// even stages / b-d substages cold (glacial). Presentation only - not in the
// BGS data.
export const MIS_WARM = '#F6C49A'
export const MIS_COLD = '#A9CCE8'

export function misFill(shortLabel: string): string {
  const m = shortLabel.trim().match(/^(\d+)([a-z]?)$/i)
  if (!m) return SCHEME_FILL.mis
  if (m[2]) {
    return (m[2].toLowerCase().charCodeAt(0) - 97) % 2 === 0 ? MIS_WARM : MIS_COLD
  }
  return Number(m[1]) % 2 === 1 ? MIS_WARM : MIS_COLD
}

export function unitFill(unit: RegionalUnit, scheme: string): string {
  if (scheme === 'mis') return misFill(unit.shortLabel)
  return unit.color || SCHEME_FILL[scheme] || '#F2F2F2'
}

export function unitTitle(unit: RegionalUnit): string {
  const note = unit.inferred ? ' (range inferred: BGS records a single age)' : ''
  return `${unit.label}: ${unit.begin}–${unit.end} Ma${note}`
}

/** Split overlapping units into side-by-side lanes (greedy, by start). */
export function assignLanes<T extends { begin: number, end: number }>(units: T[]): { unit: T, lane: number, lanes: number }[] {
  const sorted = [...units].sort((a, b) => a.end - b.end || b.begin - a.begin)
  const laneEnds: number[] = [] // youngest-first: track each lane's oldest age so far
  const placed = sorted.map(unit => {
    let lane = laneEnds.findIndex(oldest => unit.end >= oldest - 1e-9)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(unit.begin) } else { laneEnds[lane] = unit.begin }
    return { unit, lane, lanes: 0 }
  })
  const lanes = Math.max(1, laneEnds.length)
  return placed.map(p => ({ ...p, lanes }))
}

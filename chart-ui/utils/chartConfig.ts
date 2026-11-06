// Which chart this build shows. Set at build time with CHART_SOURCE=ics|bgs
// (see nuxt.config.ts). Everything that differs between the ICS chart and the
// BGS chart lives here; the layout itself is shared.

export type ChartSource = 'ics' | 'bgs'

export interface ChartConfig {
  source: ChartSource
  /** Concept scheme node holding the chart title/version (owl:versionInfo). */
  schemeIri: string
  /** Organisation named in the print header. */
  organisation: string
  /** ICS logos, ICS PDF downloads and the jsDelivr release lookup. */
  icsBranding: boolean
  /** BGS regional / MIS columns and the Quaternary panel. */
  regionalColumns: boolean
}

const CONFIGS: Record<ChartSource, ChartConfig> = {
  ics: {
    source: 'ics',
    schemeIri: 'https://data.stratigraphy.org/def/chart',
    organisation: 'International Commission on Stratigraphy',
    icsBranding: true,
    regionalColumns: false,
  },
  bgs: {
    source: 'bgs',
    schemeIri: 'http://data.bgs.ac.uk/ref/Geochronology/Division',
    organisation: 'British Geological Survey',
    icsBranding: false,
    regionalColumns: true,
  },
}

export function useChartConfig(): ChartConfig {
  const source = useRuntimeConfig().public.chartSource as ChartSource
  return CONFIGS[source] ?? CONFIGS.ics
}

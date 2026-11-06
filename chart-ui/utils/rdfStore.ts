import { ref, shallowRef } from 'vue'
import n3 from 'n3'
import clownface from 'clownface'
import type { AnyPointer } from 'clownface'

// Each data file becomes its own chunk; only the one for this build's
// CHART_SOURCE is fetched.
async function loadChartTtl(source: string): Promise<string> {
  if (source === 'bgs') {
    return (await import('../../bgs/build/bgs-chart.ttl?raw')).default
  }
  return (await import('../../chart.ttl?raw')).default
}

export function useRDFStore() {
  const store = shallowRef<n3.Store>(new n3.Store())
  const cf = shallowRef<AnyPointer | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const source = useChartConfig().source

  async function loadStore() {
    loading.value = true
    error.value = null
    const parser = new n3.Parser()

    try {
      const quads: n3.Quad[] = [
        ...parser.parse(await loadChartTtl(source)),
      ]

      const newStore = new n3.Store(quads)
      store.value = newStore
      cf.value = clownface({ dataset: newStore })
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      console.error('Error loading RDF store:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    store,
    cf,
    loading,
    error,
    loadStore
  }
}

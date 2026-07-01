import { create } from 'zustand'
import type { FactRow } from '@/shared/lib/api-types'
import { api } from '@/shared/lib/api'

interface DatasetState {
  facts: FactRow[]
  indicators: string[]
  subjects: string[]
  periods: string[]
  selectedIndicator: string
  loading: boolean
  error: string | null
  loadFacts: () => Promise<void>
  setSelectedIndicator: (indicator: string) => void
}

const uniq = (xs: string[]) => Array.from(new Set(xs))

export const useDatasetStore = create<DatasetState>((set, get) => ({
  facts: [],
  indicators: [],
  subjects: [],
  periods: [],
  selectedIndicator: 'Доход банка',
  loading: false,
  error: null,
  async loadFacts() {
    if (get().facts.length) return
    set({ loading: true, error: null })
    try {
      const facts = await api.getFacts()
      set({
        facts,
        indicators: uniq(facts.map((f) => f.indicator)),
        subjects: uniq(facts.map((f) => f.subject)),
        periods: uniq(facts.map((f) => f.period)).sort(),
        loading: false,
      })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Не удалось загрузить данные' })
    }
  },
  setSelectedIndicator: (indicator) => set({ selectedIndicator: indicator }),
}))

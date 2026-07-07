import { create } from 'zustand'
import type { FactRow } from '@/shared/lib/api-types'
import { api } from '@/shared/lib/api'
import { useGraphStore } from '@/domains/business-graph/store/useGraphStore'

interface DatasetState {
    facts: FactRow[]
    indicators: string[]
    subjects: string[]
    districts: string[]
    periods: string[]
    selectedIndicator: string
    loading: boolean
    error: string | null
    hasData: boolean
    loadFacts: () => Promise<void>
    setSelectedIndicator: (indicator: string) => void
    refresh: () => Promise<void>
    clear: () => void
}

const uniq = (xs: string[]) => Array.from(new Set(xs))

export const useDatasetStore = create<DatasetState>((set, get) => ({
    facts: [],
    indicators: [],
    subjects: [],
    districts: [],
    periods: [],
    selectedIndicator: 'Доход банка',
    loading: false,
    error: null,
    hasData: false,

    async loadFacts() {
        if (get().facts.length > 0 && !get().error) {
            return
        }
        await get().refresh()
    },

    async refresh() {
        set({ loading: true, error: null })
        try {
            const facts = await api.getFacts()
            const indicators = uniq(facts.map((f) => f.indicator))
            const subjects = uniq(facts.map((f) => f.subject))
            const districts = uniq(facts.map((f) => f.district)).filter(Boolean)
            const periods = uniq(facts.map((f) => f.period)).sort()

            set({
                facts,
                indicators,
                subjects,
                districts,
                periods,
                loading: false,
                hasData: facts.length > 0,
            })

            const current = get().selectedIndicator
            if (!indicators.includes(current) && indicators.length > 0) {
                set({ selectedIndicator: indicators[0] })
            }

            // НЕ строим и НЕ сохраняем граф автоматически
        } catch (e) {
            set({
                loading: false,
                error: e instanceof Error ? e.message : 'Не удалось загрузить данные',
                hasData: false,
            })
        }
    },

    clear() {
        set({
            facts: [],
            indicators: [],
            subjects: [],
            districts: [],
            periods: [],
            loading: false,
            error: null,
            hasData: false,
        })
        useGraphStore.getState().reset()
    },

    setSelectedIndicator: (indicator) => set({ selectedIndicator: indicator }),
}))
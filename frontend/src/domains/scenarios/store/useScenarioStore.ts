// src/domains/scenarios/store/useScenarioStore.ts
import { create } from 'zustand'
import { api } from '@/shared/lib/api'
import type { Scenario, ScenarioParams } from '@/shared/lib/api-types'

interface ScenarioState {
    scenarios: Scenario[]
    selectedIds: string[]
    loading: boolean
    error: string | null

    selectedScenarioId: string | null
    selectedRegion: string | null
    selectedModel: string | null
    visibleYears: number

    load: () => Promise<void>
    create: (params: ScenarioParams) => Promise<Scenario>
    deleteScenario: (id: string) => Promise<void>
    toggleSelect: (id: string) => void
    setSelectedScenario: (id: string) => void
    setRegion: (region: string | null) => void
    setModel: (model: string | null) => void
    setVisibleYears: (years: number) => void
    clear: () => void
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
    scenarios: [],
    selectedIds: [],
    loading: false,
    error: null,
    selectedScenarioId: null,
    selectedRegion: null,
    selectedModel: null,
    visibleYears: 0,

    load: async () => {
        set({ loading: true, error: null })
        try {
            const scenarios = await api.getScenarios()
            set({ scenarios, loading: false })
        } catch (e) {
            set({ loading: false, error: e instanceof Error ? e.message : 'Ошибка загрузки' })
        }
    },

    create: async (params) => {
        set({ loading: true, error: null })
        try {
            const scenario = await api.createScenario(params)
            set((s) => ({
                scenarios: [...s.scenarios, scenario],
                loading: false,
                selectedIds: [scenario.id],
                selectedScenarioId: scenario.id,
            }))
            return scenario
        } catch (e) {
            set({ loading: false, error: e instanceof Error ? e.message : 'Ошибка создания' })
            throw e
        }
    },

    deleteScenario: async (id) => {
        set({ loading: true, error: null })
        try {
            await api.deleteScenario(id)
            set((s) => ({
                scenarios: s.scenarios.filter(sc => sc.id !== id),
                selectedIds: s.selectedIds.filter(sid => sid !== id),
                loading: false,
            }))
        } catch (e) {
            set({ loading: false, error: e instanceof Error ? e.message : 'Ошибка удаления' })
        }
    },

    toggleSelect: (id) => {
        set({ selectedIds: [id] })
    },

    setSelectedScenario: (id) => set({ selectedScenarioId: id }),
    setRegion: (region) => set({ selectedRegion: region }),
    setModel: (model) => set({ selectedModel: model }),
    setVisibleYears: (years) => set({ visibleYears: years }),
    clear: () => set({ scenarios: [], selectedIds: [], loading: false, error: null }),
}))
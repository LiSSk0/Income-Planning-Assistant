// src/domains/ai-insights/store/useAnomalyStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/shared/lib/api'
import type { AnomalyCard } from '@/shared/lib/api-types'

interface AnomalyState {
    anomalies: AnomalyCard[]
    threshold: number
    loading: boolean
    hasCorrections: boolean
    isReplacing: boolean
    isRestoring: boolean
    error: string | null
    _lastSubject: string | undefined

    setThreshold: (value: number) => void
    calculate: (subject?: string) => Promise<void>
    replace: (subject?: string) => Promise<void>
    restore: () => Promise<void>
    checkStatus: () => Promise<void>
    clear: () => void
}

export const useAnomalyStore = create<AnomalyState>()(
    persist(
        (set, get) => ({
            anomalies: [],
            threshold: 2.5,
            loading: false,
            hasCorrections: false,
            isReplacing: false,
            isRestoring: false,
            error: null,
            _lastSubject: undefined,

            setThreshold: (value) => {
                set({ threshold: value })
            },

            calculate: async (subject) => {
                const { threshold, hasCorrections } = get()
                if (hasCorrections) {
                    set({ anomalies: [], loading: false, _lastSubject: subject })
                    return
                }
                set({ loading: true, error: null, _lastSubject: subject })
                try {
                    const data = await api.getAnomalies(subject, undefined, threshold)
                    set({ anomalies: data, loading: false })
                } catch (e) {
                    set({ loading: false, error: e instanceof Error ? e.message : 'Ошибка расчёта' })
                }
            },

            replace: async (subject) => {
                const { threshold } = get()
                set({ isReplacing: true, error: null })
                try {
                    await api.replaceAnomalies(subject, undefined, threshold)
                    set({
                        hasCorrections: true,
                        isReplacing: false,
                        anomalies: []
                    })
                } catch (e) {
                    set({ isReplacing: false, error: e instanceof Error ? e.message : 'Ошибка замены' })
                }
            },

            restore: async () => {
                set({ isRestoring: true, error: null })
                try {
                    await api.restoreAnomalies()
                    set({
                        hasCorrections: false,
                        isRestoring: false
                    })
                    const subject = get()._lastSubject || undefined
                    await get().calculate(subject)
                } catch (e) {
                    set({ isRestoring: false, error: e instanceof Error ? e.message : 'Ошибка восстановления' })
                }
            },

            checkStatus: async () => {
                try {
                    const status = await api.getAnomalyStatus()
                    set({ hasCorrections: status.active })
                    if (status.active) {
                        set({ anomalies: [] })
                    } else {
                        const subject = get()._lastSubject || undefined
                        if (subject !== undefined) {
                            await get().calculate(subject)
                        }
                    }
                } catch (e) {
                    console.error('Ошибка проверки статуса коррекций:', e)
                }
            },

            clear: () => {
                set({ anomalies: [], loading: false, error: null, hasCorrections: false })
            },
        }),
        {
            name: 'anomaly-store',
            partialize: (state) => ({ threshold: state.threshold }),
        }
    )
)
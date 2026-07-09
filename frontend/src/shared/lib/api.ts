/* Тонкий REST-клиент. Все сетевые вызовы идут отсюда — при переходе
   с моков на реальный бэк (фаза 5) меняется только BASE_URL.
   Таймаут 60с (раздел 7: синхронный HTTP-запрос ≤ 1 минуты). */
import type {
    BusinessGraph,
    DetectedEntity,
    FactRow,
    NewsCard,
    AnomalyCard,
    Scenario,
    ScenarioParams,
    DriverRow,
    AiSummaryResponse,
    UploadResultResponse,
    SaveFormulasRequest,
    SaveFormulasResponse,
} from './api-types'
import { heavyLimiter } from './limiter'

const BASE_URL = ''
const REQUEST_TIMEOUT_MS = 60_000

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const isFormData = init?.body instanceof FormData
        const headers: Record<string, string> = isFormData
            ? {}
            : { 'Content-Type': 'application/json' }
        Object.assign(headers, (init?.headers as Record<string, string>) ?? {})
        const res = await fetch(`${BASE_URL}${path}`, {
            ...init,
            signal: controller.signal,
            headers,
        })
        if (!res.ok) {
            throw new ApiError(res.status, `Запрос ${path} вернул ${res.status}`)
        }
        return (await res.json()) as T
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new ApiError(408, 'Превышено время ожидания (60 с). Повторите попытку.')
        }
        throw err
    } finally {
        clearTimeout(timer)
    }
}

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

export const api = {
    // ========== Факты и справочники ==========
    getFacts: () => request<FactRow[]>('/api/facts'),
    getEntities: () => request<DetectedEntity[]>('/api/entities'),
    getRegions: () => request<string[]>('/api/regions'),
    getIndicators: () => request<string[]>('/api/indicators'),

    // ========== Загрузка данных ==========
    uploadAnalytics: (file: File) => {
        const form = new FormData()
        form.append('file', file)
        return request<UploadResultResponse>('/api/analytics/upload', {
            method: 'POST',
            body: form,
            headers: {},
        })
    },

    // ========== Граф бизнес-модели ==========
    getGraph: () => request<BusinessGraph>('/api/graph'),
    saveGraphFormulas: (body: SaveFormulasRequest) =>
        request<SaveFormulasResponse>('/api/graph/formulas', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // ========== Сценарии ==========
    getScenarios: () => request<Scenario[]>('/api/scenarios'),
    /** Создать новый сценарий (POST /api/scenarios) */
    createScenario: (params: ScenarioParams) =>
        request<Scenario[]>('/api/scenarios', {
            method: 'POST',
            body: JSON.stringify(params),
        }),
    /** Совместимость со старым computeScenario */
    computeScenario: (params: ScenarioParams) =>
        heavyLimiter.schedule(() =>
            request<Scenario>('/api/scenarios/compute', {
                method: 'POST',
                body: JSON.stringify(params),
            })
        ),


    deleteScenario: (id: string) =>
        request<{ status: string }>(`/api/scenarios/${id}`, { method: 'DELETE' }),

    // ========== Аномалии ==========
    getAnomalies: (subject?: string, indicator?: string, threshold?: number) => {
        const params = new URLSearchParams()
        if (subject) params.append('subject', subject)
        if (indicator) params.append('indicator', indicator)
        if (threshold) params.append('threshold', String(threshold))
        return request<AnomalyCard[]>(`/api/anomalies?${params.toString()}`)
    },

    getAnomalyStatus: (userId?: string) =>
        request<{ active: boolean }>(`/api/anomalies/status${userId ? `?userId=${userId}` : ''}`),

    replaceAnomalies: (subject?: string, indicator?: string, threshold?: number, userId?: string) => {
        const params = new URLSearchParams()
        if (subject) params.append('subject', subject)
        if (indicator) params.append('indicator', indicator)
        if (threshold) params.append('threshold', String(threshold))
        if (userId) params.append('userId', userId)
        return request<{ status: string; replaced: number; message: string }>(`/api/anomalies/replace?${params.toString()}`, { method: 'POST' })
    },

    restoreAnomalies: (userId?: string) => {
        const params = new URLSearchParams()
        if (userId) params.append('userId', userId)
        return request<{ status: string; restored: number; message: string }>(`/api/anomalies/restore?${params.toString()}`, { method: 'POST' })
    },

    // ========== Новости ==========
    getNews: (subject?: string, period: number = 90) => {
        const params = new URLSearchParams()
        if (subject) params.append('subject', subject)
        params.append('period', String(period))
        return request<NewsCard[]>(`/api/news?${params.toString()}`)
    },

    // ========== AI-резюме ==========
    getAiSummary: (subject: string) =>
        request<AiSummaryResponse>(`/api/ai/summary?subject=${encodeURIComponent(subject)}`),

    // ========== Драйверы ==========
    getDrivers: (subject: string, indicator: string) =>
        request<DriverRow[]>(`/api/analytics/drivers?subject=${encodeURIComponent(subject)}&indicator=${encodeURIComponent(indicator)}`),

    getScenarioDrivers: (scenarioId: string, region: string) =>
        request<Record<string, number>>(`/api/scenarios/${scenarioId}/drivers?region=${encodeURIComponent(region)}`),

    // ========== Сезонность ==========
    getSeasonality: (subject: string, indicator: string) =>
        request<Record<number, number>>(`/api/seasonality?subject=${encodeURIComponent(subject)}&indicator=${encodeURIComponent(indicator)}`),

    // ========== Прогноз ==========
    getForecast: (subject: string, indicator: string, horizon: number = 6, method: string = 'sarimax') =>
        request<any>(`/api/forecast?subject=${encodeURIComponent(subject)}&indicator=${encodeURIComponent(indicator)}&horizon=${horizon}&method=${method}`),

    // ========== Экспорт ==========
    exportCsv: (subject?: string) =>
        request<Blob>(`/api/export/csv${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`, {
            headers: { Accept: 'application/octet-stream' },
        }),

    // ========== Очистка (тест) ==========
    cleanDatabase: () =>
        request<{ status: string; message: string }>('/api/clean', { method: 'DELETE' }),
}
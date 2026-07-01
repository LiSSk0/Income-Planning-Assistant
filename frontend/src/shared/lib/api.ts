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
} from './api-types'
import { heavyLimiter } from './limiter'

const BASE_URL = ''
const REQUEST_TIMEOUT_MS = 60_000

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    // Для FormData (загрузка файла) НЕ задаём Content-Type — браузер
    // сам проставит multipart-boundary. Для остального — JSON.
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
  getFacts: () => request<FactRow[]>('/api/facts'),
  getGraph: () => request<BusinessGraph>('/api/graph'),
  getEntities: () => request<DetectedEntity[]>('/api/entities'),
  getScenarios: () => request<Scenario[]>('/api/scenarios'),
  /** Тяжёлый пересчёт — через лимитер 5 параллельных. */
  computeScenario: (params: ScenarioParams) =>
    heavyLimiter.schedule(() =>
      request<Scenario>('/api/scenarios/compute', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    ),
  getNews: () => request<NewsCard[]>('/api/news'),
  getAnomalies: () => request<AnomalyCard[]>('/api/anomalies'),

  /* ---------- Эндпоинты «Недели 1» ---------- */

  /** Блок 1: загрузка файла. Файл уходит как multipart/form-data. */
  uploadAnalytics: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    // FormData сам проставит boundary — не задаём Content-Type вручную.
    return request<UploadResultResponse>('/api/analytics/upload', {
      method: 'POST',
      body: form,
      headers: {},
    })
  },

  /** Блок 2: драйверы по субъекту РФ для графика. */
  getDrivers: (subject: string) =>
    request<DriverRow[]>(`/api/analytics/drivers?subject=${encodeURIComponent(subject)}`),

  /** Блок 3: AI-резюме (marketNews + aiPlanSummary) по субъекту. */
  getAiSummary: (subject: string) =>
    request<AiSummaryResponse>(`/api/ai/summary?subject=${encodeURIComponent(subject)}`),
}

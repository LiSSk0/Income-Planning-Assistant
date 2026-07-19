/* MSW-обработчики REST. Фронт работает автономно; замена на реальный
   API (фаза 5) — это смена baseURL, контракты в shared/lib/api-types.ts. */
import { http, HttpResponse } from 'msw'
import { FACTS, REGIONS } from './seed'
import { BUSINESS_GRAPH } from './graph'
import { buildScenario, defaultScenarios, DEFAULT_PARAMS } from './scenarios'
import { NEWS, detectAnomalies } from './ai'
import { driversForSubject, DRIVER_SUBJECTS } from './drivers'
import { aiSummaryForSubject } from './aiSummary'
import type { DetectedEntity, ScenarioParams } from '@/shared/lib/api-types'

const DETECTED_ENTITIES: DetectedEntity[] = [
  { column: 'Отчётный период', category: 'date', confidence: 0.99, sample: ['2026-04', '2026-05', '2026-06'] },
  { column: 'Федеральный округ РФ', category: 'territory', confidence: 0.97, sample: ['Центральный', 'Северо-Западный'] },
  { column: 'Субъект РФ', category: 'territory', confidence: 0.96, sample: REGIONS.slice(0, 3).map((r) => r.subject) },
  { column: 'Показатель', category: 'indicator', confidence: 0.94, sample: ['Доход банка', 'Объём транзакций', 'Студенты'] },
  { column: 'Мера измерения', category: 'unit', confidence: 0.9, sample: ['руб', 'чел', '%'] },
  { column: 'Значение', category: 'value', confidence: 0.98, sample: ['31157.6', '623152', '2291'] },
]

export const handlers = [
  http.get('/api/facts', () => HttpResponse.json(FACTS)),

  http.get('/api/graph', () => HttpResponse.json(BUSINESS_GRAPH)),

  // Сохранение формул графа. Логируем и возвращаем количество сохранённых.
  http.post('/api/graph/formulas', async ({ request }) => {
    const body = (await request.json()) as { formulas?: unknown[] }
    const saved = Array.isArray(body?.formulas) ? body.formulas.length : 0
    return HttpResponse.json({ status: 'ok', saved })
  }),

  http.get('/api/entities', () => HttpResponse.json(DETECTED_ENTITIES)),

  http.get('/api/scenarios', () => HttpResponse.json(defaultScenarios())),

  http.post('/api/scenarios/compute', async ({ request }) => {
    const params = (await request.json()) as ScenarioParams
    // имитируем тяжёлый пересчёт
    await new Promise((r) => setTimeout(r, 600))
    const sc = buildScenario(`sc-${Date.now()}`, 'custom', {
      ...DEFAULT_PARAMS,
      ...params,
    })
    return HttpResponse.json(sc)
  }),

  http.get('/api/news', () => HttpResponse.json(NEWS)),

  http.get('/api/anomalies', () => HttpResponse.json(detectAnomalies())),

  /* ---------- Эндпоинты «Недели 1» (точные контракты бэка) ---------- */

  // Блок 1: загрузка файла (заглушка). Имитируем пересчёт ~1.2 с.
  http.post('/api/analytics/upload', async () => {
    await new Promise((r) => setTimeout(r, 1200))
    return HttpResponse.json({
      status: 'ok',
      message: 'Данные успешно загружены и пересчитаны',
    })
  }),

  // Блок 2: драйверы по субъекту РФ. ?subject=... ; без параметра — все субъекты.
  http.get('/api/analytics/drivers', ({ request }) => {
    const url = new URL(request.url)
    const subject = url.searchParams.get('subject')
    if (!subject) {
      // Отдаём первый субъект из списка, чтобы график не был пустым.
      return HttpResponse.json(driversForSubject(DRIVER_SUBJECTS[0]))
    }
    return HttpResponse.json(driversForSubject(subject))
  }),

  // Блок 3: AI-резюме по субъекту РФ. Небольшая задержка имитирует работу модели.
  http.get('/api/ai/summary', async ({ request }) => {
    const url = new URL(request.url)
    const subject = url.searchParams.get('subject') ?? ''
    await new Promise((r) => setTimeout(r, 700))
    return HttpResponse.json(aiSummaryForSubject(subject))
  }),
]

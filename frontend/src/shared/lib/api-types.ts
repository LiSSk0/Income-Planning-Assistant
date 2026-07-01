/* ============================================================
   Контракты фронт↔бэк. Держим ВСЕ типы обмена здесь, чтобы
   замена моков на реальный REST/WebSocket (фаза 5) была локальной.
   ============================================================ */

/** Категории распознавания сущностей при загрузке. */
export type EntityCategory = 'date' | 'indicator' | 'territory' | 'value' | 'unit'

/** Одна строка длинного (long) формата фактов.
 *  Единая широкая таблица — без вложенных структур и join на клиенте. */
export interface FactRow {
  period: string // "YYYY-MM" — Отчётный период
  district: string // Федеральный округ РФ
  subject: string // Субъект РФ
  indicator: string // Показатель
  unit: string // Мера измерения
  value: number // Значение
}

/** Математические операции на рёбрах графа бизнес-модели. */
export type GraphOperator = '+' | '-' | '*' | '/' | '%'

export interface GraphNodeModel {
  id: string
  /** Название показателя (совпадает с FactRow.indicator). */
  indicator: string
  unit: string
  /** Текущее (последнее известное) значение для подписи в узле. */
  currentValue: number
  /** Узел-результат собирается из входящих рёбер по их оператору. */
  isDerived: boolean
  position?: { x: number; y: number }
}

export interface GraphEdgeModel {
  id: string
  source: string
  target: string
  operator: GraphOperator
}

export interface BusinessGraph {
  nodes: GraphNodeModel[]
  edges: GraphEdgeModel[]
}

/* ---------- Загрузка / прогресс через WebSocket ---------- */

export type UploadPhase =
  | 'queued'
  | 'parsing'
  | 'validating'
  | 'detecting-entities'
  | 'persisting'
  | 'done'
  | 'error'

export interface UploadProgressEvent {
  uploadId: string
  phase: UploadPhase
  /** 0..100 — процент обработки, к которому привязан прогресс-бар. */
  percent: number
  message: string
  rowsProcessed?: number
  rowsTotal?: number
}

export interface DetectedEntity {
  column: string
  category: EntityCategory
  confidence: number // 0..1
  sample: string[]
}

/* ---------- Сценарии планирования ---------- */

export type ScenarioKind =
  | 'base'
  | 'optimistic'
  | 'conservative'
  | 'custom'
  | 'ai'

export type CalcMethod = 'growth-rate' | 'avg-3m' | 'avg-6m'

export interface ScenarioParams {
  name?: string // название плана (задаёт пользователь)
  targetIndicator: string // целевой показатель (доход)
  /** Конец отрезка планирования, мес (1..24). Совместимо со старым кодом. */
  horizonMonths: number
  /** Начало отрезка планирования, мес (1..24). Период = [periodFrom..horizonMonths]. */
  periodFrom?: number
  seasonality: boolean // учёт сезонности (всегда true в текущем UI)
  method: CalcMethod // способ расчёта
  /** Множители ключевых драйверов для «ручного» сценария. */
  driverMultipliers?: Record<string, number>
}

export interface ScenarioPoint {
  period: string
  value: number
}

export interface ScenarioRegionValue {
  subject: string
  value: number
}

/** Статусы пересчёта — лимит 5 параллельных тяжёлых задач на бэке. */
export type ScenarioStatus = 'queued' | 'computing' | 'ready' | 'failed'

export interface Scenario {
  id: string
  kind: ScenarioKind
  title: string
  description: string
  params: ScenarioParams
  status: ScenarioStatus
  series: ScenarioPoint[] // динамика целевого показателя по периодам
  /** Прогноз по КАЖДОМУ доступному показателю (агрегировано по субъектам).
   *  Ключ — название показателя. Используется для блока «Прогноз по
   *  показателям» с чекбоксами выбора. */
  seriesByIndicator?: Record<string, ScenarioPoint[]>
  byRegion: ScenarioRegionValue[] // значение для choropleth-карты
  /** Метрика качества: СКО темпов роста год к году по субъектам РФ. */
  growthRateStd: number
  /** Драйверы итогового числа с процентным вкладом (раздел 3.5). */
  drivers: ScenarioDriver[]
}

export interface ScenarioDriver {
  indicator: string
  contributionPct: number // вклад в итоговое число, %
  value: number
  unit: string
}

/* ---------- AI-блок ---------- */

export interface NewsCard {
  id: string
  title: string
  source: string
  date: string // "YYYY-MM"
  url: string
  summary: string
  /** Период на графике, к которому новость предположительно относится. */
  relatedPeriod?: string
  /** Знак предполагаемого влияния на показатель. */
  impact: 'positive' | 'negative' | 'neutral'
  /** Корреляция не точная — помечаем «предположительно». */
  presumed: boolean
}

export interface AnomalyCard {
  id: string
  indicator: string
  period: string
  subject: string
  /** Величина отклонения, % к предыдущему периоду / тренду. */
  deviationPct: number
  direction: 'up' | 'down'
  text: string
}

/* ============================================================
   Контракты «Недели 1» — точные форматы, согласованные с
   backend-командой (tasks/task_week1.txt). Это отдельный
   набор полей (camelCase, дата "YYYY-MM-DD"), независимый от
   long-формата FactRow выше.
   ============================================================ */

/** Строка драйверов по региону и периоду (GET /api/analytics/drivers). */
export interface DriverRow {
  reportPeriod: string // "YYYY-MM-DD" (первое число месяца)
  federalDistrict: string // напр. "Северо-Западный ФО"
  subjectRf: string // напр. "Мурманская обл."
  avgArpu: number // средний ARPU
  marketPenetrationPct: number // проникновение на рынок, %
  avgTransactionCheck: number // средний чек транзакции, руб
  bankIncomeLag1: number | null // доход банка со сдвигом на 1 период (может быть null)
}

/** Ответ AI-блока (GET /api/ai/summary). */
export interface AiSummaryResponse {
  marketNews: string // контекстная новость по рынку (грузится при выборе региона)
  aiPlanSummary: string // саммари плана (по кнопке «Сгенерировать AI-резюме»)
}

/** Ответ заглушки загрузки (POST /api/analytics/upload). */
export interface UploadResultResponse {
  status: 'ok'
  message: string // напр. «Данные успешно загружены и пересчитаны»
}


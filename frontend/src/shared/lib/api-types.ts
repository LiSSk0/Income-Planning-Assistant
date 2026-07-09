// src/shared/lib/api-types.ts
/* ============================================================
   Контракты фронт↔бэк. Держим ВСЕ типы обмена здесь.
   ============================================================ */

export type EntityCategory = 'date' | 'indicator' | 'territory' | 'value' | 'unit'

/** Одна строка длинного (long) формата фактов. */
export interface FactRow {
    period: string
    district: string
    subject: string
    indicator: string
    unit: string
    value: number
}

export type GraphOperator = '+' | '-' | '*' | '/' | '%'

export interface GraphNodeModel {
    id: string
    indicator: string
    unit: string
    currentValue: number
    isDerived: boolean
    position?: { x: number; y: number }
    kind?: 'indicator' | 'operation'
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

/* ---------- Загрузка / прогресс ---------- */

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
    percent: number
    message: string
    rowsProcessed?: number
    rowsTotal?: number
}

export interface DetectedEntity {
    column: string
    category: EntityCategory
    confidence: number
    sample: string[]
}

/* ---------- Сценарии ---------- */

export type ScenarioKind = 'base' | 'optimistic' | 'conservative' | 'custom' | 'ai'
export type CalcMethod = 'growth-rate' | 'avg-3m' | 'avg-6m'
export type ScenarioStatus = 'queued' | 'computing' | 'ready' | 'failed'

export interface ScenarioParams {
    name: string
    targetIndicator: string
    regions: string[]          // пустой список = все регионы
    horizonMonths: number
    useFormulas: boolean
    // legacy (сохранены для обратной совместимости)
    periodFrom?: number
    seasonality?: boolean
    method?: CalcMethod
    driverMultipliers?: Record<string, number>
    forecastMode?: string
}

export interface ModelForecast {
    name: string
    rank: number
    metrics: {
        MAE: number
        RMSE: number
        MAPE: number
    }
    forecast: Record<string, number>  // "YYYY-MM" -> значение
}

export interface Scenario {
    id: string
    kind: ScenarioKind
    title: string
    description: string
    params: ScenarioParams
    status: ScenarioStatus
    targetIndicator: string
    regions: string[]
    regionForecasts: Record<string, ModelForecast[]>  // ключ = регион, значение = список моделей
    growthRateStd: number
    drivers: ScenarioDriver[]
    // legacy (для обратной совместимости)
    series?: ScenarioPoint[]
    seriesByIndicator?: Record<string, ScenarioPoint[]>
    byRegion?: ScenarioRegionValue[]
}

export interface ScenarioPoint {
    period: string
    value: number
}

export interface ScenarioRegionValue {
    subject: string
    value: number
}

export interface ScenarioDriver {
    indicator: string
    contributionPct: number
    value: number
    unit: string
}

/* ---------- Новости и аномалии ---------- */

export interface NewsCard {
    id: string
    title: string
    source: string
    date: string
    url: string
    summary: string
    relatedPeriod?: string
    impact: 'positive' | 'negative' | 'neutral'
    presumed: boolean
}

export interface AnomalyCard {
    id: string
    indicator: string
    period: string
    subject: string
    deviationPct: number
    direction: 'up' | 'down'
    text: string
}

/* ---------- AI-блок ---------- */

export interface AiSummaryResponse {
    marketNews: string
    aiPlanSummary: string
}

/* ---------- Граф формулы ---------- */

export interface GraphFormula {
    targetId: string
    target: string
    expression: string
    operands: { sourceId: string; source: string; operator: GraphOperator }[]
}

export interface SaveFormulasRequest {
    formulas: GraphFormula[]
    nodes: { id: string; kind: 'indicator' | 'operation'; label: string }[]
    edges: { source: string; target: string; operator: GraphOperator }[]
}

export interface SaveFormulasResponse {
    status: 'ok'
    saved: number
}

/* ---------- Драйверы (legacy) ---------- */

export interface DriverRow {
    reportPeriod: string
    federalDistrict: string
    subjectRf: string
    avgArpu: number
    marketPenetrationPct: number
    avgTransactionCheck: number
    bankIncomeLag1: number | null
}

export interface UploadResultResponse {
    status: 'ok'
    message: string
}
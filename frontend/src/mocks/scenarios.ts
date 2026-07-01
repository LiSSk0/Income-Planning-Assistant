/* Генерация 3–4 сценариев плана по целевому показателю (доход).
   Сценарии различаются ПЕРИОДОМ расчёта среднего и темпом —
   главное по конспекту от 17.06: «3-4 варианта плана по периодам»
   (среднее за 3 / 6 мес / по сезонности), а тип (опт./конс.) вторичен. */
import type {
  Scenario,
  ScenarioDriver,
  ScenarioKind,
  ScenarioParams,
  ScenarioPoint,
  ScenarioRegionValue,
} from '@/shared/lib/api-types'
import { FACTS, PERIODS, REGIONS, TARIFF_PCT, INDICATORS } from './seed'

function historyFor(indicator: string, subject: string): ScenarioPoint[] {
  return PERIODS.map((period) => {
    const row = FACTS.find(
      (r) => r.period === period && r.subject === subject && r.indicator === indicator,
    )
    return { period, value: row?.value ?? 0 }
  })
}

/** Среднемесячный темп роста по последним n месяцам. */
function growthRate(series: ScenarioPoint[], n: number): number {
  const tail = series.slice(-n - 1)
  if (tail.length < 2) return 1
  let acc = 0
  let cnt = 0
  for (let i = 1; i < tail.length; i++) {
    if (tail[i - 1].value > 0) {
      acc += tail[i].value / tail[i - 1].value
      cnt++
    }
  }
  return cnt ? acc / cnt : 1
}

function avgLast(series: ScenarioPoint[], n: number): number {
  const tail = series.slice(-n)
  return tail.reduce((s, p) => s + p.value, 0) / (tail.length || 1)
}

/** Будущие периоды после последнего исторического. */
function futurePeriods(horizon: number): string[] {
  const last = PERIODS[PERIODS.length - 1]
  let [y, m] = last.split('-').map(Number)
  const out: string[] = []
  for (let i = 0; i < horizon; i++) {
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}

const SEASON: Record<number, number> = {
  1: 0.96, 2: 1.0, 3: 1.02, 4: 1.01, 5: 0.95, 6: 0.78,
  7: 0.6, 8: 0.66, 9: 1.12, 10: 1.06, 11: 1.03, 12: 0.9,
}

interface KindCfg {
  kind: ScenarioKind
  title: string
  description: string
  /** Поправка к темпу: оптимистичный > 1, консервативный < 1. */
  rateBias: number
}

const KIND_CFG: Record<Exclude<ScenarioKind, 'ai'>, KindCfg> = {
  base: { kind: 'base', title: 'Базовый', description: 'Продление текущих трендов', rateBias: 1 },
  optimistic: { kind: 'optimistic', title: 'Оптимистичный', description: 'Рост ключевых драйверов', rateBias: 1.06 },
  conservative: { kind: 'conservative', title: 'Консервативный', description: 'Снижение активности рынка', rateBias: 0.95 },
  custom: { kind: 'custom', title: 'Пользовательский', description: 'Ручная настройка параметров', rateBias: 1 },
}

function projectSubject(
  indicator: string,
  subject: string,
  params: ScenarioParams,
  rateBias: number,
): ScenarioPoint[] {
  const hist = historyFor(indicator, subject)
  const periods = futurePeriods(params.horizonMonths)
  let base: number
  let monthlyRate = 1

  if (params.method === 'growth-rate') {
    monthlyRate = growthRate(hist, 6) * rateBias
    base = hist[hist.length - 1].value
  } else {
    const n = params.method === 'avg-3m' ? 3 : 6
    base = avgLast(hist, n)
    monthlyRate = growthRate(hist, n) * rateBias
  }

  let val = base
  return periods.map((period) => {
    val = val * monthlyRate
    const month = Number(period.split('-')[1])
    const seasonal = params.seasonality ? SEASON[month] ?? 1 : 1
    const driverMul = params.driverMultipliers
      ? Object.values(params.driverMultipliers).reduce((a, b) => a * b, 1)
      : 1
    return { period, value: +(val * seasonal * driverMul).toFixed(1) }
  })
}

/** СКО темпов роста год к году по субъектам — метрика качества плана. */
function growthRateStd(perSubject: Record<string, ScenarioPoint[]>): number {
  const rates = Object.values(perSubject).map((series) => {
    if (series.length < 2) return 0
    return series[series.length - 1].value / (series[0].value || 1)
  })
  const mean = rates.reduce((a, b) => a + b, 0) / (rates.length || 1)
  const variance =
    rates.reduce((a, r) => a + (r - mean) ** 2, 0) / (rates.length || 1)
  return +Math.sqrt(variance).toFixed(3)
}

function buildDrivers(subject: string): ScenarioDriver[] {
  const last = (ind: string) =>
    FACTS.filter((r) => r.indicator === ind && r.subject === subject).at(-1)?.value ?? 0
  // Вклад приближённо: доля логарифма множителя в произведении.
  const clients = last(INDICATORS.clients.name)
  const meal = last(INDICATORS.mealPrice.name)
  return [
    { indicator: INDICATORS.clients.name, value: clients, unit: 'чел', contributionPct: 46 },
    { indicator: INDICATORS.mealPrice.name, value: meal, unit: 'руб', contributionPct: 34 },
    { indicator: INDICATORS.share.name, value: last(INDICATORS.share.name), unit: '%', contributionPct: 14 },
    { indicator: INDICATORS.tariff.name, value: TARIFF_PCT, unit: '%', contributionPct: 6 },
  ]
}

export function buildScenario(
  id: string,
  kind: Exclude<ScenarioKind, 'ai'> | 'ai',
  params: ScenarioParams,
): Scenario {
  const cfg =
    kind === 'ai'
      ? { kind: 'ai' as const, title: 'AI-сценарий', description: 'Рекомендация модели на основе драйверов', rateBias: 1.03 }
      : KIND_CFG[kind]

  // Период планирования — отрезок [periodFrom..horizonMonths]. Проецируем
  // до конца отрезка, затем отрезаем начало, чтобы остался выбранный сегмент.
  const sliceStart = Math.max(0, (params.periodFrom ?? 1) - 1)

  const perSubject: Record<string, ScenarioPoint[]> = {}
  REGIONS.forEach((r) => {
    perSubject[r.subject] = projectSubject(
      params.targetIndicator,
      r.subject,
      params,
      cfg.rateBias,
    ).slice(sliceStart)
  })

  // Агрегированная динамика по всем субъектам (по выбранному отрезку).
  const periods = futurePeriods(params.horizonMonths).slice(sliceStart)
  const series: ScenarioPoint[] = periods.map((period, i) => ({
    period,
    value: +REGIONS.reduce((s, r) => s + (perSubject[r.subject][i]?.value ?? 0), 0).toFixed(1),
  }))

  // Прогноз по КАЖДОМУ доступному показателю (агрегировано по субъектам) —
  // для блока «Прогноз по показателям» с чекбоксами.
  const seriesByIndicator: Record<string, ScenarioPoint[]> = {}
  Object.values(INDICATORS).forEach((ind) => {
    const per = REGIONS.map((r) =>
      projectSubject(ind.name, r.subject, params, cfg.rateBias).slice(sliceStart),
    )
    seriesByIndicator[ind.name] = periods.map((period, i) => ({
      period,
      value: +per.reduce((s, arr) => s + (arr[i]?.value ?? 0), 0).toFixed(1),
    }))
  })

  const byRegion: ScenarioRegionValue[] = REGIONS.map((r) => ({
    subject: r.subject,
    value: +(perSubject[r.subject].at(-1)?.value ?? 0).toFixed(1),
  }))

  return {
    id,
    kind: cfg.kind,
    // Название плана от пользователя имеет приоритет над типовым заголовком.
    title: params.name?.trim() || cfg.title,
    description: cfg.description,
    params,
    status: 'ready',
    series,
    seriesByIndicator,
    byRegion,
    growthRateStd: growthRateStd(perSubject),
    drivers: buildDrivers('Москва'),
  }
}

export const DEFAULT_PARAMS: ScenarioParams = {
  targetIndicator: INDICATORS.revenue.name,
  periodFrom: 1,
  horizonMonths: 6,
  seasonality: true,
  method: 'avg-3m',
}

/** Набор сценариев по умолчанию — для первого рендера дашборда. */
export function defaultScenarios(): Scenario[] {
  return [
    buildScenario('sc-base', 'base', { ...DEFAULT_PARAMS, method: 'growth-rate' }),
    buildScenario('sc-opt', 'optimistic', { ...DEFAULT_PARAMS, method: 'avg-3m' }),
    buildScenario('sc-cons', 'conservative', { ...DEFAULT_PARAMS, method: 'avg-6m' }),
    buildScenario('sc-ai', 'ai', { ...DEFAULT_PARAMS, method: 'avg-3m', seasonality: true }),
  ]
}

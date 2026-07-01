/* Производные выборки из длинного (long) формата фактов.
   Везде работаем с одним массивом строк — без join на клиенте (раздел 7). */
import type { FactRow } from './api-types'

export interface SeriesPoint {
  period: string
  value: number
}

/** Сумма показателя по всем субъектам, помесячно. */
export function aggregateByPeriod(facts: FactRow[], indicator: string): SeriesPoint[] {
  const map = new Map<string, number>()
  for (const r of facts) {
    if (r.indicator !== indicator) continue
    map.set(r.period, (map.get(r.period) ?? 0) + r.value)
  }
  return [...map.entries()].map(([period, value]) => ({ period, value })).sort((a, b) => a.period.localeCompare(b.period))
}

/** Ряд показателя по одному субъекту. */
export function seriesForSubject(facts: FactRow[], indicator: string, subject: string): SeriesPoint[] {
  return facts
    .filter((r) => r.indicator === indicator && r.subject === subject)
    .map((r) => ({ period: r.period, value: r.value }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

/** Значение показателя по субъектам за последний период — для карты. */
export function latestBySubject(facts: FactRow[], indicator: string): Record<string, number> {
  const periods = [...new Set(facts.map((f) => f.period))].sort()
  const last = periods.at(-1)
  const out: Record<string, number> = {}
  for (const r of facts) {
    if (r.indicator === indicator && r.period === last) out[r.subject] = r.value
  }
  return out
}

/** Прирост последнего периода к предыдущему, %. */
export function lastDeltaPct(series: SeriesPoint[]): number {
  if (series.length < 2) return 0
  const a = series.at(-2)!.value
  const b = series.at(-1)!.value
  if (a === 0) return 0
  return +(((b - a) / a) * 100).toFixed(1)
}

export function lastValue(series: SeriesPoint[]): number {
  return series.at(-1)?.value ?? 0
}

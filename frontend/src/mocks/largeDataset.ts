/* Синтетический большой датасет для проверки виртуализации таблицы.
   Генерируется лениво на клиенте (не гоняем сотни тысяч строк по сети). */
import type { FactRow } from '@/shared/lib/api-types'
import { REGIONS, INDICATORS, buildPeriods } from './seed'

const INDS = Object.values(INDICATORS)

/** Возвращает n строк long-формата (детерминированно по индексу). */
export function generateLargeDataset(n: number): FactRow[] {
  const periods = buildPeriods(60) // 5 лет
  const rows: FactRow[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const region = REGIONS[i % REGIONS.length]
    const ind = INDS[i % INDS.length]
    const period = periods[i % periods.length]
    // псевдослучайное, но стабильное значение
    const v = ((i * 2654435761) % 1000000) / (ind.unit === '%' ? 10000 : 1)
    rows[i] = {
      period,
      district: region.district,
      subject: region.subject,
      indicator: ind.name,
      unit: ind.unit,
      value: +v.toFixed(ind.unit === '%' ? 1 : 0),
    }
  }
  return rows
}

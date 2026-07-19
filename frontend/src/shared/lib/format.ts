/** Утилиты форматирования чисел/периодов — единый стиль во всём приложении. */

const RU_MONTHS = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

const RU_MONTHS_FULL = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

/** "2026-08" -> "авг 2026" */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-')
  const idx = Number(m) - 1
  if (Number.isNaN(idx) || !RU_MONTHS[idx]) return period
  return `${RU_MONTHS[idx]} ${y}`
}

/** "2026-08" -> "август 2026" */
export function formatPeriodFull(period: string): string {
  const [y, m] = period.split('-')
  const idx = Number(m) - 1
  if (Number.isNaN(idx) || !RU_MONTHS_FULL[idx]) return period
  return `${RU_MONTHS_FULL[idx]} ${y}`
}

/** Группировка разрядов по-русски: 623152 -> "623 152". */
export function formatNumber(value: number, maxFractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: maxFractionDigits,
  }).format(value)
}

/** Компактно: 31157.6 -> "31,2 тыс." для KPI. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${formatNumber(value, digits)}%`
}

/** Подбирает строку значения с единицей измерения. */
export function formatWithUnit(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`.trim()
}

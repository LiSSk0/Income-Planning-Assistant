/* Мок для блока «Расчёт СКО для прогнозируемого показателя»
   (см. info/docum.docx, раздел «Аналитика»).
   На графике — столбцы по регионам:
     2024 (синий), 2025 (красный), 2026 (зелёный — прогноз).
   У прогнозного 2026 — доверительный коридор [lower..upper] (по умолчанию
   95%), на графике показывается «усами» (ErrorBar) пунктиром.
   Значения детерминированы.
   Поддерживает несколько показателей (доход, кол-во клиентов и т. д.). */
import { REGIONS, INDICATORS } from './seed'

export interface YoYRegion {
  subject: string
  y2024: number
  y2025: number
  y2026: number // прогноз
  lower: number // нижняя граница коридора
  upper: number // верхняя граница коридора
}

export interface YoYResult {
  indicator: string
  unit: string
  regions: YoYRegion[]
  /** Общее СКО для суммы всех месяцев/регионов. */
  sigma: number
  /** Уровень доверия коридора, %. */
  confidence: number
}

/** Опция для выпадающего списка показателей. */
export interface IndicatorOption {
  key: string
  name: string
  unit: string
}

/** Базовые значения 2024 по регионам для каждого показателя. */
const INDICATOR_BASES: Record<string, Record<string, number>> = {
  'Доход банка': {
    Москва: 484000,
    'Санкт-Петербург': 392000,
    'Республика Татарстан': 268000,
    'Свердловская область': 224000,
  },
  'Объём транзакций': {
    Москва: 9680000,
    'Санкт-Петербург': 7840000,
    'Республика Татарстан': 5360000,
    'Свердловская область': 4480000,
  },
  'Количество клиентов': {
    Москва: 2291,
    'Санкт-Петербург': 1513,
    'Республика Татарстан': 1096,
    'Свердловская область': 875,
  },
  'Средняя стоимость обеда': {
    Москва: 272,
    'Санкт-Петербург': 244,
    'Республика Татарстан': 208,
    'Свердловская область': 196,
  },
  'Доля питающихся в столовой': {
    Москва: 67,
    'Санкт-Петербург': 61,
    'Республика Татарстан': 58,
    'Свердловская область': 54,
  },
  'Общее число людей': {
    Москва: 3420,
    'Санкт-Петербург': 2600,
    'Республика Татарстан': 1985,
    'Свердловская область': 1700,
  },
  Студенты: {
    Москва: 3260,
    'Санкт-Петербург': 2480,
    'Республика Татарстан': 1890,
    'Свердловская область': 1620,
  },
  'Административный персонал': {
    Москва: 160,
    'Санкт-Петербург': 120,
    'Республика Татарстан': 95,
    'Свердловская область': 80,
  },
  Тариф: {
    Москва: 5,
    'Санкт-Петербург': 5,
    'Республика Татарстан': 5,
    'Свердловская область': 5,
  },
}

/** Множители роста YoY для каждого показателя (2024→2025, 2025→2026). */
const GROWTH: Record<string, { g25: number; g26: number }> = {
  'Доход банка': { g25: 1.12, g26: 1.076 },
  'Объём транзакций': { g25: 1.12, g26: 1.076 },
  'Количество клиентов': { g25: 1.06, g26: 1.04 },
  'Средняя стоимость обеда': { g25: 1.05, g26: 1.035 },
  'Доля питающихся в столовой': { g25: 1.01, g26: 1.005 },
  'Общее число людей': { g25: 1.03, g26: 1.02 },
  Студенты: { g25: 1.03, g26: 1.02 },
  'Административный персонал': { g25: 1.02, g26: 1.015 },
  Тариф: { g25: 1.0, g26: 1.0 },
}

/** Ширина коридора зависит от типа показателя (% — ± маленький, руб — шире). */
const CORRIDOR_BASE: Record<string, number> = {
  'Доход банка': 0.06,
  'Объём транзакций': 0.06,
  'Количество клиентов': 0.05,
  'Средняя стоимость обеда': 0.04,
  'Доля питающихся в столовой': 0.03,
  'Общее число людей': 0.035,
  Студенты: 0.035,
  'Административный персонал': 0.04,
  Тариф: 0.0,
}

export function buildYoYForIndicator(indicatorName: string, unit: string, confidence = 95): YoYResult {
  const bases = INDICATOR_BASES[indicatorName]
  const growth = GROWTH[indicatorName] ?? { g25: 1.05, g26: 1.03 }
  const corrBase = CORRIDOR_BASE[indicatorName] ?? 0.05

  const regions: YoYRegion[] = REGIONS.map((r, i) => {
    const base = bases?.[r.subject] ?? 100
    const y2024 = Math.round(base)
    const y2025 = Math.round(base * growth.g25)
    const y2026 = Math.round(y2025 * growth.g26)
    // Коридор расширяется для «дальних» регионов (меньше данных → шире СКО).
    const sig = Math.round(y2026 * (corrBase + i * 0.012))
    return { subject: r.subject, y2024, y2025, y2026, lower: y2026 - sig, upper: y2026 + sig }
  })

  // Общее СКО суммы ≈ корень из суммы квадратов полуинтервалов.
  const sigma = Math.round(
    Math.sqrt(regions.reduce((acc, r) => acc + Math.pow((r.upper - r.lower) / 2, 2), 0)),
  )

  return { indicator: indicatorName, unit, regions, sigma, confidence }
}

/** Список доступных показателей для выпадающего списка. */
export const INDICATOR_OPTIONS: IndicatorOption[] = Object.entries(INDICATORS).map(
  ([key, ind]) => ({ key, name: ind.name, unit: ind.unit }),
)

/** Пред-собранные YoY-данные для каждого показателя. */
export const YOY_BY_INDICATOR: Record<string, YoYResult> = Object.fromEntries(
  INDICATOR_OPTIONS.map((opt) => [opt.name, buildYoYForIndicator(opt.name, opt.unit)]),
)

/** Дефолт — «Доход банка» (backward compat). */
export const YOY: YoYResult = YOY_BY_INDICATOR[INDICATORS.revenue.name]

/* Мок для блока «Расчёт СКО для прогнозируемого дохода (YoY)»
   (см. info/docum.docx, раздел «Аналитика»).
   На графике — столбцы по регионам:
     2024 (синий), 2025 (красный), 2026 (зелёный — прогноз).
   У прогнозного 2026 — доверительный коридор [lower..upper] (по умолчанию
   95%), на графике показывается «усами» (ErrorBar) пунктиром.
   Значения детерминированы. */
import { REGIONS } from './seed'

export interface YoYRegion {
  subject: string
  y2024: number
  y2025: number
  y2026: number // прогноз
  lower: number // нижняя граница коридора
  upper: number // верхняя граница коридора
}

export interface YoYResult {
  regions: YoYRegion[]
  /** Общее СКО для суммы всех месяцев/регионов. */
  sigma: number
  /** Уровень доверия коридора, %. */
  confidence: number
}

/** Базовый годовой доход банка по регионам (для синтетики), руб. */
const BASE_ANNUAL: Record<string, number> = {
  Москва: 484000,
  'Санкт-Петербург': 392000,
  'Республика Татарстан': 268000,
  'Свердловская область': 224000,
}

export function buildYoY(confidence = 95): YoYResult {
  const regions: YoYRegion[] = REGIONS.map((r, i) => {
    const base = BASE_ANNUAL[r.subject] ?? 250000
    const y2024 = Math.round(base)
    const y2025 = Math.round(base * 1.12)
    const y2026 = Math.round(base * 1.205) // прогноз YoY ≈ +7.6% к 2025
    // Коридор расширяется для «дальних» регионов (меньше данных → шире СКО).
    const sig = Math.round(y2026 * (0.06 + i * 0.012))
    return { subject: r.subject, y2024, y2025, y2026, lower: y2026 - sig, upper: y2026 + sig }
  })

  // Общее СКО суммы ≈ корень из суммы квадратов полуинтервалов.
  const sigma = Math.round(
    Math.sqrt(regions.reduce((acc, r) => acc + Math.pow((r.upper - r.lower) / 2, 2), 0)),
  )

  return { regions, sigma, confidence }
}

export const YOY: YoYResult = buildYoY()

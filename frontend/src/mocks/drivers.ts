/* ============================================================
   Мок драйверов по регионам для «Недели 1» (Блок 2).
   Формат полей — ровно как в tasks/task_week1.txt:
   reportPeriod ("YYYY-MM-DD"), federalDistrict, subjectRf,
   avgArpu, marketPenetrationPct, avgTransactionCheck, bankIncomeLag1.
   Несколько субъектов РФ × 12 месяцев (детерминированно).
   Мурманская обл. за первые два месяца совпадает с примером из ТЗ.
   ============================================================ */
import type { DriverRow } from '@/shared/lib/api-types'

interface DriverRegionSeed {
  federalDistrict: string
  subjectRf: string
  baseArpu: number
  basePenetration: number
  baseCheck: number
  baseIncome: number
}

/** Субъекты РФ для выпадающего списка (первый — из примера ТЗ). */
const DRIVER_REGIONS: DriverRegionSeed[] = [
  { federalDistrict: 'Северо-Западный ФО', subjectRf: 'Мурманская обл.', baseArpu: 13.6, basePenetration: 66.98, baseCheck: 272, baseIncome: 31157.6 },
  { federalDistrict: 'Центральный ФО', subjectRf: 'Москва', baseArpu: 18.4, basePenetration: 71.2, baseCheck: 312, baseIncome: 48230.0 },
  { federalDistrict: 'Северо-Западный ФО', subjectRf: 'г. Санкт-Петербург', baseArpu: 16.1, basePenetration: 68.4, baseCheck: 288, baseIncome: 39870.0 },
  { federalDistrict: 'Приволжский ФО', subjectRf: 'Республика Татарстан', baseArpu: 12.9, basePenetration: 61.5, baseCheck: 244, baseIncome: 26540.0 },
  { federalDistrict: 'Уральский ФО', subjectRf: 'Свердловская обл.', baseArpu: 11.7, basePenetration: 58.3, baseCheck: 228, baseIncome: 22110.0 },
]

/** Детерминированный PRNG (mulberry32) — данные стабильны между рендерами. */
function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Сезонный множитель: лето — спад, сентябрь — пик. */
const SEASON: Record<number, number> = {
  1: 0.97, 2: 1.0, 3: 1.03, 4: 1.02, 5: 0.96, 6: 0.8,
  7: 0.62, 8: 0.68, 9: 1.14, 10: 1.07, 11: 1.04, 12: 0.92,
}

/** 12 периодов "YYYY-MM-01", янв..дек 2025. */
function buildDriverPeriods(): string[] {
  return Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}-01`)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function generateDrivers(): DriverRow[] {
  const periods = buildDriverPeriods()
  const rows: DriverRow[] = []

  DRIVER_REGIONS.forEach((region, ri) => {
    const rng = makeRng(2000 + ri * 13)
    let prevIncome: number | null = null

    periods.forEach((reportPeriod, pi) => {
      const month = pi + 1
      const trend = 1 + pi * 0.01 // лёгкий рост к концу года
      const noise = () => 1 + (rng() - 0.5) * 0.04
      const seasonal = SEASON[month] ?? 1

      let avgArpu: number
      let marketPenetrationPct: number
      let avgTransactionCheck: number
      let income: number

      // Первые два месяца Мурманской обл. — точно как в примере ТЗ.
      if (ri === 0 && pi === 0) {
        avgArpu = 13.6
        marketPenetrationPct = 66.98
        avgTransactionCheck = 272.0
        income = 31157.6
      } else if (ri === 0 && pi === 1) {
        avgArpu = 14.8
        marketPenetrationPct = 67.54
        avgTransactionCheck = 275.0
        income = 32140.0
      } else {
        avgArpu = round2(region.baseArpu * trend * seasonal * noise())
        marketPenetrationPct = round2(
          Math.min(95, region.basePenetration * (0.97 + pi * 0.004) * noise()),
        )
        avgTransactionCheck = round2(region.baseCheck * trend * noise())
        income = round2(region.baseIncome * trend * seasonal * noise())
      }

      rows.push({
        reportPeriod,
        federalDistrict: region.federalDistrict,
        subjectRf: region.subjectRf,
        avgArpu,
        marketPenetrationPct,
        avgTransactionCheck,
        // bankIncomeLag1 — доход предыдущего периода (сдвиг на 1), у первого = null.
        bankIncomeLag1: prevIncome,
      })

      prevIncome = income
    })
  })

  return rows
}

export const DRIVERS: DriverRow[] = generateDrivers()

/** Уникальные субъекты РФ (для выпадающего списка). */
export const DRIVER_SUBJECTS: string[] = DRIVER_REGIONS.map((r) => r.subjectRf)

/** Драйверы по конкретному субъекту, отсортированные по периоду. */
export function driversForSubject(subject: string): DriverRow[] {
  return DRIVERS.filter((r) => r.subjectRf === subject).sort((a, b) =>
    a.reportPeriod.localeCompare(b.reportPeriod),
  )
}

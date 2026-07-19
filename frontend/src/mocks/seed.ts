/* ============================================================
   Генератор синтетики по примеру из кейса (студенческая столовая).
   Формулы (раздел 5 мастер-промпта):
     Доход банка        = Объём транзакций × Тариф(5%)
     Объём транзакций   = Кол-во клиентов × Средняя стоимость обеда
     Кол-во клиентов    = Общее число людей × Доля питающихся
     Общее число людей  = Студенты + Адм. персонал
   Эталон из PDF (один регион, один период):
     3260 + 160 = 3420; 3420 × 67% = 2291; 2291 × 272 = 623 152;
     623 152 × 5% = 31 157,6
   Детерминированный PRNG -> данные стабильны между перезагрузками
   (важно для карты регионов и сравнения сценариев).
   ============================================================ */
import type { FactRow } from '@/shared/lib/api-types'

/** mulberry32 — компактный детерминированный PRNG. */
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

export interface RegionSeed {
  subject: string
  district: string
  baseStudents: number
  baseStaff: number
  baseShare: number // %
  baseMealPrice: number // руб
}

/** 4 субъекта РФ в разных федеральных округах. */
export const REGIONS: RegionSeed[] = [
  { subject: 'Москва', district: 'Центральный', baseStudents: 3260, baseStaff: 160, baseShare: 67, baseMealPrice: 272 },
  { subject: 'Санкт-Петербург', district: 'Северо-Западный', baseStudents: 2480, baseStaff: 120, baseShare: 61, baseMealPrice: 244 },
  { subject: 'Республика Татарстан', district: 'Приволжский', baseStudents: 1890, baseStaff: 95, baseShare: 58, baseMealPrice: 208 },
  { subject: 'Свердловская область', district: 'Уральский', baseStudents: 1620, baseStaff: 80, baseShare: 54, baseMealPrice: 196 },
]

export const TARIFF_PCT = 5

/** Список периодов "YYYY-MM" за 12 месяцев, заканчивая июнем 2026. */
export function buildPeriods(count = 12, endYear = 2026, endMonth = 6): string[] {
  const out: string[] = []
  let y = endYear
  let m = endMonth
  for (let i = 0; i < count; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return out
}

/** Сезонный множитель доли питающихся: лето — спад, сентябрь — пик. */
function seasonalShareFactor(month: number): number {
  // month 1..12
  const byMonth: Record<number, number> = {
    1: 0.96, 2: 1.0, 3: 1.02, 4: 1.01, 5: 0.95, 6: 0.78,
    7: 0.6, 8: 0.66, 9: 1.12, 10: 1.06, 11: 1.03, 12: 0.9,
  }
  return byMonth[month] ?? 1
}

export const INDICATORS = {
  students: { name: 'Студенты', unit: 'чел' },
  staff: { name: 'Административный персонал', unit: 'чел' },
  totalPeople: { name: 'Общее число людей', unit: 'чел' },
  share: { name: 'Доля питающихся в столовой', unit: '%' },
  clients: { name: 'Количество клиентов', unit: 'чел' },
  mealPrice: { name: 'Средняя стоимость обеда', unit: 'руб' },
  txVolume: { name: 'Объём транзакций', unit: 'руб' },
  tariff: { name: 'Тариф', unit: '%' },
  revenue: { name: 'Доход банка', unit: 'руб' },
} as const

/** Генерирует длинный (long) формат фактов по всем регионам и периодам. */
export function generateFacts(periods = buildPeriods()): FactRow[] {
  const rows: FactRow[] = []

  REGIONS.forEach((region, ri) => {
    const rng = makeRng(1000 + ri * 7)
    // лёгкий тренд роста числа студентов год к году
    periods.forEach((period, pi) => {
      const month = Number(period.split('-')[1])
      const trend = 1 + pi * 0.008 // ~+0.8% в месяц
      const noise = () => 1 + (rng() - 0.5) * 0.05

      const students = Math.round(region.baseStudents * trend * noise())
      const staff = Math.round(region.baseStaff * trend * noise())
      const totalPeople = students + staff

      const share = Math.min(
        95,
        Math.max(20, region.baseShare * seasonalShareFactor(month) * noise()),
      )
      const clients = Math.round((totalPeople * share) / 100)

      const mealPrice = Math.round(region.baseMealPrice * trend * noise())
      const txVolume = clients * mealPrice
      const revenue = +(txVolume * (TARIFF_PCT / 100)).toFixed(1)

      const push = (ind: { name: string; unit: string }, value: number) =>
        rows.push({
          period,
          district: region.district,
          subject: region.subject,
          indicator: ind.name,
          unit: ind.unit,
          value,
        })

      push(INDICATORS.students, students)
      push(INDICATORS.staff, staff)
      push(INDICATORS.totalPeople, totalPeople)
      push(INDICATORS.share, +share.toFixed(1))
      push(INDICATORS.clients, clients)
      push(INDICATORS.mealPrice, mealPrice)
      push(INDICATORS.txVolume, txVolume)
      push(INDICATORS.tariff, TARIFF_PCT)
      push(INDICATORS.revenue, revenue)
    })
  })

  return rows
}

/** Полный датасет моков. */
export const FACTS: FactRow[] = generateFacts()
export const PERIODS: string[] = buildPeriods()

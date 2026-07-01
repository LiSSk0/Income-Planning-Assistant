/* Граф бизнес-модели по примеру из кейса (студенческая столовая).
   Узлы — показатели, рёбра подписаны оператором.
   Источники (листья) → производные (isDerived). */
import type { BusinessGraph } from '@/shared/lib/api-types'
import { FACTS, INDICATORS } from './seed'

/** Последнее значение показателя по «эталонному» региону (Москва). */
function latestValue(indicator: string, subject = 'Москва'): number {
  const rows = FACTS.filter((r) => r.indicator === indicator && r.subject === subject)
  if (!rows.length) return 0
  return rows[rows.length - 1].value
}

const I = INDICATORS

export const BUSINESS_GRAPH: BusinessGraph = {
  nodes: [
    { id: 'students', indicator: I.students.name, unit: I.students.unit, currentValue: latestValue(I.students.name), isDerived: false },
    { id: 'staff', indicator: I.staff.name, unit: I.staff.unit, currentValue: latestValue(I.staff.name), isDerived: false },
    { id: 'totalPeople', indicator: I.totalPeople.name, unit: I.totalPeople.unit, currentValue: latestValue(I.totalPeople.name), isDerived: true },
    { id: 'share', indicator: I.share.name, unit: I.share.unit, currentValue: latestValue(I.share.name), isDerived: false },
    { id: 'clients', indicator: I.clients.name, unit: I.clients.unit, currentValue: latestValue(I.clients.name), isDerived: true },
    { id: 'mealPrice', indicator: I.mealPrice.name, unit: I.mealPrice.unit, currentValue: latestValue(I.mealPrice.name), isDerived: false },
    { id: 'txVolume', indicator: I.txVolume.name, unit: I.txVolume.unit, currentValue: latestValue(I.txVolume.name), isDerived: true },
    { id: 'tariff', indicator: I.tariff.name, unit: I.tariff.unit, currentValue: latestValue(I.tariff.name), isDerived: false },
    { id: 'revenue', indicator: I.revenue.name, unit: I.revenue.unit, currentValue: latestValue(I.revenue.name), isDerived: true },
  ],
  edges: [
    { id: 'e-students-total', source: 'students', target: 'totalPeople', operator: '+' },
    { id: 'e-staff-total', source: 'staff', target: 'totalPeople', operator: '+' },
    { id: 'e-total-clients', source: 'totalPeople', target: 'clients', operator: '%' },
    { id: 'e-share-clients', source: 'share', target: 'clients', operator: '%' },
    { id: 'e-clients-tx', source: 'clients', target: 'txVolume', operator: '*' },
    { id: 'e-meal-tx', source: 'mealPrice', target: 'txVolume', operator: '*' },
    { id: 'e-tx-revenue', source: 'txVolume', target: 'revenue', operator: '*' },
    { id: 'e-tariff-revenue', source: 'tariff', target: 'revenue', operator: '%' },
  ],
}

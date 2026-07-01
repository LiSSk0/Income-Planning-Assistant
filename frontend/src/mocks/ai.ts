/* Моки AI-блока: новости (коррелируют с периодами графика) и
   резюме аномалий (вычисляется из фактических рядов дохода). */
import type { AnomalyCard, NewsCard } from '@/shared/lib/api-types'
import { FACTS, PERIODS, REGIONS, INDICATORS } from './seed'
import { formatPeriodFull, formatPercent } from '@/shared/lib/format'

/** Находит заметные скачки/просадки дохода по регионам (>|12%| м/м). */
export function detectAnomalies(indicator = INDICATORS.revenue.name): AnomalyCard[] {
  const out: AnomalyCard[] = []
  REGIONS.forEach((region) => {
    const series = PERIODS.map((period) => ({
      period,
      value:
        FACTS.find(
          (r) => r.period === period && r.subject === region.subject && r.indicator === indicator,
        )?.value ?? 0,
    }))
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1].value
      const cur = series[i].value
      if (prev <= 0) continue
      const dev = ((cur - prev) / prev) * 100
      if (Math.abs(dev) >= 12) {
        const direction = dev > 0 ? 'up' : 'down'
        out.push({
          id: `an-${region.subject}-${series[i].period}`,
          indicator,
          period: series[i].period,
          subject: region.subject,
          deviationPct: +dev.toFixed(1),
          direction,
          text:
            `${formatPeriodFull(series[i].period)}: «${indicator}» в регионе ` +
            `${region.subject} ${direction === 'up' ? 'вырос' : 'снизился'} на ` +
            `${formatPercent(dev)} к предыдущему периоду.`,
        })
      }
    }
  })
  return out.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct)).slice(0, 8)
}

/** Новостные карточки, привязанные к периодам с аномалиями.
 *  Корреляция приблизительная — поле presumed=true. */
export const NEWS: NewsCard[] = [
  {
    id: 'n1',
    title: 'Старт учебного года: вузы вернулись к очному формату',
    source: 'РБК',
    date: '2025-09',
    url: 'https://example.com/news/semester-start',
    summary:
      'Начало семестра традиционно повышает посещаемость студенческих столовых — рост числа клиентов в сентябре.',
    relatedPeriod: '2025-09',
    impact: 'positive',
    presumed: true,
  },
  {
    id: 'n2',
    title: 'Летние каникулы снизили трафик общепита у вузов',
    source: 'Коммерсантъ',
    date: '2025-07',
    url: 'https://example.com/news/summer-break',
    summary:
      'В июле–августе доля питающихся в студенческих столовых падает из-за каникул и практик.',
    relatedPeriod: '2025-07',
    impact: 'negative',
    presumed: true,
  },
  {
    id: 'n3',
    title: 'Индексация цен на продукты повлияла на средний чек',
    source: 'Ведомости',
    date: '2026-01',
    url: 'https://example.com/news/food-prices',
    summary:
      'Рост закупочных цен после новогодних праздников отразился на средней стоимости обеда.',
    relatedPeriod: '2026-01',
    impact: 'positive',
    presumed: true,
  },
  {
    id: 'n4',
    title: 'Безналичная оплата в общепите выросла за год',
    source: 'Frank Media',
    date: '2026-03',
    url: 'https://example.com/news/cashless',
    summary:
      'Доля карточных транзакций в студенческом сегменте продолжает расти, что повышает объём комиссионных доходов банка.',
    impact: 'positive',
    presumed: false,
  },
]

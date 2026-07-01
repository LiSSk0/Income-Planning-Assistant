import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardBody, Tag } from '@/shared/ui'
import { formatPeriod, formatPeriodFull } from '@/shared/lib/format'
import type { NewsCard } from '@/shared/lib/api-types'

const IMPACT: Record<NewsCard['impact'], { tone: 'green' | 'red' | 'blue'; label: string }> = {
  positive: { tone: 'green', label: 'рост' },
  negative: { tone: 'red', label: 'спад' },
  neutral: { tone: 'blue', label: 'нейтрально' },
}

interface Props {
  news: NewsCard
}

/** Карточка новости: связь внешнего события с динамикой показателя. */
export function NewsCardItem({ news }: Props) {
  const impact = IMPACT[news.impact]
  const TrendIcon =
    news.impact === 'positive' ? TrendingUp : news.impact === 'negative' ? TrendingDown : Minus

  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold leading-snug text-text-primary">{news.title}</h4>
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
            aria-label="Открыть источник в новой вкладке"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-1.5 flex items-center gap-2 text-xs text-text-muted">
          <span>{news.source}</span>
          <span aria-hidden>·</span>
          <span className="tabular">{formatPeriod(news.date)}</span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-text-secondary">{news.summary}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Tag tone={impact.tone}>
            <TrendIcon className="h-3 w-3" />
            {impact.label}
          </Tag>
          {news.relatedPeriod && (
            <Tag tone="neutral">связано с периодом: {formatPeriodFull(news.relatedPeriod)}</Tag>
          )}
          {news.presumed && <Tag tone="amber">предположительно</Tag>}
        </div>
      </CardBody>
    </Card>
  )
}

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardBody } from '@/shared/ui'
import { cn } from '@/shared/lib/cn'
import { formatPeriodFull, formatPercent } from '@/shared/lib/format'
import type { AnomalyCard } from '@/shared/lib/api-types'

interface Props {
  anomaly: AnomalyCard
}

/** Карточка аномалии: где и насколько показатель отклонился от тренда. */
export function AnomalyCardItem({ anomaly }: Props) {
  const isUp = anomaly.direction === 'up'
  const Arrow = isUp ? ArrowUpRight : ArrowDownRight

  return (
    <Card
      className={cn(
        'border-l-4',
        isUp ? 'border-l-accent-green' : 'border-l-accent-red',
      )}
    >
      <CardBody className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-text-primary">{anomaly.indicator}</h4>
            <p className="mt-0.5 text-xs text-text-muted">
              {anomaly.subject} · <span className="tabular">{formatPeriodFull(anomaly.period)}</span>
            </p>
          </div>
          <div
            className={cn(
              'flex shrink-0 items-center gap-1 text-sm font-semibold tabular',
              isUp ? 'text-accent-green' : 'text-accent-red',
            )}
          >
            <Arrow className="h-4 w-4" />
            {formatPercent(anomaly.deviationPct)}
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-text-secondary">{anomaly.text}</p>
      </CardBody>
    </Card>
  )
}

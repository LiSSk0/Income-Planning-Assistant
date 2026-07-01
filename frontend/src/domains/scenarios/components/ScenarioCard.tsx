import { Card, CardBody, CardHeader, Tag, StatusPill, Skeleton } from '@/shared/ui'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import type { Scenario, ScenarioKind } from '@/shared/lib/api-types'

/* Карточка одного сценария: тип (Tag), статус (StatusPill),
   ключевые драйверы с мини-баром вклада и последнее значение показателя. */

const KIND_TONE: Record<ScenarioKind, 'lime' | 'green' | 'amber' | 'blue' | 'neutral'> = {
  ai: 'lime',
  optimistic: 'green',
  conservative: 'amber',
  base: 'blue',
  custom: 'neutral',
}

const KIND_LABEL: Record<ScenarioKind, string> = {
  ai: 'AI',
  optimistic: 'Оптимистичный',
  conservative: 'Консервативный',
  base: 'Базовый',
  custom: 'Пользовательский',
}

function lastValue(scenario: Scenario): number {
  return scenario.series.at(-1)?.value ?? 0
}

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const pending = scenario.status === 'queued' || scenario.status === 'computing'
  const failed = scenario.status === 'failed'
  const last = lastValue(scenario)
  const topDrivers = [...scenario.drivers]
    .sort((a, b) => b.contributionPct - a.contributionPct)
    .slice(0, 4)
  const maxContribution = Math.max(1, ...topDrivers.map((d) => d.contributionPct))

  return (
    <Card className={cn('flex h-full flex-col', failed && 'border-accent-red/30')}>
      <CardHeader className="flex items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-text-primary">{scenario.title}</h3>
            <Tag tone={KIND_TONE[scenario.kind]}>{KIND_LABEL[scenario.kind]}</Tag>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{scenario.description}</p>
        </div>
        <StatusPill status={scenario.status} />
      </CardHeader>

      <CardBody className="flex flex-1 flex-col gap-3 pt-1">
        {pending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ) : (
          <>
            <div>
              <div className="text-xs uppercase tracking-wide text-text-muted">
                Последнее значение
              </div>
              <div className="tabular mt-0.5 text-lg font-semibold text-text-primary">
                {failed ? '—' : formatNumber(last, 0)}
                {!failed && <span className="ml-1 text-xs text-text-secondary">руб</span>}
              </div>
            </div>

            {topDrivers.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs uppercase tracking-wide text-text-muted">
                  Ключевые драйверы
                </div>
                {topDrivers.map((d) => (
                  <div key={d.indicator} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-text-secondary">{d.indicator}</span>
                      <span className="tabular shrink-0 text-text-primary">{d.contributionPct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-white/5">
                      <div
                        className="h-full rounded-pill bg-accent-green/70"
                        style={{ width: `${(d.contributionPct / maxContribution) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

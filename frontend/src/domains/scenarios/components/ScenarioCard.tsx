// src/domains/scenarios/components/ScenarioCard.tsx
import { Card, CardBody, CardHeader, Tag, StatusPill, Skeleton, Checkbox } from '@/shared/ui'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { Trash2 } from 'lucide-react'
import type { Scenario, ScenarioKind } from '@/shared/lib/api-types'

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

interface Props {
    scenario: Scenario
    selected?: boolean
    onToggleSelect?: () => void
    onDelete?: () => void
    isActive?: boolean
}

function lastValue(scenario: Scenario): number {
    if (!scenario.regionForecasts) return 0
    const regions = Object.keys(scenario.regionForecasts)
    if (regions.length === 0) return 0
    const models = scenario.regionForecasts[regions[0]]
    if (!models || models.length === 0) return 0
    const forecast = models[0]?.forecast
    if (!forecast) return 0
    const periods = Object.keys(forecast).sort()
    if (periods.length === 0) return 0
    return forecast[periods[periods.length - 1]] || 0
}

export function ScenarioCard({ scenario, selected, onToggleSelect, onDelete, isActive }: Props) {
    const pending = scenario.status === 'queued' || scenario.status === 'computing'
    const failed = scenario.status === 'failed'
    const last = lastValue(scenario)
    const topDrivers = [...(scenario.drivers || [])]
        .sort((a, b) => b.contributionPct - a.contributionPct)
        .slice(0, 3)
    const maxContribution = Math.max(1, ...topDrivers.map((d) => d.contributionPct))

    return (
        <Card
            className={cn(
                'flex h-full flex-col transition-all',
                failed && 'border-accent-red/30',
                isActive && 'ring-2 ring-accent-lime'
            )}
        >
            <CardHeader className="flex items-start justify-between gap-2 pb-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        {onToggleSelect && (
                            <Checkbox
                                checked={selected}
                                onChange={onToggleSelect}
                                className="shrink-0"
                            />
                        )}
                        <h3 className="truncate text-base font-bold text-text-primary break-words">
                            {scenario.title}
                        </h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Tag tone={KIND_TONE[scenario.kind] || 'neutral'}>
                            {KIND_LABEL[scenario.kind] || 'Пользовательский'}
                        </Tag>
                        <p className="line-clamp-2 text-xs text-text-secondary">{scenario.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <StatusPill status={scenario.status} />
                    {onDelete && scenario.status === 'ready' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete()
                            }}
                            className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-accent-red"
                            aria-label="Удалить сценарий"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </CardHeader>

            <CardBody className="flex flex-1 flex-col gap-2 pt-1">
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
                                            <span className="tabular shrink-0 text-text-primary">
                                                {d.contributionPct}%
                                            </span>
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
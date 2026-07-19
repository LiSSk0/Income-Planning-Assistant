// src/domains/scenarios/components/ScenarioDrivers.tsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Skeleton, EmptyState } from '@/shared/ui'
import { api } from '@/shared/lib/api'
import { formatPercent } from '@/shared/lib/format'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'

interface Props {
    scenarioId: string
    region: string
    targetIndicator: string
}

export function ScenarioDrivers({ scenarioId, region, targetIndicator }: Props) {
    const reduced = usePrefersReducedMotion()
    const [drivers, setDrivers] = useState<Record<string, number> | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!scenarioId || !region) return
        setLoading(true)
        setError(null)
        api.getScenarioDrivers(scenarioId, region)
            .then(data => setDrivers(data))
            .catch(err => setError(err.message || 'Ошибка загрузки драйверов'))
            .finally(() => setLoading(false))
    }, [scenarioId, region])

    if (loading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-5/6" />
                <Skeleton className="h-10 w-4/6" />
            </div>
        )
    }

    if (error) {
        return (
            <EmptyState
                icon={<Minus className="h-8 w-8" />}
                title="Драйверы недоступны"
                description={error}
            />
        )
    }

    if (!drivers || Object.keys(drivers).length === 0) {
        return (
            <EmptyState
                icon={<Minus className="h-8 w-8" />}
                title="Нет данных о драйверах"
                description="Для выбранного региона и показателя драйверы не найдены"
            />
        )
    }

    // Сортируем по абсолютному вкладу
    const sortedEntries = Object.entries(drivers)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))

    return (
        <div className="space-y-4">
            <p className="text-xs text-text-secondary">
                Вклад факторов в изменение показателя <strong>{targetIndicator}</strong> за прогнозный период
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {sortedEntries.map(([indicator, contribution], index) => {
                    const isPositive = contribution >= 0
                    const Icon = isPositive ? TrendingUp : TrendingDown
                    const color = isPositive ? 'text-accent-green' : 'text-accent-red'
                    const barColor = isPositive ? '#21A038' : '#FF6B6B'

                    return (
                        <motion.div
                            key={indicator}
                            initial={reduced ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="rounded-card border border-border bg-bg-elevated p-3"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Icon className={`h-4 w-4 ${color} shrink-0`} />
                                    <span className="truncate text-sm text-text-primary">{indicator}</span>
                                </div>
                                <span className={`text-sm font-semibold tabular ${color}`}>
                                    {formatPercent(contribution)}
                                </span>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-white/5">
                                <div
                                    className="h-full rounded-pill transition-all duration-500"
                                    style={{
                                        width: `${Math.min(Math.abs(contribution), 100)}%`,
                                        background: barColor,
                                    }}
                                />
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            <p className="text-xs text-text-muted">
                Сумма вкладов может не равняться 100% из-за взаимодействия факторов
            </p>
        </div>
    )
}
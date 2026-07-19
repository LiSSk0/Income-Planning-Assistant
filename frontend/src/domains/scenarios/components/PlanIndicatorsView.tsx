import { useEffect, useMemo, useState } from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Legend,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle, Select, EmptyState } from '@/shared/ui'
import { chartTheme } from '@/shared/ui/chartTheme'
import { formatNumber, formatPeriod, formatPercent } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import type { Scenario } from '@/shared/lib/api-types'

interface Props {
    scenarios: Scenario[]
}

const SHORT: Record<string, string> = {
    Студенты: 'Студенты',
    'Административный персонал': 'Адм. персонал',
    'Общее число людей': 'Общее число',
    'Доля питающихся в столовой': 'Доля питающ.',
    'Количество клиентов': 'Клиенты',
    'Средняя стоимость обеда': 'Сред. чек',
    'Объём транзакций': 'Объём транз.',
    Тариф: 'Тариф',
    'Доход банка': 'Доход',
}

const PALETTE = [
    chartTheme.lime,
    chartTheme.green,
    chartTheme.blue,
    chartTheme.amber,
    chartTheme.red,
    '#9B8CFF',
    '#7DD3FC',
    '#F59E0B',
    '#34D399',
]

const short = (name: string) => SHORT[name] ?? name

export function PlanIndicatorsView({ scenarios }: Props) {
    const reduced = usePrefersReducedMotion()

    const ready = useMemo(
        () =>
            scenarios.filter(
                (s) => s.status === 'ready' && s.seriesByIndicator && Object.keys(s.seriesByIndicator).length > 0,
            ),
        [scenarios],
    )

    const [planId, setPlanId] = useState<string>('')
    const plan = useMemo(() => ready.find((s) => s.id === planId) ?? ready[0], [ready, planId])

    const allIndicators = useMemo(
        () => (plan?.seriesByIndicator ? Object.keys(plan.seriesByIndicator) : []),
        [plan],
    )

    const colorOf = useMemo(() => {
        const map: Record<string, string> = {}
        allIndicators.forEach((ind, i) => (map[ind] = PALETTE[i % PALETTE.length]))
        return map
    }, [allIndicators])

    const [selected, setSelected] = useState<Set<string>>(new Set())
    useEffect(() => {
        setSelected(new Set(allIndicators))
    }, [allIndicators])

    const toggle = (ind: string) =>
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(ind)) next.delete(ind)
            else next.add(ind)
            return next
        })

    const shown = allIndicators.filter((ind) => selected.has(ind))

    const lineData = useMemo(() => {
        if (!plan?.seriesByIndicator) return []
        const periods = plan.series.map((p) => p.period)
        return periods.map((period, i) => {
            const row: Record<string, string | number> = { period: formatPeriod(period) }
            shown.forEach((ind) => {
                const s = plan.seriesByIndicator![ind]
                const base = s?.[0]?.value ?? 0
                const val = s?.[i]?.value ?? 0
                row[ind] = base ? +((val / base) * 100).toFixed(1) : 0
            })
            return row
        })
    }, [plan, shown])

    const barData = useMemo(() => {
        if (!plan?.seriesByIndicator) return []
        return shown.map((ind) => {
            const s = plan.seriesByIndicator![ind]
            const first = s?.[0]?.value ?? 0
            const last = s?.at(-1)?.value ?? 0
            const growth = first ? +(((last - first) / first) * 100).toFixed(1) : 0
            return { indicator: short(ind), full: ind, growth }
        })
    }, [plan, shown])

    if (ready.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Прогноз по показателям</CardTitle>
                </CardHeader>
                <CardBody>
                    <EmptyState
                        icon={<LineChartIcon className="h-8 w-8" />}
                        title="Нет готового плана"
                        description="Сгенерируйте план в форме слева — он спрогнозирует все показатели, и здесь можно будет выбрать их чекбоксами."
                    />
                </CardBody>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Прогноз по показателям</CardTitle>
                {ready.length > 1 && (
                    <div className="w-60">
                        <Select
                            value={plan?.id ?? ''}
                            onChange={(e) => setPlanId(e.target.value)}
                            aria-label="План для разбора по показателям"
                        >
                            {ready.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.title}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}
            </CardHeader>
            <CardBody className="space-y-5">
                {/* Чекбоксы показателей — управляют и графиком, и диаграммой */}
                <div className="flex flex-wrap gap-2">
                    {allIndicators.map((ind) => {
                        const on = selected.has(ind)
                        return (
                            <label
                                key={ind}
                                className={cn(
                                    'flex cursor-pointer items-center gap-2 rounded-pill border px-3 py-1.5 text-xs transition-colors',
                                    on
                                        ? 'border-border-strong bg-surface-hover text-text-primary'
                                        : 'border-border text-text-muted',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-accent-green"
                                    checked={on}
                                    onChange={() => toggle(ind)}
                                />
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ background: colorOf[ind], opacity: on ? 1 : 0.3 }}
                                    aria-hidden
                                />
                                {short(ind)}
                            </label>
                        )
                    })}
                </div>

                {shown.length === 0 ? (
                    <EmptyState
                        icon={<LineChartIcon className="h-8 w-8" />}
                        title="Показатели не выбраны"
                        description="Отметьте чекбоксами хотя бы один показатель, чтобы построить график и диаграмму."
                    />
                ) : (
                    <>
                        {/* График динамики (индекс к началу = 100) */}
                        <div>
                            <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
                                Динамика (индекс к началу периода = 100)
                            </p>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={lineData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                                        <XAxis dataKey="period" {...chartTheme.axis} />
                                        <YAxis {...chartTheme.axis} width={48} tickFormatter={(v) => formatNumber(v, 0)} />
                                        <Tooltip
                                            {...chartTheme.tooltip}
                                            formatter={(v: number, name: string) => [formatNumber(v, 1), short(name)]}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: 12, color: chartTheme.axis.tick.fill }}
                                            formatter={(name: string) => short(name)}
                                        />
                                        {shown.map((ind) => (
                                            <Line
                                                key={ind}
                                                type="monotone"
                                                dataKey={ind}
                                                name={ind}
                                                stroke={colorOf[ind]}
                                                strokeWidth={2}
                                                dot={false}
                                                isAnimationActive={!reduced}
                                                animationDuration={reduced ? 0 : 500}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Диаграмма прироста за период */}
                        <div>
                            <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
                                Прирост за период, %
                            </p>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                        <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                                        <XAxis dataKey="indicator" {...chartTheme.axis} />
                                        <YAxis {...chartTheme.axis} width={48} tickFormatter={(v) => formatNumber(v, 1)} />
                                        <Tooltip
                                            {...chartTheme.tooltip}
                                            formatter={(v: number) => [formatPercent(v), 'Прирост']}
                                        />
                                        <Bar dataKey="growth" radius={[3, 3, 0, 0]}>
                                            {barData.map((d) => (
                                                <Cell
                                                    key={d.full}
                                                    fill={d.growth >= 0 ? chartTheme.green : chartTheme.red}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}
            </CardBody>
        </Card>
    )
}
import { useEffect, useMemo, useState } from 'react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Customized,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { Card, CardBody, CardHeader, CardTitle, Select, Tag, Skeleton } from '@/shared/ui'
import { chartTheme } from '@/shared/ui/chartTheme'
import { formatNumber } from '@/shared/lib/format'
import { api } from '@/shared/lib/api'
import { useDatasetStore } from '@/shared/store/useDatasetStore'

const YEAR_COLOR: Record<string, string> = {
    '2024': chartTheme.blue,
    '2025': chartTheme.red,
    '2026': chartTheme.green,
}

interface ConfidenceBoxProps {
    xAxisMap?: Record<string, any>
    yAxisMap?: Record<string, any>
    lower?: number
    upper?: number
    targetKey?: string
}

function ConfidenceBox({ xAxisMap, yAxisMap, lower, upper, targetKey }: ConfidenceBoxProps) {
    if (!xAxisMap || !yAxisMap || lower === undefined || upper === undefined) return null

    const xAxis = Object.values(xAxisMap)[0]
    const yAxis = Object.values(yAxisMap)[0]
    if (!xAxis || !yAxis) return null

    const bandwidth = xAxis.scale.bandwidth ? xAxis.scale.bandwidth() : 0
    const xCenter = xAxis.scale(targetKey ?? '') + bandwidth / 2
    const boxWidth = bandwidth * 0.9
    const yTop = yAxis.scale(upper)
    const yBottom = yAxis.scale(lower)

    return (
        <rect
            x={xCenter - boxWidth / 2}
            y={yTop}
            width={boxWidth}
            height={Math.max(yBottom - yTop, 1)}
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            rx={2}
        />
    )
}

export function YoYStdChart() {
    const { indicators, subjects, loadFacts } = useDatasetStore()
    const [indicatorName, setIndicatorName] = useState<string>('')
    const [subject, setSubject] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<{
        regions: { subject: string; y2024: number; y2025: number; y2026: number; lower: number; upper: number }[]
        sigma: number
        confidence: number
        unit: string
    } | null>(null)

    useEffect(() => {
        loadFacts()
    }, [])

    useEffect(() => {
        if (indicators.length > 0 && !indicatorName) setIndicatorName(indicators[0])
        if (subjects.length > 0 && !subject) setSubject(subjects[0])
    }, [indicators, subjects])

    useEffect(() => {
        if (!indicatorName || !subject) return

        setLoading(true)
        const fetchYoY = async () => {
            try {
                const facts = await api.getFacts()
                const filtered = facts.filter(f => f.indicator === indicatorName && f.subject === subject)
                if (filtered.length === 0) {
                    setData({
                        regions: [{ subject, y2024: 0, y2025: 0, y2026: 0, lower: 0, upper: 0 }],
                        sigma: 0,
                        confidence: 95,
                        unit: 'руб',
                    })
                    setLoading(false)
                    return
                }

                const byYear: Record<string, number[]> = {}
                for (const f of filtered) {
                    const year = f.period.split('-')[0]
                    if (!byYear[year]) byYear[year] = []
                    byYear[year].push(f.value)
                }

                const years = Object.keys(byYear).sort()
                const lastThree = years.slice(-3)

                const getAvg = (year: string) => {
                    if (!byYear[year]) return 0
                    return byYear[year].reduce((a, b) => a + b, 0) / byYear[year].length
                }

                const y2024 = lastThree[0] ? getAvg(lastThree[0]) : 0
                const y2025 = lastThree[1] ? getAvg(lastThree[1]) : 0
                const y2026 = lastThree[2] ? getAvg(lastThree[2]) : 0

                const allValues = filtered.map(f => f.value)
                const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length
                const std = Math.sqrt(allValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allValues.length)
                const sigma = std
                const confidence = 95
                const z = 1.96
                const se = sigma / Math.sqrt(allValues.length)
                const lower = y2026 - z * se
                const upper = y2026 + z * se

                setData({
                    regions: [{
                        subject,
                        y2024,
                        y2025,
                        y2026,
                        lower: y2026 - z * sigma,
                        upper: y2026 + z * sigma,
                    }],
                    sigma,
                    confidence,
                    unit: filtered[0]?.unit || 'руб',
                })
            } catch {
                setData({
                    regions: [{ subject, y2024: 0, y2025: 0, y2026: 0, lower: 0, upper: 0 }],
                    sigma: 0,
                    confidence: 95,
                    unit: 'руб',
                })
            } finally {
                setLoading(false)
            }
        }

        fetchYoY()
    }, [indicatorName, subject])

    const region = data?.regions[0]

    const chartData = useMemo(() => {
        if (!region) return []
        return [
            { year: '2024', value: region.y2024 },
            { year: '2025', value: region.y2025 },
            { year: '2026', value: region.y2026 },
        ]
    }, [region])

    if (loading) {
        return (
            <Card>
                <CardHeader><CardTitle>Расчёт СКО для прогнозируемого показателя</CardTitle></CardHeader>
                <CardBody><Skeleton className="h-80 w-full" /></CardBody>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                    <CardTitle>Расчёт СКО для прогнозируемого показателя</CardTitle>
                    <div className="w-48">
                        <Select
                            value={indicatorName}
                            onChange={e => setIndicatorName(e.target.value)}
                            aria-label="Выбор показателя"
                        >
                            {indicators.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                        </Select>
                    </div>
                    <div className="w-48">
                        <Select
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            aria-label="Выбор региона"
                        >
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </div>
                </div>
                {data && (
                    <div className="flex items-center gap-2">
                        <Tag tone="lime">σ = {formatNumber(data.sigma, 0)} {data.unit}</Tag>
                        <Tag tone="neutral">доверие {data.confidence}%</Tag>
                    </div>
                )}
            </CardHeader>
            <CardBody>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
                            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                            <XAxis dataKey="year" {...chartTheme.axis} />
                            <YAxis {...chartTheme.axis} width={72} tickFormatter={v => formatNumber(v, 0)} />
                            <Tooltip
                                {...chartTheme.tooltip}
                                formatter={(v: number) => [formatNumber(v, 0) + ' ' + (data?.unit || 'руб'), indicatorName]}
                            />
                            <Bar dataKey="value" radius={[3, 3, 0, 0]} label={{ position: 'top', fill: 'var(--text-primary)', fontSize: 11 }}>
                                {chartData.map((d) => (
                                    <Cell key={d.year} fill={YEAR_COLOR[d.year] || chartTheme.blue} />
                                ))}
                            </Bar>
                            {region && (
                                <Customized
                                    component={(props: any) => (
                                        <ConfidenceBox
                                            {...props}
                                            lower={region.lower}
                                            upper={region.upper}
                                            targetKey="2026"
                                        />
                                    )}
                                />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="mt-3 text-xs text-text-muted">
                    {region?.subject}: синий — 2024, красный — 2025, зелёный — прогноз 2026.
                    Показатель: {indicatorName} ({data?.unit}). Доверие {data?.confidence}%.
                    Пунктирная рамка на прогнозе — диапазон реального значения.
                </p>
            </CardBody>
        </Card>
    )
}
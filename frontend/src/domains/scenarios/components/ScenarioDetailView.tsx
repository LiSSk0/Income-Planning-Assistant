// src/domains/scenarios/components/ScenarioDetailView.tsx
import { useMemo, useState, useEffect } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Bar,
    ReferenceLine,
    Cell,
    Customized,
} from 'recharts'
import { Card, CardBody, CardHeader, CardTitle, Select, Tag, Checkbox, Input } from '@/shared/ui'
import { chartTheme } from '@/shared/ui/chartTheme'
import { formatPeriod, formatNumber } from '@/shared/lib/format'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { useScenarioStore } from '../store/useScenarioStore'
import { RussiaMap } from '@/domains/overview/components/RussiaMap'
import { ScenarioDrivers } from './ScenarioDrivers'
import type { Scenario } from '@/shared/lib/api-types'

interface Props {
    scenario: Scenario
}

// Расширенная палитра
const COLORS = [
    '#4FC3F7',
    '#FF6B6B',
    '#C8E04B',
    '#F2C94C',
    '#9B8CFF',
    '#21A038',
    '#FF8A65',
    '#7DD3FC',
    '#34D399',
    '#F472B6',
]

export function ScenarioDetailView({ scenario }: Props) {
    const reduced = usePrefersReducedMotion()
    const { visibleYears, setVisibleYears } = useScenarioStore()

    const regions = scenario.regions || []

    const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set())
    const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())

    // ===== РАЗДЕЛЬНЫЕ СОСТОЯНИЯ ДЛЯ СКО И ДРАЙВЕРОВ =====
    const [selectedStdRegion, setSelectedStdRegion] = useState<string>(regions[0] || '')
    const [selectedStdModel, setSelectedStdModel] = useState<string>('')
    const [stdVisibleYears, setStdVisibleYears] = useState<number>(3)
    const [confidenceZ, setConfidenceZ] = useState<number>(1.96)

    const [selectedDriversRegion, setSelectedDriversRegion] = useState<string>(regions[0] || '')

    const [selectedMapModel, setSelectedMapModel] = useState<string>('')
    const [initialized, setInitialized] = useState(false)

    const allModels = useMemo(() => {
        if (!scenario.regionForecasts || regions.length === 0) return []
        const firstRegion = regions[0]
        const models = scenario.regionForecasts[firstRegion] || []
        return models.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    }, [scenario.regionForecasts, regions])

    useEffect(() => {
        if (!scenario.id || initialized) return

        const defaultRegions = new Set(regions.slice(0, Math.min(3, regions.length)))
        setSelectedRegions(defaultRegions)

        const bestModel = allModels.find(m => m.rank === 1) || allModels[0]
        if (bestModel) {
            setSelectedModels(new Set([bestModel.name]))
            setSelectedStdModel(bestModel.name)
            setSelectedMapModel(bestModel.name)
        }

        if (regions.length > 0) {
            setSelectedStdRegion(regions[0])
            setSelectedDriversRegion(regions[0])
        }

        setInitialized(true)
    }, [scenario.id, regions, allModels, initialized])

    useEffect(() => {
        setInitialized(false)
    }, [scenario.id])

    const maxYears = useMemo(() => {
        let maxPeriods = 0
        if (scenario.historyByRegion) {
            for (const history of Object.values(scenario.historyByRegion)) {
                if (history && history.length > maxPeriods) {
                    maxPeriods = history.length
                }
            }
        }

        let forecastYears = 0
        if (scenario.regionForecasts && regions.length > 0) {
            for (const region of regions) {
                const models = scenario.regionForecasts[region] || []
                for (const model of models) {
                    if (model && model.forecast) {
                        const periods = Object.keys(model.forecast)
                        if (periods.length > 0) {
                            const first = new Date(periods[0])
                            const last = new Date(periods[periods.length - 1])
                            const years = last.getFullYear() - first.getFullYear() + 1
                            if (years > forecastYears) forecastYears = years
                        }
                    }
                }
            }
        }

        const historyYears = Math.max(1, Math.ceil(maxPeriods / 12))
        return Math.max(1, historyYears + forecastYears + 1)
    }, [scenario.historyByRegion, scenario.regionForecasts, regions])

    // ===== ГРАФИК =====
    const chartData = useMemo(() => {
        if (!scenario.regionForecasts || !scenario.historyByRegion) return []
        const targetRegions = Array.from(selectedRegions)
        if (targetRegions.length === 0) return []
        const modelNames = Array.from(selectedModels)
        if (modelNames.length === 0) return []

        const allPeriods = new Set<string>()
        const historyMap: Record<string, Record<string, number>> = {}
        const forecastMap: Record<string, Record<string, Record<string, number>>> = {}

        const lastHistoryByRegion: Record<string, { period: string; value: number }> = {}

        for (const region of targetRegions) {
            const history = scenario.historyByRegion[region] || []
            historyMap[region] = {}
            let lastPeriod: string | null = null
            let lastValue: number | null = null
            for (const point of history) {
                historyMap[region][point.period] = point.value
                allPeriods.add(point.period)
                if (!lastPeriod || point.period > lastPeriod) {
                    lastPeriod = point.period
                    lastValue = point.value
                }
            }
            if (lastPeriod && lastValue !== null) {
                lastHistoryByRegion[region] = { period: lastPeriod, value: lastValue }
            }
        }

        for (const region of targetRegions) {
            const models = scenario.regionForecasts[region] || []
            forecastMap[region] = {}
            for (const modelName of modelNames) {
                forecastMap[region][modelName] = {}
                const model = models.find(m => m.name === modelName)
                if (model && model.forecast) {
                    for (const [period, value] of Object.entries(model.forecast)) {
                        forecastMap[region][modelName][period] = value
                        allPeriods.add(period)
                    }
                }
            }
        }

        const sortedPeriods = Array.from(allPeriods).sort()

        let firstForecastPeriod: string | null = null
        for (const period of sortedPeriods) {
            for (const region of targetRegions) {
                if (forecastMap[region]) {
                    for (const modelName of modelNames) {
                        if (forecastMap[region][modelName]?.[period] !== undefined) {
                            firstForecastPeriod = period
                            break
                        }
                    }
                }
                if (firstForecastPeriod) break
            }
            if (firstForecastPeriod) break
        }

        if (!firstForecastPeriod) {
            const now = new Date()
            const currentYear = now.getFullYear()
            const cutoffYear = currentYear - visibleYears + 1
            return sortedPeriods
                .filter(p => parseInt(p.split('-')[0]) >= cutoffYear)
                .map(period => {
                    const row: any = { period: formatPeriod(period), _raw: period }
                    for (const region of targetRegions) {
                        if (historyMap[region] && historyMap[region][period] !== undefined) {
                            row[`История (${region})`] = historyMap[region][period]
                        }
                    }
                    return row
                })
        }

        let maxYear = 0
        for (const period of sortedPeriods) {
            const year = parseInt(period.split('-')[0])
            if (year > maxYear) maxYear = year
        }

        let minYear = maxYear
        for (const period of sortedPeriods) {
            const year = parseInt(period.split('-')[0])
            if (year < minYear) minYear = year
        }

        const visibleYearsSafe = Math.max(1, visibleYears || 1)
        const cutoffYear = Math.max(minYear, maxYear - visibleYearsSafe + 1)

        const filteredPeriods = sortedPeriods.filter(period => {
            const year = parseInt(period.split('-')[0])
            return year >= cutoffYear
        })

        return filteredPeriods.map(period => {
            const row: any = {
                period: formatPeriod(period),
                _raw: period,
            }

            for (const region of targetRegions) {
                if (historyMap[region] && historyMap[region][period] !== undefined) {
                    row[`История (${region})`] = historyMap[region][period]
                }
            }

            for (const region of targetRegions) {
                for (const modelName of modelNames) {
                    const key = `${region} (${modelName})`
                    if (forecastMap[region]?.[modelName]?.[period] !== undefined) {
                        row[key] = forecastMap[region][modelName][period]
                    } else if (lastHistoryByRegion[region] && lastHistoryByRegion[region].period === period) {
                        row[key] = lastHistoryByRegion[region].value
                    } else {
                        row[key] = null
                    }
                }
            }

            if (period === firstForecastPeriod) {
                row.isForecastStart = true
            }

            return row
        })
    }, [scenario, selectedRegions, selectedModels, visibleYears])

    // ===== СКО =====
    const stdChartData = useMemo(() => {
        if (!scenario.regionForecasts || !scenario.historyByRegion || !selectedStdRegion || !selectedStdModel) return []

        const history = scenario.historyByRegion[selectedStdRegion] || []
        const models = scenario.regionForecasts[selectedStdRegion] || []
        const model = models.find(m => m.name === selectedStdModel)
        if (!model || !model.forecast) return []

        const forecast = model.forecast

        const now = new Date()
        const currentYear = now.getFullYear()
        const cutoffYear = currentYear - stdVisibleYears + 1
        const filteredHistory = history.filter(p => parseInt(p.period.split('-')[0]) >= cutoffYear)

        const allPeriods = new Set<string>()
        for (const p of filteredHistory) allPeriods.add(p.period)
        for (const p of Object.keys(forecast)) allPeriods.add(p)

        const sortedPeriods = Array.from(allPeriods).sort()
        const stdDev = scenario.stdDevByRegion?.[selectedStdRegion] || 0
        const z = confidenceZ

        return sortedPeriods.map(period => {
            const hist = filteredHistory.find(p => p.period === period)
            const forecastVal = forecast[period]
            const lower = forecastVal !== undefined ? forecastVal - z * stdDev : null
            const upper = forecastVal !== undefined ? forecastVal + z * stdDev : null
            return {
                period: formatPeriod(period),
                _raw: period,
                actual: hist ? hist.value : null,
                forecast: forecastVal !== undefined ? forecastVal : null,
                lower,
                upper,
                isForecast: forecastVal !== undefined,
            }
        })
    }, [scenario, selectedStdRegion, selectedStdModel, stdVisibleYears, confidenceZ])

    // ===== КАРТА =====
    const mapData = useMemo(() => {
        if (!scenario.regionForecasts || !selectedMapModel) return scenario.byRegion || []

        const result: { subject: string; value: number }[] = []
        for (const region of regions) {
            const models = scenario.regionForecasts[region] || []
            const model = models.find(m => m.name === selectedMapModel)
            if (model && model.forecast) {
                const periods = Object.keys(model.forecast).sort()
                const lastPeriod = periods[periods.length - 1]
                if (lastPeriod) {
                    result.push({ subject: region, value: model.forecast[lastPeriod] })
                }
            }
        }
        return result
    }, [scenario, regions, selectedMapModel])

    const hasForecast = useMemo(() => {
        if (!scenario.regionForecasts) return false
        for (const region of selectedRegions) {
            const models = scenario.regionForecasts[region] || []
            for (const model of models) {
                if (model && model.forecast && Object.keys(model.forecast).length > 0) {
                    return true
                }
            }
        }
        return false
    }, [scenario.regionForecasts, selectedRegions])

    const forecastKeys = useMemo(() => {
        if (!chartData.length) return []
        const keys = Object.keys(chartData[0])
        return keys.filter(k => !k.startsWith('История') && k !== 'period' && k !== '_raw' && k !== 'isForecastStart')
    }, [chartData])

    const historyKeys = useMemo(() => {
        if (!chartData.length) return []
        const keys = Object.keys(chartData[0])
        return keys.filter(k => k.startsWith('История'))
    }, [chartData])

    const hasForecastData = useMemo(() => {
        return chartData.some(row => {
            for (const key of forecastKeys) {
                if (row[key] !== null && row[key] !== undefined) {
                    return true
                }
            }
            return false
        })
    }, [chartData, forecastKeys])

    const allPossibleKeys = useMemo(() => {
        const keys: string[] = []
        for (const r of regions) {
            keys.push(`История (${r})`)
            for (const m of allModels) {
                keys.push(`${r} (${m.name})`)
            }
        }
        return keys
    }, [regions, allModels])

    const toggleRegion = (region: string) => {
        if (selectedRegions.size === 1 && selectedRegions.has(region)) return
        setSelectedRegions(prev => {
            const next = new Set(prev)
            if (next.has(region)) next.delete(region)
            else next.add(region)
            return next
        })
    }

    const toggleModel = (modelName: string) => {
        if (selectedModels.size === 1 && selectedModels.has(modelName)) return
        setSelectedModels(prev => {
            const next = new Set(prev)
            if (next.has(modelName)) next.delete(modelName)
            else next.add(modelName)
            return next
        })
    }

    const selectAllRegions = () => setSelectedRegions(new Set(regions))
    const selectAllModels = () => setSelectedModels(new Set(allModels.map(m => m.name)))

    const hasData = chartData.length > 0

    if (!hasData) {
        return (
            <Card>
                <CardBody className="py-12 text-center text-text-muted">
                    {!hasForecast && selectedRegions.size > 0
                        ? 'Прогнозные данные отсутствуют для выбранных регионов и моделей'
                        : 'Выберите регионы и модели для отображения данных'}
                </CardBody>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">Лет истории:</span>
                    <Input
                        type="number"
                        min={1}
                        max={maxYears || 10}
                        value={visibleYears || 1}
                        onChange={e => {
                            const val = parseInt(e.target.value)
                            if (!isNaN(val) && val >= 1 && val <= (maxYears || 10)) {
                                setVisibleYears(val)
                            }
                        }}
                        className="w-20"
                    />
                    <span className="text-xs text-text-muted">(1..{maxYears || 10})</span>
                </div>
                {!hasForecastData && hasForecast && (
                    <Tag tone="amber">Прогнозные данные есть, но не отображаются</Tag>
                )}
            </div>

            {/* Выбор регионов */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-card border border-border bg-bg-elevated/40">
                <span className="text-xs font-medium uppercase tracking-wide text-text-secondary mr-2">
                    Регионы (график):
                </span>
                <button onClick={selectAllRegions} className="text-xs text-accent-green hover:underline">Все</button>
                {regions.map(region => (
                    <label key={region} className="flex items-center gap-1.5 cursor-pointer text-sm text-text-primary hover:text-accent-green transition-colors">
                        <Checkbox
                            checked={selectedRegions.has(region)}
                            onChange={() => toggleRegion(region)}
                            disabled={selectedRegions.size === 1 && selectedRegions.has(region)}
                            className="h-3.5 w-3.5"
                        />
                        {region}
                    </label>
                ))}
            </div>

            {/* Выбор моделей */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-card border border-border bg-bg-elevated/40">
                <span className="text-xs font-medium uppercase tracking-wide text-text-secondary mr-2">
                    Модели (график):
                </span>
                <button onClick={selectAllModels} className="text-xs text-accent-green hover:underline">Все</button>
                {allModels.map(m => (
                    <label key={m.name} className="flex items-center gap-1.5 cursor-pointer text-sm text-text-primary hover:text-accent-green transition-colors">
                        <Checkbox
                            checked={selectedModels.has(m.name)}
                            onChange={() => toggleModel(m.name)}
                            disabled={selectedModels.size === 1 && selectedModels.has(m.name)}
                            className="h-3.5 w-3.5"
                        />
                        {m.name} {m.rank && <Tag tone="neutral" className="text-[10px]">#{m.rank}</Tag>}
                    </label>
                ))}
            </div>

            {/* График */}
            <Card>
                <CardHeader>
                    <CardTitle>Прогноз — {scenario.targetIndicator}</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                                <XAxis dataKey="period" {...chartTheme.axis} />
                                <YAxis {...chartTheme.axis} width={70} tickFormatter={v => formatNumber(v, 0)} />
                                <Tooltip
                                    {...chartTheme.tooltip}
                                    formatter={(v: number, name: string) => [formatNumber(v, 0), name]}
                                    labelFormatter={(label) => `Период: ${label}`}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />

                                {historyKeys.map((key) => {
                                    const hasDataForLine = chartData.some(d => d[key] !== null && d[key] !== undefined)
                                    if (!hasDataForLine) return null
                                    const safeIndex = Math.max(0, allPossibleKeys.indexOf(key))
                                    const colorIndex = safeIndex % COLORS.length
                                    return (
                                        <Line
                                            key={key}
                                            type="monotone"
                                            dataKey={key}
                                            stroke={COLORS[colorIndex]}
                                            strokeWidth={2.5}
                                            strokeOpacity={0.6}
                                            dot={false}
                                            activeDot={{ r: 5 }}
                                            name={key}
                                            isAnimationActive={!reduced}
                                        />
                                    )
                                })}

                                {forecastKeys.map((key) => {
                                    const hasDataForLine = chartData.some(d => d[key] !== null && d[key] !== undefined)
                                    if (!hasDataForLine) return null
                                    const safeIndex = Math.max(0, allPossibleKeys.indexOf(key))
                                    const colorIndex = safeIndex % COLORS.length
                                    return (
                                        <Line
                                            key={key}
                                            type="monotone"
                                            dataKey={key}
                                            stroke={COLORS[colorIndex]}
                                            strokeWidth={2.5}
                                            strokeOpacity={1}
                                            dot={false}
                                            activeDot={{ r: 5 }}
                                            name={key}
                                            isAnimationActive={!reduced}
                                            connectNulls={true}
                                        />
                                    )
                                })}

                                {chartData.some(d => d.isForecastStart) && (
                                    <ReferenceLine
                                        x={chartData.find(d => d.isForecastStart)?.period}
                                        stroke={chartTheme.amber}
                                        strokeDasharray="4 4"
                                        strokeWidth={2}
                                        label={{ value: 'Прогноз', position: 'top', fill: chartTheme.amber, fontSize: 12 }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {!hasForecastData && hasForecast && (
                        <p className="mt-3 text-sm text-accent-amber text-center">
                            ⚠️ Прогнозные данные загружены, но не отображаются на графике.
                            Проверьте, что для выбранных регионов и моделей есть прогнозные значения.
                        </p>
                    )}
                </CardBody>
            </Card>

            {/* СКО */}
            <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Сравнение прогноза с реальностью (СКО)</CardTitle>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary">Лет для СКО:</span>
                            <Input
                                type="number"
                                min={1}
                                max={maxYears || 10}
                                value={stdVisibleYears}
                                onChange={e => {
                                    const val = parseInt(e.target.value)
                                    if (!isNaN(val) && val >= 1 && val <= (maxYears || 10)) {
                                        setStdVisibleYears(val)
                                    }
                                }}
                                className="w-16"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary">Доверительный интервал:</span>
                            <Select
                                value={confidenceZ}
                                onChange={e => setConfidenceZ(Number(e.target.value))}
                                className="w-44"
                            >
                                <option value={1.0}>z = 1.0 (68%)</option>
                                <option value={1.645}>z = 1.645 (90%)</option>
                                <option value={1.96}>z = 1.96 (95%)</option>
                                <option value={2.576}>z = 2.576 (99%)</option>
                                <option value={3.0}>z = 3.0 (99.7%)</option>
                            </Select>
                        </div>
                        <Select
                            value={selectedStdRegion}
                            onChange={e => setSelectedStdRegion(e.target.value)}
                            className="w-40"
                        >
                            {regions.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </Select>
                        <Select
                            value={selectedStdModel}
                            onChange={e => setSelectedStdModel(e.target.value)}
                            className="w-48"
                        >
                            {allModels.map(m => (
                                <option key={m.name} value={m.name}>
                                    {m.name} {m.rank ? `(#${m.rank})` : ''}
                                </option>
                            ))}
                        </Select>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={stdChartData} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
                                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                                <XAxis dataKey="period" {...chartTheme.axis} />
                                <YAxis {...chartTheme.axis} width={48} tickFormatter={v => formatNumber(v, 0)} />
                                <Tooltip
                                    {...chartTheme.tooltip}
                                    formatter={(v: number, name: string) => {
                                        if (name === 'Факт' || name === 'Прогноз') {
                                            return [formatNumber(v, 0), name]
                                        }
                                        return [formatNumber(v, 0), name]
                                    }}
                                    labelFormatter={(label) => `Период: ${label}`}
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload || !payload.length) return null
                                        const data = payload[0]?.payload
                                        if (!data) return null
                                        return (
                                            <div className="bg-surface-card border border-border rounded-card p-3 shadow-card">
                                                <p className="text-sm font-semibold text-text-primary">{label}</p>
                                                {data.actual !== null && data.actual !== undefined && (
                                                    <p className="text-xs text-text-secondary">
                                                        Факт: <span className="text-text-primary">{formatNumber(data.actual, 0)}</span>
                                                    </p>
                                                )}
                                                {data.forecast !== null && data.forecast !== undefined && (
                                                    <p className="text-xs text-text-secondary">
                                                        Прогноз: <span className="text-text-primary">{formatNumber(data.forecast, 0)}</span>
                                                    </p>
                                                )}
                                                {data.isForecast && data.lower !== null && data.upper !== null && (
                                                    <>
                                                        <div className="w-full h-px bg-border my-1.5" />
                                                        <p className="text-xs text-text-secondary">
                                                            ДИ (z={confidenceZ}):
                                                            <span className="text-text-primary ml-1">
                                                                {formatNumber(data.lower, 0)} – {formatNumber(data.upper, 0)}
                                                            </span>
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        )
                                    }}
                                />
                                <Legend />

                                <Bar dataKey="actual" fill={chartTheme.blue} name="Факт" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="forecast" fill="#004524" name="Прогноз" radius={[3, 3, 0, 0]}>
                                    {stdChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isForecast ? "#004524" : "#004524"} />
                                    ))}
                                </Bar>

                                <Customized
                                    component={({ xAxisMap, yAxisMap }) => {
                                        if (!xAxisMap || !yAxisMap) return null
                                        const xAxis = Object.values(xAxisMap)[0]
                                        const yAxis = Object.values(yAxisMap)[0]
                                        if (!xAxis || !yAxis) return null

                                        const bandwidth = xAxis.scale.bandwidth ? xAxis.scale.bandwidth() : 60
                                        const offset = bandwidth / 2 * 1.4
                                        const tickWidth = 10
                                        const ciColor = '#FFFFFF'

                                        return stdChartData.map((entry, index) => {
                                            if (!entry.isForecast || entry.forecast === null || entry.forecast === undefined) return null
                                            const x = xAxis.scale(entry.period) + offset
                                            const yTop = yAxis.scale(entry.upper)
                                            const yBottom = yAxis.scale(entry.lower)
                                            if (x === undefined || yTop === undefined || yBottom === undefined) return null
                                            return (
                                                <g key={`ci-${index}`}>
                                                    <line
                                                        x1={x}
                                                        y1={yTop}
                                                        x2={x}
                                                        y2={yBottom}
                                                        stroke={ciColor}
                                                        strokeDasharray="3 3"
                                                        strokeWidth={2}
                                                        opacity={0.9}
                                                    />
                                                    <line
                                                        x1={x - tickWidth / 2}
                                                        y1={yTop}
                                                        x2={x + tickWidth / 2}
                                                        y2={yTop}
                                                        stroke={ciColor}
                                                        strokeWidth={2}
                                                        opacity={0.9}
                                                    />
                                                    <line
                                                        x1={x - tickWidth / 2}
                                                        y1={yBottom}
                                                        x2={x + tickWidth / 2}
                                                        y2={yBottom}
                                                        stroke={ciColor}
                                                        strokeWidth={2}
                                                        opacity={0.9}
                                                    />
                                                </g>
                                            )
                                        })
                                    }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-xs text-text-muted">
                        Модель: {selectedStdModel}. Регион: {selectedStdRegion}.
                        Белые пунктирные линии с чёрточками — доверительный интервал (z = {confidenceZ}).
                        СКО: {scenario.stdDevByRegion?.[selectedStdRegion] !== undefined ? formatNumber(scenario.stdDevByRegion[selectedStdRegion], 2) : '—'}
                    </p>
                </CardBody>
            </Card>

            {/* Драйверы */}
            <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Драйверы изменения показателя</CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">Регион:</span>
                        <Select
                            value={selectedDriversRegion}
                            onChange={e => setSelectedDriversRegion(e.target.value)}
                            className="w-40"
                        >
                            {regions.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </Select>
                    </div>
                </CardHeader>
                <CardBody>
                    <ScenarioDrivers
                        scenarioId={scenario.id}
                        region={selectedDriversRegion}
                        targetIndicator={scenario.targetIndicator}
                    />
                </CardBody>
            </Card>

            {/* Карта */}
            <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Карта регионов</CardTitle>
                    <Select
                        value={selectedMapModel}
                        onChange={e => setSelectedMapModel(e.target.value)}
                        className="w-48"
                    >
                        {allModels.map(m => (
                            <option key={m.name} value={m.name}>
                                {m.name} {m.rank ? `(#${m.rank})` : ''}
                            </option>
                        ))}
                    </Select>
                </CardHeader>
                <CardBody>
                    <RussiaMap
                        scenario={{
                            ...scenario,
                            byRegion: mapData,
                            title: `${scenario.title} (${selectedMapModel})`
                        }}
                    />
                </CardBody>
            </Card>
        </div>
    )
}
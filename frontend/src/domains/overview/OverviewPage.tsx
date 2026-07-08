// src/domains/overview/OverviewPage.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { useSessionStore } from '@/shared/store/useSessionStore'
import { useGraphStore } from '@/domains/business-graph/store/useGraphStore'
import { useScenarioStore } from '@/domains/scenarios/store/useScenarioStore'
import { useAnomalyStore } from '@/domains/ai-insights/store/useAnomalyStore'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Card, CardBody, CardHeader, CardTitle, Select, Input, Button, ConfirmDialog, AlertDialog } from '@/shared/ui'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import { useVirtualizer } from '@tanstack/react-virtual'
import { formatPeriod, formatNumber } from '@/shared/lib/format'
import { chartTheme } from '@/shared/ui/chartTheme'
import { api } from '@/shared/lib/api'
import { Trash2, Search } from 'lucide-react'

type ViewMode = 'all' | 'region'

export function OverviewPage() {
    const reduced = usePrefersReducedMotion()
    const { facts, indicators, subjects, loading, loadFacts, refresh } = useDatasetStore()
    const { user } = useSessionStore()
    const resetGraph = useGraphStore((s) => s.reset)
    const clearScenarios = useScenarioStore((s) => s.clear)
    const { hasCorrections, checkStatus, clear: clearAnomalies } = useAnomalyStore()

    // Фильтры для графика
    const [selectedSubject, setSelectedSubject] = useState<string>('')
    const [visibleIndicators, setVisibleIndicators] = useState<Set<string>>(new Set())
    const [rangeMonths, setRangeMonths] = useState<number>(12)

    // Поиск для таблицы
    const [tableSearchTerm, setTableSearchTerm] = useState('')
    const [isCleaning, setIsCleaning] = useState(false)

    // Состояния модальных окон
    const [showConfirmClean, setShowConfirmClean] = useState(false)
    const [alertDialog, setAlertDialog] = useState<{
        open: boolean
        title: string
        message: string
        variant: 'success' | 'danger' | 'warning' | 'info'
    }>({ open: false, title: '', message: '', variant: 'info' })

    // Проверка статуса коррекций при монтировании
    useEffect(() => {
        checkStatus()
    }, [])

    // При изменении hasCorrections обновляем данные в таблице (если активны коррекции)
    useEffect(() => {
        if (hasCorrections) {
            refresh()
        }
    }, [hasCorrections])

    useEffect(() => {
        loadFacts()
    }, [])

    useEffect(() => {
        if (indicators.length && visibleIndicators.size === 0) {
            setVisibleIndicators(new Set(indicators))
        }
    }, [indicators])

    const handleCleanDatabase = () => {
        if (!user || user.role !== 'admin') {
            setAlertDialog({
                open: true,
                title: 'Доступ запрещён',
                message: 'Только администратор может очищать базу данных.',
                variant: 'warning',
            })
            return
        }
        setShowConfirmClean(true)
    }

    const executeCleanDatabase = async () => {
        setShowConfirmClean(false)
        setIsCleaning(true)
        try {
            const result = await api.cleanDatabase()
            // Очищаем все связанные сторы
            resetGraph()
            clearScenarios()
            clearAnomalies() // Очищаем коррекции
            await refresh()
            setAlertDialog({
                open: true,
                title: 'Очистка завершена',
                message: result.message || 'База данных успешно очищена.',
                variant: 'success',
            })
        } catch (e) {
            setAlertDialog({
                open: true,
                title: 'Ошибка',
                message: e instanceof Error ? e.message : 'Ошибка при очистке базы данных.',
                variant: 'danger',
            })
        } finally {
            setIsCleaning(false)
        }
    }

    // Данные для таблицы
    const allPeriods = useMemo(() => {
        return Array.from(new Set(facts.map(f => f.period))).sort()
    }, [facts])

    const allSubjects = useMemo(() => {
        return Array.from(new Set(facts.map(f => f.subject))).sort()
    }, [facts])

    const allIndicators = useMemo(() => {
        return Array.from(new Set(facts.map(f => f.indicator))).sort()
    }, [facts])

    // Сводная таблица
    const pivotData = useMemo(() => {
        const result: Array<Record<string, any>> = []
        for (const period of allPeriods) {
            for (const subject of allSubjects) {
                const row: Record<string, any> = { period, subject }
                for (const indicator of allIndicators) {
                    const fact = facts.find(
                        f => f.period === period && f.subject === subject && f.indicator === indicator
                    )
                    row[indicator] = fact?.value ?? null
                }
                result.push(row)
            }
        }
        return result
    }, [allPeriods, allSubjects, allIndicators, facts])

    // Колонки таблицы
    const tableColumns = useMemo(() => {
        const cols: Array<{ id: string; header: string; accessor: string; width: number; align?: 'left' | 'right' }> = []
        cols.push({ id: 'period', header: 'Период', accessor: 'period', width: 100, align: 'left' })
        cols.push({ id: 'subject', header: 'Регион', accessor: 'subject', width: 160, align: 'left' })
        for (const indicator of allIndicators) {
            let shortHeader = indicator
            if (indicator.length > 24) {
                shortHeader = indicator.slice(0, 22) + '…'
            }
            const width = Math.min(Math.max(indicator.length * 7 + 30, 90), 180)
            cols.push({
                id: indicator,
                header: indicator,
                shortHeader,
                accessor: indicator,
                width: width,
                align: 'right',
            })
        }
        return cols
    }, [allIndicators])

    // Поиск по таблице
    const filteredPivotData = useMemo(() => {
        if (!tableSearchTerm.trim()) return pivotData
        const q = tableSearchTerm.trim().toLowerCase()
        return pivotData.filter(row => {
            const formattedPeriod = formatPeriod(row.period).toLowerCase()
            if (formattedPeriod.includes(q)) return true
            if (row.subject.toLowerCase().includes(q)) return true
            for (const indicator of allIndicators) {
                const val = row[indicator]
                if (val !== null && val !== undefined && String(val).toLowerCase().includes(q)) {
                    return true
                }
            }
            return false
        })
    }, [pivotData, tableSearchTerm, allIndicators])

    // Виртуализация таблицы
    const parentRef = useRef<HTMLDivElement>(null)
    const virtualizer = useVirtualizer({
        count: filteredPivotData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 34,
        overscan: 20,
    })

    // Данные для графика (с фильтрацией)
    const chartData = useMemo(() => {
        let filtered = facts
        if (selectedSubject) {
            filtered = filtered.filter(f => f.subject === selectedSubject)
        }
        const map = new Map<string, Record<string, number>>()
        for (const f of filtered) {
            if (!visibleIndicators.has(f.indicator)) continue
            if (!map.has(f.period)) map.set(f.period, { period: f.period })
            const row = map.get(f.period)!
            row[f.indicator] = (row[f.indicator] || 0) + f.value
        }
        let sorted = Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period))
        if (rangeMonths > 0 && rangeMonths < sorted.length) {
            sorted = sorted.slice(-rangeMonths)
        }
        return sorted
    }, [facts, selectedSubject, visibleIndicators, rangeMonths])

    const toggleIndicator = (ind: string) => {
        setVisibleIndicators(prev => {
            const next = new Set(prev)
            if (next.has(ind)) next.delete(ind)
            else next.add(ind)
            return next
        })
    }

    const isAdmin = user?.role === 'admin'

    const fixedColumns = tableColumns.filter(c => c.id === 'period' || c.id === 'subject')
    const scrollColumns = tableColumns.filter(c => c.id !== 'period' && c.id !== 'subject')

    return (
        <div>
            <PageHeader
                title="Текущие данные"
                subtitle="Сводная таблица и динамика показателей по регионам"
                actions={
                    isAdmin && (
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={handleCleanDatabase}
                            disabled={isCleaning || loading}
                            className="flex items-center gap-1.5"
                        >
                            <Trash2 className="h-4 w-4" />
                            {isCleaning ? 'Очистка...' : 'Очистить БД'}
                        </Button>
                    )
                }
            />

            {/* Фильтры графика */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-text-secondary font-medium">Фильтры графика:</span>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">Регион:</span>
                    <Select
                        value={selectedSubject}
                        onChange={e => setSelectedSubject(e.target.value)}
                        className="w-48"
                    >
                        <option value="">Все регионы</option>
                        {subjects.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">Период:</span>
                    <Select
                        value={String(rangeMonths)}
                        onChange={e => setRangeMonths(Number(e.target.value))}
                        className="w-24"
                    >
                        <option value="6">6 мес</option>
                        <option value="12">12 мес</option>
                        <option value="24">24 мес</option>
                        <option value="36">36 мес</option>
                        <option value="0">Все</option>
                    </Select>
                </div>
                {hasCorrections && (
                    <span className="text-xs text-accent-amber">⚠ Аномалии заменены</span>
                )}
            </div>

            {/* График */}
            <Card className="mb-4">
                <CardHeader>
                    <CardTitle>Динамика показателей</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="mb-2 flex flex-wrap gap-3">
                        <span className="text-xs uppercase tracking-wide text-text-secondary mr-1">Показатели:</span>
                        {indicators.map(ind => (
                            <label key={ind} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={visibleIndicators.has(ind)}
                                    onChange={() => toggleIndicator(ind)}
                                    className="accent-accent-green h-4 w-4"
                                />
                                {ind}
                            </label>
                        ))}
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                                <XAxis dataKey="period" tickFormatter={formatPeriod} {...chartTheme.axis} />
                                <YAxis {...chartTheme.axis} width={70} tickFormatter={v => formatNumber(v, 0)} />
                                <Tooltip
                                    {...chartTheme.tooltip}
                                    formatter={(v: number, name: string) => [formatNumber(v, 0), name]}
                                />
                                <Legend />
                                {Array.from(visibleIndicators).map((ind, i) => (
                                    <Line
                                        key={ind}
                                        type="monotone"
                                        dataKey={ind}
                                        stroke={chartTheme.series[i % chartTheme.series.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={!reduced}
                                        animationDuration={reduced ? 0 : 500}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardBody>
            </Card>

            {/* Таблица */}
            <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Сводная таблица данных</CardTitle>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                            <Input
                                value={tableSearchTerm}
                                onChange={(e) => setTableSearchTerm(e.target.value)}
                                placeholder="Поиск по таблице..."
                                className="w-48 pl-9"
                                aria-label="Поиск в таблице"
                            />
                        </div>
                        <span className="text-xs text-text-secondary whitespace-nowrap">
                            {filteredPivotData.length} строк · {allPeriods.length} периодов · {allSubjects.length} регионов · {allIndicators.length} показателей
                            {tableSearchTerm && ` (фильтр: "${tableSearchTerm}")`}
                            {isAdmin && ' · 🔑 Админ'}
                            {hasCorrections && ' · 🔄 аномалии заменены'}
                        </span>
                    </div>
                </CardHeader>
                <CardBody>
                    <div
                        ref={parentRef}
                        className="h-[500px] overflow-auto border border-border rounded-card"
                    >
                        <div className="relative min-w-max">
                            <table className="border-collapse text-sm">
                                <thead className="sticky top-0 z-20 bg-bg-elevated">
                                    <tr>
                                        {fixedColumns.map(col => (
                                            <th
                                                key={col.id}
                                                className="sticky left-0 z-30 bg-bg-elevated px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary border-b border-border"
                                                style={{
                                                    width: col.width,
                                                    minWidth: col.width,
                                                    maxWidth: col.width,
                                                    textAlign: col.align || 'left',
                                                    height: '36px',
                                                    lineHeight: '1.2',
                                                }}
                                            >
                                                {col.header}
                                            </th>
                                        ))}
                                        {scrollColumns.map(col => (
                                            <th
                                                key={col.id}
                                                className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary border-b border-border"
                                                style={{
                                                    width: col.width,
                                                    minWidth: col.width,
                                                    maxWidth: col.width,
                                                    textAlign: col.align || 'left',
                                                    height: '36px',
                                                    lineHeight: '1.2',
                                                }}
                                                title={col.header}
                                            >
                                                {col.shortHeader || col.header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody style={{ position: 'relative', height: `${virtualizer.getTotalSize()}px` }}>
                                    {virtualizer.getVirtualItems().map((vi) => {
                                        const row = filteredPivotData[vi.index]
                                        if (!row) return null
                                        return (
                                            <tr
                                                key={`${row.period}|${row.subject}`}
                                                style={{
                                                    height: `${vi.size}px`,
                                                    transform: `translateY(${vi.start}px)`,
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    willChange: 'transform',
                                                }}
                                                className="border-b border-border/60 hover:bg-surface-hover"
                                            >
                                                {fixedColumns.map(col => {
                                                    const value = row[col.accessor]
                                                    const isPeriod = col.id === 'period'
                                                    return (
                                                        <td
                                                            key={col.id}
                                                            className="sticky left-0 z-10 bg-surface-card px-2 py-1 text-text-primary truncate"
                                                            style={{
                                                                textAlign: col.align || 'left',
                                                                width: col.width,
                                                                minWidth: col.width,
                                                                maxWidth: col.width,
                                                                fontVariantNumeric: 'normal',
                                                                fontSize: '13px',
                                                            }}
                                                            title={value !== undefined && value !== null ? String(value) : ''}
                                                        >
                                                            {isPeriod ? formatPeriod(value) : value}
                                                        </td>
                                                    )
                                                })}
                                                {scrollColumns.map(col => {
                                                    const value = row[col.accessor]
                                                    return (
                                                        <td
                                                            key={col.id}
                                                            className="px-2 py-1 text-text-primary truncate"
                                                            style={{
                                                                textAlign: col.align || 'left',
                                                                width: col.width,
                                                                minWidth: col.width,
                                                                maxWidth: col.width,
                                                                fontVariantNumeric: 'tabular-nums',
                                                                fontSize: '13px',
                                                            }}
                                                            title={value !== undefined && value !== null ? String(value) : ''}
                                                        >
                                                            {value !== undefined && value !== null && value !== '' ? formatNumber(value) : '—'}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Модальное окно подтверждения очистки БД */}
            <ConfirmDialog
                open={showConfirmClean}
                onClose={() => setShowConfirmClean(false)}
                onConfirm={executeCleanDatabase}
                title="Очистить базу данных?"
                confirmLabel="Да, очистить"
                cancelLabel="Отмена"
                variant="danger"
                loading={isCleaning}
            >
                <p className="mb-2">
                    Все загруженные факты, сценарии, граф и <span className="text-accent-red font-medium">коррекции аномалий</span> будут
                    удалены без возможности восстановления.
                </p>
                <p>Это действие <strong>нельзя отменить</strong>.</p>
            </ConfirmDialog>

            {/* Модальное окно результата */}
            <AlertDialog
                open={alertDialog.open}
                onClose={() => setAlertDialog(prev => ({ ...prev, open: false }))}
                title={alertDialog.title}
                variant={alertDialog.variant}
            >
                <p>{alertDialog.message}</p>
            </AlertDialog>
        </div>
    )
}
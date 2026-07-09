import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, FileSpreadsheet, CheckCircle2, Layers, Table2 } from 'lucide-react'
import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    Select,
    Skeleton,
    Tag,
    Toggle,
} from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { exportToCsv, exportToExcel, type ExportSummary } from './lib/exportExcel'
import { api } from '@/shared/lib/api'
import type { Scenario, BusinessGraph } from '@/shared/lib/api-types'
import { useGraphStore } from '@/domains/business-graph/store/useGraphStore'

const ALL = '__all__'
type Format = 'xlsx' | 'csv'

export function ExportPage() {
    const prefersReduced = usePrefersReducedMotion()
    const { facts, indicators, loading, hasData } = useDatasetStore()
    const { currentNodes, currentEdges, savedNodes, savedEdges, hasSaved } = useGraphStore()

    const [format, setFormat] = useState<Format>('xlsx')
    const [indicatorFilter, setIndicatorFilter] = useState<string>(ALL)
    const [includeFormula, setIncludeFormula] = useState(true)
    const [includePlan, setIncludePlan] = useState(false)
    const [selectedPlanId, setSelectedPlanId] = useState<string>('')
    const [scenarios, setScenarios] = useState<Scenario[]>([])
    const [loadingPlans, setLoadingPlans] = useState(false)
    const [result, setResult] = useState<ExportSummary | null>(null)

    // ✅ НОВОЕ: загружаем граф с БЭКА для экспорта
    const [graphFromBackend, setGraphFromBackend] = useState<BusinessGraph | null>(null)
    const [loadingGraph, setLoadingGraph] = useState(false)

    useEffect(() => {
        setLoadingGraph(true)
        api.getGraph()
            .then(g => setGraphFromBackend(g))
            .catch(() => setGraphFromBackend(null))
            .finally(() => setLoadingGraph(false))
    }, [])

    // Загружаем планы только если включены
    useEffect(() => {
        if (includePlan) {
            setLoadingPlans(true)
            api.getScenarios()
                .then(setScenarios)
                .catch(() => setScenarios([]))
                .finally(() => setLoadingPlans(false))
        }
    }, [includePlan])

    useEffect(() => {
        setResult(null)
    }, [format, indicatorFilter, includeFormula, includePlan, selectedPlanId])

    const isFiltered = indicatorFilter !== ALL
    const hasGraph = graphFromBackend && graphFromBackend.nodes.length > 0
    const formulaInExport = format === 'xlsx' && includeFormula && hasGraph

    const previewRows = useMemo(() => {
        if (includePlan && selectedPlanId) {
            const plan = scenarios.find(s => s.id === selectedPlanId)
            return plan?.series?.length || 0
        }
        if (!isFiltered) return facts.length
        return facts.filter(f => f.indicator === indicatorFilter).length
    }, [facts, indicatorFilter, isFiltered, includePlan, selectedPlanId, scenarios])

    const previewSheets = useMemo(() => {
        const list = ['Данные']
        if (formulaInExport) list.push('Формула')
        if (includePlan && selectedPlanId) list.push('План')
        return list
    }, [formulaInExport, includePlan, selectedPlanId])

    function handleExport() {
        let summary: ExportSummary

        if (includePlan && selectedPlanId) {
            const plan = scenarios.find(s => s.id === selectedPlanId)
            if (!plan) return

            const planFacts = plan.series.map(p => ({
                period: p.period,
                district: 'План',
                subject: 'Прогноз',
                indicator: plan.params.targetIndicator,
                unit: 'руб',
                value: p.value,
            }))

            summary = format === 'csv'
                ? exportToCsv({ facts: planFacts })
                : exportToExcel({
                    facts: planFacts,
                    graph: { nodes: [], edges: [] },
                    includeFormulaSheet: false,
                })
        } else {
            summary = format === 'csv'
                ? exportToCsv({ facts, indicatorFilter: isFiltered ? indicatorFilter : undefined })
                : exportToExcel({
                    facts,
                    graph: graphFromBackend || { nodes: [], edges: [] },
                    indicatorFilter: isFiltered ? indicatorFilter : undefined,
                    includeFormulaSheet: formulaInExport,
                })
        }
        setResult(summary)
    }

    const fade = prefersReduced
        ? {}
        : {
            initial: { opacity: 0, y: 6 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -6 },
            transition: { duration: 0.2 },
        }

    if (!hasData && !loading && !includePlan) {
        return (
            <div>
                <PageHeader
                    title="Экспорт"
                    subtitle="Выгрузка данных в Excel или CSV. Можно экспортировать факты или готовые планы."
                />
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={<FileSpreadsheet className="h-10 w-10" />}
                            title="Нет данных для выгрузки"
                            description="Загрузите файл с фактами в разделе «Загрузка данных» или выберите план для экспорта."
                        />
                    </CardBody>
                </Card>
            </div>
        )
    }

    return (
        <div>
            <PageHeader
                title="Экспорт"
                subtitle="Выгрузка данных в Excel или CSV. Можно экспортировать факты или готовые планы."
            />

            {loading || loadingGraph ? (
                <Card>
                    <CardBody className="space-y-3 pt-5">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-2/3" />
                        <Skeleton className="h-24 w-full" />
                    </CardBody>
                </Card>
            ) : facts.length === 0 && !includePlan ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={<FileSpreadsheet className="h-10 w-10" />}
                            title="Нет данных для выгрузки"
                            description="Загрузите файл с фактами в разделе «Загрузка данных» или выберите план для экспорта."
                        />
                    </CardBody>
                </Card>
            ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Параметры выгрузки</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-5">
                            <Field label="Формат файла">
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        { value: 'xlsx', label: 'Excel (.xlsx)' },
                                        { value: 'csv', label: 'CSV (.csv)' },
                                    ] as { value: Format; label: string }[]).map((f) => (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onClick={() => setFormat(f.value)}
                                            className={cn(
                                                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                                                format === f.value
                                                    ? 'border-accent-green/50 bg-accent-green/10 text-text-primary'
                                                    : 'border-border text-text-secondary hover:bg-surface-hover',
                                            )}
                                        >
                                            <FileSpreadsheet className="h-4 w-4" />
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </Field>

                            <div className="space-y-3">
                                <Field label="Тип данных">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIncludePlan(false)
                                                setSelectedPlanId('')
                                            }}
                                            className={cn(
                                                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                                                !includePlan
                                                    ? 'border-accent-green/50 bg-accent-green/10 text-text-primary'
                                                    : 'border-border text-text-secondary hover:bg-surface-hover',
                                            )}
                                        >
                                            <Table2 className="h-4 w-4" />
                                            Факты
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIncludePlan(true)}
                                            className={cn(
                                                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                                                includePlan
                                                    ? 'border-accent-green/50 bg-accent-green/10 text-text-primary'
                                                    : 'border-border text-text-secondary hover:bg-surface-hover',
                                            )}
                                        >
                                            <Layers className="h-4 w-4" />
                                            План
                                        </button>
                                    </div>
                                </Field>

                                {includePlan && (
                                    <Field label="План для экспорта" htmlFor="plan-select">
                                        {loadingPlans ? (
                                            <Skeleton className="h-10 w-full" />
                                        ) : scenarios.length === 0 ? (
                                            <p className="text-sm text-text-muted">Нет сохранённых планов.</p>
                                        ) : (
                                            <Select
                                                id="plan-select"
                                                value={selectedPlanId}
                                                onChange={e => setSelectedPlanId(e.target.value)}
                                            >
                                                <option value="">Выберите план</option>
                                                {scenarios.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.title} ({s.params.targetIndicator})
                                                    </option>
                                                ))}
                                            </Select>
                                        )}
                                    </Field>
                                )}

                                {!includePlan && (
                                    <Field label="Показатель" htmlFor="export-indicator">
                                        <Select
                                            id="export-indicator"
                                            value={indicatorFilter}
                                            onChange={e => setIndicatorFilter(e.target.value)}
                                        >
                                            <option value={ALL}>Все показатели</option>
                                            {indicators.map(ind => (
                                                <option key={ind} value={ind}>{ind}</option>
                                            ))}
                                        </Select>
                                    </Field>
                                )}
                            </div>

                            {!includePlan && (
                                <div
                                    className={cn(
                                        'flex items-start justify-between gap-4 rounded-card border border-border bg-bg-elevated px-4 py-3',
                                        format === 'csv' && 'opacity-50'
                                    )}
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-text-primary">Включить лист с формулами графа</p>
                                        <p className="mt-0.5 text-xs text-text-secondary">
                                            {format === 'csv'
                                                ? 'Недоступно для CSV'
                                                : hasGraph
                                                    ? `${graphFromBackend!.nodes.length} узлов, ${graphFromBackend!.edges.length} связей`
                                                    : 'Граф пуст'}
                                        </p>
                                    </div>
                                    <div className="pt-0.5">
                                        <Toggle
                                            checked={formulaInExport}
                                            onChange={setIncludeFormula}
                                            disabled={format === 'csv' || !hasGraph}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-3 pt-1">
                                <Button onClick={handleExport} disabled={includePlan && !selectedPlanId}>
                                    <Download className="h-4 w-4" />
                                    {format === 'csv' ? 'Выгрузить в CSV' : 'Выгрузить в Excel'}
                                </Button>

                                <AnimatePresence mode="wait">
                                    {result && (
                                        <motion.span {...fade} className="flex items-center gap-1.5 text-sm text-accent-green">
                                            <CheckCircle2 className="h-4 w-4" />
                                            {formatNumber(result.rows, 0)} строк
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Превью</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-card border border-border bg-bg-elevated px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-text-muted">
                                        <Table2 className="h-4 w-4" />
                                        <span className="text-xs uppercase">Строк</span>
                                    </div>
                                    <p className="mt-1 text-2xl font-bold text-text-primary tabular">{formatNumber(previewRows, 0)}</p>
                                </div>
                                <div className="rounded-card border border-border bg-bg-elevated px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-text-muted">
                                        <Layers className="h-4 w-4" />
                                        <span className="text-xs uppercase">Листов</span>
                                    </div>
                                    <p className="mt-1 text-2xl font-bold text-text-primary tabular">{previewSheets.length}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-medium uppercase text-text-secondary">Листы</p>
                                <ul className="mt-2 space-y-1.5">
                                    {previewSheets.map(name => (
                                        <li key={name} className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary">
                                            <FileSpreadsheet className="h-4 w-4 text-text-muted" />
                                            {name}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <p className="text-xs text-text-muted">
                                {includePlan && selectedPlanId ? (
                                    <>План: <Tag tone="lime">{scenarios.find(s => s.id === selectedPlanId)?.title}</Tag></>
                                ) : isFiltered ? (
                                    <>Фильтр: <Tag tone="lime">{indicatorFilter}</Tag></>
                                ) : (
                                    'Без фильтра'
                                )}
                            </p>
                        </CardBody>
                    </Card>
                </div>
            )}
        </div>
    )
}
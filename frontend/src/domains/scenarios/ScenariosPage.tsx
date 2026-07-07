import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardBody, CardHeader, CardTitle, Button, Select, Input, Field, Tag, Skeleton, EmptyState } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { SlidersHorizontal, Plus, Sparkles, X, RotateCcw } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { useScenarioStore } from './store/useScenarioStore'
import { ScenarioCard } from './components/ScenarioCard'
import { ScenarioCompare } from './components/ScenarioCompare'
import { RussiaMap } from './components/RussiaMap'
import { YoYStdChart } from './components/YoYStdChart'
import { PlanIndicatorsView } from './components/PlanIndicatorsView'
import type { ScenarioParams } from '@/shared/lib/api-types'

const schema = z.object({
    name: z.string().trim().min(1, 'Введите название').max(60),
    targetIndicator: z.string().min(1, 'Выберите показатель'),
    periodMode: z.enum(['max', 'half', 'custom']),
    periodFrom: z.coerce.number().optional(),
    periodTo: z.coerce.number().optional(),
    method: z.enum(['growth-rate', 'avg-3m', 'avg-6m']),
    forecastMode: z.enum(['best', 'all', 'sarimax', 'prophet', 'exponential_smoothing', 'stl', 'ridge', 'croston']),
})

const MAX_HORIZON = 24

// Человекочитаемые названия моделей
const FORECAST_MODE_LABELS: Record<string, string> = {
    best: 'Лучшая модель (авто)',
    all: 'Все модели',
    sarimax: 'SARIMAX',
    prophet: 'Prophet',
    exponential_smoothing: 'Экспоненциальное сглаживание',
    stl: 'STL-декомпозиция',
    ridge: 'Гребневая регрессия',
    croston: 'Кростон (для редких событий)',
}

// Человекочитаемые названия методов расчёта
const METHOD_LABELS: Record<string, string> = {
    'growth-rate': 'По темпам роста',
    'avg-3m': 'Среднее за 3 мес',
    'avg-6m': 'Среднее за 6 мес',
}

export function ScenariosPage() {
    const reduced = usePrefersReducedMotion()
    const { indicators, periods, loadFacts } = useDatasetStore()
    const { scenarios, loading, error, load, create, deleteScenario, selectedIds, toggleSelected } = useScenarioStore()
    const [showForm, setShowForm] = useState(false)
    const [mapScenarioId, setMapScenarioId] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [progressMessages, setProgressMessages] = useState<string[]>([])

    useEffect(() => {
        loadFacts()
        load()
    }, [])

    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
        reset,
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            targetIndicator: indicators[0] || '',
            periodMode: 'half',
            method: 'avg-3m',
            forecastMode: 'best',
            periodFrom: 1,
            periodTo: 6,
        },
    })

    const periodMode = watch('periodMode')
    const isCustom = periodMode === 'custom'

    const getPeriodRange = (mode: string) => {
        switch (mode) {
            case 'max': return { from: 1, to: MAX_HORIZON }
            case 'half': return { from: 1, to: Math.floor(MAX_HORIZON / 2) }
            default: return { from: 1, to: 6 }
        }
    }

    useEffect(() => {
        if (periodMode !== 'custom') {
            const range = getPeriodRange(periodMode)
            setValue('periodFrom', range.from)
            setValue('periodTo', range.to)
        }
    }, [periodMode, setValue])

    const onSubmit = async (values: any) => {
        const params: ScenarioParams = {
            name: values.name || 'Базовый план',
            targetIndicator: values.targetIndicator,
            periodFrom: values.periodFrom || 1,
            horizonMonths: values.periodTo || 6,
            method: values.method,
            seasonality: true,
            forecastMode: values.forecastMode,
        }

        setIsGenerating(true)
        setProgressMessages(['Начинаем генерацию...'])

        try {
            const progressSteps = [
                'Анализ исторических данных...',
                'Расчёт базовых показателей...',
                'Построение прогнозных моделей...',
                'Формирование сценариев...',
            ]
            for (let i = 0; i < progressSteps.length; i++) {
                await new Promise(r => setTimeout(r, 400 + Math.random() * 300))
                setProgressMessages(prev => [...prev, progressSteps[i]])
            }

            await create(params)
            reset()
            setShowForm(false)
        } catch (e) {
            console.error('Generation error:', e)
        } finally {
            setIsGenerating(false)
            setProgressMessages([])
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Удалить сценарий?')) return
        await deleteScenario(id)
    }

    const readyForMap = useMemo(
        () => scenarios.filter(s => s.status === 'ready' && s.byRegion?.length > 0),
        [scenarios]
    )
    const mapScenario = readyForMap.find(s => s.id === mapScenarioId) ?? readyForMap[0]

    return (
        <div className="space-y-4">
            <PageHeader
                title="Сценарии планирования"
                subtitle="Создавайте планы, сравнивайте варианты и смотрите прогноз по регионам."
                actions={
                    <Button onClick={() => setShowForm(!showForm)} size="sm">
                        {showForm ? <><X className="h-4 w-4" /> Скрыть</> : <><Plus className="h-4 w-4" /> Новый план</>}
                    </Button>
                }
            />

            {showForm && (
                <Card className="border-accent-lime/30">
                    <CardBody className="pt-5">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <Field label="Название" error={errors.name?.message}>
                                    <Input placeholder="Мой план" {...register('name')} />
                                </Field>
                                <Field label="Показатель" error={errors.targetIndicator?.message}>
                                    <Select {...register('targetIndicator')}>
                                        {indicators.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                    </Select>
                                </Field>
                                <Field label="Метод расчёта" error={errors.method?.message}>
                                    <Select {...register('method')}>
                                        <option value="growth-rate">По темпам роста</option>
                                        <option value="avg-3m">Среднее за 3 мес</option>
                                        <option value="avg-6m">Среднее за 6 мес</option>
                                    </Select>
                                </Field>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <Field label="Модель прогноза" error={errors.forecastMode?.message}>
                                    <Select {...register('forecastMode')}>
                                        {Object.entries(FORECAST_MODE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field label="Глубина" error={errors.periodMode?.message}>
                                    <Select {...register('periodMode')}>
                                        <option value="max">Максимальная (24 мес)</option>
                                        <option value="half">Половина (12 мес)</option>
                                        <option value="custom">Своя</option>
                                    </Select>
                                </Field>

                                {isCustom ? (
                                    <>
                                        <div className="flex items-end gap-2">
                                            <Field label="С" error={errors.periodFrom?.message}>
                                                <Input type="number" min={1} max={24} {...register('periodFrom', { valueAsNumber: true })} />
                                            </Field>
                                            <span className="pb-2 text-text-muted">—</span>
                                            <Field label="По" error={errors.periodTo?.message}>
                                                <Input type="number" min={1} max={24} {...register('periodTo', { valueAsNumber: true })} />
                                            </Field>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center text-sm text-text-secondary">
                                        {lastPeriod ? `От ${lastPeriod} → +${getPeriodRange(periodMode).to} мес` : 'Загрузите данные'}
                                    </div>
                                )}
                            </div>

                            {isGenerating && (
                                <div className="space-y-2 p-3 rounded-card border border-accent-lime/20 bg-accent-lime/5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-lime border-t-transparent" />
                                        <span className="text-sm font-medium text-text-primary">Генерация планов...</span>
                                    </div>
                                    <div className="space-y-1">
                                        {progressMessages.map((msg, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="text-xs text-text-secondary"
                                            >
                                                ✓ {msg}
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Отмена</Button>
                                <Button type="submit" disabled={isSubmitting || isGenerating}>
                                    <Sparkles className="h-4 w-4" />
                                    {isGenerating ? 'Генерация...' : 'Сгенерировать'}
                                </Button>
                            </div>
                        </form>
                    </CardBody>
                </Card>
            )}

            {error && (
                <Card><CardBody><EmptyState icon={<SlidersHorizontal />} title="Ошибка" description={error} /></CardBody></Card>
            )}

            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <div>
                    <h3 className="mb-3 text-sm font-semibold text-text-secondary">Мои планы ({scenarios.length})</h3>
                    {loading && scenarios.length === 0 ? (
                        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 mb-3" />)
                    ) : scenarios.length === 0 ? (
                        <EmptyState title="Нет сценариев" description="Нажмите «Новый план»" />
                    ) : (
                        <div className="space-y-3">
                            {scenarios.map((sc, i) => (
                                <motion.div
                                    key={sc.id}
                                    initial={reduced ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: i * 0.04 }}
                                >
                                    <ScenarioCard
                                        scenario={sc}
                                        selected={selectedIds.includes(sc.id)}
                                        onToggleSelect={() => toggleSelected(sc.id)}
                                        onDelete={() => handleDelete(sc.id)}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    {scenarios.length > 0 && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Детали плана</CardTitle>
                                    {scenarios.filter(s => s.status === 'ready').length > 1 && (
                                        <Select
                                            value={mapScenario?.id || scenarios[0]?.id || ''}
                                            onChange={e => setMapScenarioId(e.target.value)}
                                            className="w-48"
                                        >
                                            {scenarios.filter(s => s.status === 'ready').map(s => (
                                                <option key={s.id} value={s.id}>{s.title}</option>
                                            ))}
                                        </Select>
                                    )}
                                </div>
                            </CardHeader>
                            <CardBody>
                                {mapScenario ? (
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-text-secondary">Показатель:</span> {mapScenario.params.targetIndicator}</div>
                                        <div><span className="text-text-secondary">Метод:</span> {METHOD_LABELS[mapScenario.params.method] ?? mapScenario.params.method}</div>
                                        <div><span className="text-text-secondary">Модель:</span> {FORECAST_MODE_LABELS[mapScenario.params.forecastMode || 'best'] ?? mapScenario.params.forecastMode}</div>
                                        <div><span className="text-text-secondary">Период:</span> {mapScenario.params.periodFrom}–{mapScenario.params.horizonMonths} мес</div>
                                        <div><span className="text-text-secondary">СКО (RMSE):</span> {mapScenario.growthRateStd?.toFixed(3) || '—'}</div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-muted">Выберите сценарий</p>
                                )}
                            </CardBody>
                        </Card>
                    )}
                </div>
            </div>

            <PlanIndicatorsView scenarios={scenarios} />
            <ScenarioCompare />
            <YoYStdChart />

            {readyForMap.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <span className="text-xs uppercase text-text-secondary">Сценарий для карты</span>
                        <Select
                            value={mapScenario?.id || ''}
                            onChange={e => setMapScenarioId(e.target.value)}
                            className="w-64"
                        >
                            {readyForMap.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </Select>
                    </div>
                    <RussiaMap scenario={mapScenario} />
                </div>
            )}
        </div>
    )
}
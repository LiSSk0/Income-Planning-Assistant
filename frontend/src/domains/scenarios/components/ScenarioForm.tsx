// src/domains/scenarios/components/ScenarioForm.tsx
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sparkles } from 'lucide-react'
import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Select,
    Input,
    Field,
    Toggle,
    Checkbox,
} from '@/shared/ui'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { useScenarioStore } from '../store/useScenarioStore'
import { api } from '@/shared/lib/api'
import type { BusinessGraph } from '@/shared/lib/api-types'

const schema = z.object({
    name: z.string().trim().min(1, 'Введите название').max(60),
    targetIndicator: z.string().min(1, 'Выберите показатель'),
    regions: z.array(z.string()).min(1, 'Выберите хотя бы один регион'),
    horizonMonths: z.coerce.number().min(1, 'Минимум 1 месяц').max(120, 'Максимум 120 месяцев'),
    useDirectForecast: z.boolean().default(false),
})

type FormValues = z.infer<typeof schema>

interface ScenarioFormProps {
    onSuccess?: () => void
    onCancel?: () => void
}

export function ScenarioForm({ onSuccess, onCancel }: ScenarioFormProps) {
    const { indicators, subjects, loadFacts } = useDatasetStore()
    const { create, loading } = useScenarioStore()
    const [graph, setGraph] = useState<BusinessGraph | null>(null)
    const [isDerivedMap, setIsDerivedMap] = useState<Map<string, boolean>>(new Map())
    const [selectedRegionsSet, setSelectedRegionsSet] = useState<Set<string>>(new Set())

    useEffect(() => {
        loadFacts()
        api.getGraph().then(g => {
            setGraph(g)
            const map = new Map<string, boolean>()
            g.nodes.forEach(n => {
                map.set(n.indicator, n.isDerived || false)
            })
            setIsDerivedMap(map)
        }).catch(() => { })
    }, [])

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            targetIndicator: '',
            regions: [],
            horizonMonths: 6,
            useDirectForecast: false,
        },
    })

    const targetIndicator = watch('targetIndicator')
    const isDerived = targetIndicator ? isDerivedMap.get(targetIndicator) || false : false
    const useDirectForecast = watch('useDirectForecast')
    const selectedRegions = watch('regions')

    // Синхронизируем Set с массивом в форме
    useEffect(() => {
        const subscription = watch((value, { name }) => {
            if (name === 'regions') {
                setSelectedRegionsSet(new Set(value.regions || []))
            }
        })
        return () => subscription.unsubscribe()
    }, [watch])

    const toggleRegion = (region: string) => {
        const current = new Set(selectedRegionsSet)
        if (current.has(region)) {
            current.delete(region)
        } else {
            current.add(region)
        }
        setSelectedRegionsSet(current)
        setValue('regions', Array.from(current))
    }

    const selectAllRegions = () => {
        setSelectedRegionsSet(new Set(subjects))
        setValue('regions', [...subjects])
    }

    const deselectAllRegions = () => {
        setSelectedRegionsSet(new Set())
        setValue('regions', [])
    }

    const onSubmit = async (values: FormValues) => {
        const regions = values.regions.includes('all') ? [] : values.regions
        const params = {
            name: values.name,
            targetIndicator: values.targetIndicator,
            regions: regions,
            horizonMonths: values.horizonMonths,
            useDirectForecast: values.useDirectForecast,
        }
        await create(params)
        reset()
        setSelectedRegionsSet(new Set())
        onSuccess?.()
    }

    return (
        <Card className="border-accent-lime/30">
            <CardHeader>
                <CardTitle>Новый вариант плана</CardTitle>
            </CardHeader>
            <CardBody>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <Field label="Название плана" htmlFor="name" error={errors.name?.message}>
                        <Input id="name" placeholder="Напр. «Базовый Q3»" {...register('name')} />
                    </Field>

                    <Field label="Целевой показатель" htmlFor="targetIndicator" error={errors.targetIndicator?.message}>
                        <Select id="targetIndicator" {...register('targetIndicator')}>
                            <option value="">Выберите показатель</option>
                            {indicators.map(ind => (
                                <option key={ind} value={ind}>{ind}</option>
                            ))}
                        </Select>
                        {targetIndicator && (
                            <span className="text-xs text-text-muted">
                                {isDerived ? '🔗 Производный показатель (будет рассчитан по формулам)' : '📊 Базовый показатель (прямой прогноз)'}
                            </span>
                        )}
                    </Field>

                    <Field label="Регионы" error={errors.regions?.message}>
                        <div className="rounded-lg border border-border bg-bg-elevated p-3">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                                    Выбрано: {selectedRegionsSet.size} из {subjects.length}
                                </span>
                                <button
                                    type="button"
                                    onClick={selectAllRegions}
                                    className="text-xs text-accent-green hover:underline"
                                >
                                    Все
                                </button>
                                <span className="text-text-muted text-xs">/</span>
                                <button
                                    type="button"
                                    onClick={deselectAllRegions}
                                    className="text-xs text-text-muted hover:text-text-primary hover:underline"
                                >
                                    Сбросить
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                                {subjects.map(subject => (
                                    <label
                                        key={subject}
                                        className="flex items-center gap-1.5 cursor-pointer text-sm text-text-primary hover:text-accent-green transition-colors p-1 rounded hover:bg-surface-hover"
                                    >
                                        <Checkbox
                                            checked={selectedRegionsSet.has(subject)}
                                            onChange={() => toggleRegion(subject)}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="truncate">{subject}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <input
                            type="hidden"
                            {...register('regions')}
                            value={Array.from(selectedRegionsSet).join(',')}
                        />
                    </Field>

                    <Field label="Горизонт прогноза (месяцев)" htmlFor="horizonMonths" error={errors.horizonMonths?.message}>
                        <Input
                            type="number"
                            id="horizonMonths"
                            min={1}
                            max={120}
                            {...register('horizonMonths')}
                        />
                    </Field>

                    {isDerived && (
                        <div className="flex items-center gap-4">
                            <Toggle
                                checked={useDirectForecast}
                                onChange={(val) => setValue('useDirectForecast', val)}
                                label="Предсказать напрямую (без формул графа)"
                            />
                            <span className="text-xs text-text-secondary">
                                {useDirectForecast ? 'Будет выполнен прямой прогноз показателя' : 'Прогноз базовых показателей → расчёт по формулам'}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        {onCancel && (
                            <Button type="button" variant="secondary" onClick={onCancel}>
                                Отмена
                            </Button>
                        )}
                        <Button type="submit" disabled={isSubmitting || loading}>
                            <Sparkles className="h-4 w-4" />
                            {isSubmitting ? 'Генерация...' : 'Сгенерировать план'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    )
}
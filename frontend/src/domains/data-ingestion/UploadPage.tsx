// src/domains/data-ingestion/UploadPage.tsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button, Card, CardBody } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { api } from '@/shared/lib/api'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { useGraphStore } from '@/domains/business-graph/store/useGraphStore'
import { useScenarioStore } from '@/domains/scenarios/store/useScenarioStore'
import { useNewsStore } from '@/domains/ai-insights/store/useNewsStore'
import { Dropzone } from './components/Dropzone'
import { EntityReview } from './components/EntityReview'
import { DataTablePreview } from './components/DataTablePreview'
import { autoLayout } from '@/domains/business-graph/lib/layout'
import type { GraphNodeUnion } from '@/domains/business-graph/lib/mapToFlow'
import type { DetectedEntity } from '@/shared/lib/api-types'

type Screen = 'idle' | 'uploading' | 'success' | 'error'

const MIN_LOADER_MS = 3000
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function UploadPage() {
    const prefersReduced = usePrefersReducedMotion()
    const [screen, setScreen] = useState<Screen>('idle')
    const [fileName, setFileName] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [mapping, setMapping] = useState<DetectedEntity[] | null>(null)

    const { refresh, facts, indicators } = useDatasetStore()
    const { setGraph, reset } = useGraphStore()
    const clearScenarios = useScenarioStore((s) => s.clear)
    const clearGraph = useGraphStore((s) => s.clear)
    const clearNewsCache = useNewsStore((s) => s.clearCache)

    const buildGraphFromData = () => {
        if (facts.length === 0 || indicators.length === 0) {
            reset()
            return
        }

        try {
            const latestValues = new Map<string, { value: number; unit: string }>()
            for (const f of facts) {
                const key = f.indicator
                if (!latestValues.has(key) || f.period > latestValues.get(key)?.period) {
                    latestValues.set(key, { value: f.value, unit: f.unit })
                }
            }

            const freshNodes: GraphNodeUnion[] = indicators.map((ind, i) => ({
                id: `ind-${ind}-${Date.now()}-${i}`,
                type: 'indicator' as const,
                position: { x: 50 + (i % 5) * 140, y: 50 + Math.floor(i / 5) * 120 },
                data: {
                    indicator: ind,
                    unit: latestValues.get(ind)?.unit || '—',
                    currentValue: latestValues.get(ind)?.value || 0,
                    isDerived: false,
                },
                deletable: false,
            }))

            const laidOut = autoLayout(freshNodes, [], 'LR')
            setGraph(laidOut, [])
        } catch (e) {
            console.error('Ошибка построения графа:', e)
            reset()
        }
    }

    async function handleFile(file: File) {
        setFileName(file.name)
        setScreen('uploading')
        setErrorMessage('')
        try {
            const [res] = await Promise.all([api.uploadAnalytics(file), wait(MIN_LOADER_MS)])

            // Сбрасываем старые данные
            reset()
            clearGraph()
            clearScenarios()
            // Очищаем кеш новостей и аномалий
            clearNewsCache()

            await refresh()
            buildGraphFromData()

            setSuccessMessage(res.message)
            setScreen('success')
        } catch (e) {
            setErrorMessage(
                e instanceof Error ? e.message : 'Не удалось загрузить файл. Повторите попытку.',
            )
            setScreen('error')
        }
    }

    function handleReset() {
        setScreen('idle')
        setFileName(null)
        setMapping(null)
        setErrorMessage('')
    }

    const fade = prefersReduced
        ? {}
        : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -8 },
            transition: { duration: 0.25 },
        }

    return (
        <div>
            <PageHeader
                title="Загрузка данных"
                subtitle="Загрузите Excel/CSV."
                actions={
                    screen !== 'idle' && (
                        <Button variant="secondary" size="sm" onClick={handleReset}>
                            <RotateCcw className="h-4 w-4" />
                            Загрузить заново
                        </Button>
                    )
                }
            />

            <AnimatePresence mode="wait">
                {screen === 'idle' && (
                    <motion.div key="idle" {...fade}>
                        <Dropzone onFile={handleFile} />
                    </motion.div>
                )}

                {screen === 'uploading' && (
                    <motion.div key="uploading" {...fade}>
                        <Card>
                            <CardBody className="flex flex-col items-center justify-center gap-5 py-14 text-center">
                                <svg width="0" height="0" className="absolute" aria-hidden>
                                    <filter id="chroma-key" colorInterpolationFilters="sRGB">
                                        <feColorMatrix
                                            type="matrix"
                                            values="1 0 0 0 0
                              0 1 0 0 0
                              0 0 1 0 0
                              0.8 -1 0.8 0 0.2"
                                        />
                                    </filter>
                                </svg>

                                <div
                                    className="relative flex h-44 w-44 items-center justify-center overflow-hidden rounded-card border border-border"
                                    style={{
                                        background:
                                            'radial-gradient(circle at 50% 42%, rgba(33,160,56,0.14), var(--bg-elevated) 70%)',
                                    }}
                                >
                                    <img
                                        src="/meme-uiia.gif"
                                        alt="Идёт загрузка"
                                        className="h-full w-full object-contain"
                                        style={{ filter: 'url(#chroma-key)' }}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <p className="text-base font-semibold text-text-primary">
                                        Загрузка и пересчёт данных…
                                    </p>
                                    <p className="text-sm text-text-secondary">
                                        {fileName ? `Файл «${fileName}»` : 'Обработка файла'} — это займёт несколько секунд
                                    </p>
                                </div>
                            </CardBody>
                        </Card>
                    </motion.div>
                )}

                {screen === 'error' && (
                    <motion.div key="error" {...fade}>
                        <Card className="border-accent-red/30">
                            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
                                <AlertTriangle className="h-10 w-10 text-accent-red" />
                                <p className="text-base font-semibold text-text-primary">Загрузка не удалась</p>
                                <p className="max-w-md text-sm text-text-secondary">{errorMessage}</p>
                                <Button variant="secondary" onClick={handleReset} className="mt-2">
                                    <RotateCcw className="h-4 w-4" />
                                    Попробовать снова
                                </Button>
                            </CardBody>
                        </Card>
                    </motion.div>
                )}

                {screen === 'success' && (
                    <motion.div key="success" {...fade} className="space-y-4">
                        {/* Плашка успеха */}
                        <motion.div
                            initial={prefersReduced ? false : { scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-accent-green/30 bg-accent-green/5">
                                <CardBody className="flex items-center gap-3 py-5">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-green/15">
                                        <CheckCircle2 className="h-6 w-6 text-accent-green" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-text-primary">{successMessage}</p>
                                        {fileName && (
                                            <p className="text-sm text-text-secondary">Источник: {fileName}</p>
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
                        </motion.div>

                        {/* Бонус: предпросмотр распознанных сущностей и таблицы */}
                        <EntityReview onChange={setMapping} />

                        <Card>
                            <CardBody className="pt-5">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-text-primary">
                                        Предпросмотр загруженных фактов
                                    </h3>
                                    {mapping && (
                                        <span className="text-xs text-text-secondary">
                                            распознано колонок: {mapping.length}
                                        </span>
                                    )}
                                </div>
                                <DataTablePreview />
                            </CardBody>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
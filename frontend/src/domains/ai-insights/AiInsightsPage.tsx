// src/domains/ai-insights/AiInsightsPage.tsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Newspaper, AlertTriangle, Filter, RefreshCw, Loader2, Wifi, Brain, Search as SearchIcon, CheckCircle, RotateCcw } from 'lucide-react'
import { Card, CardBody, Skeleton, EmptyState, Select, Button, Tag, Toggle } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { AnomalyCardItem } from './components/AnomalyCardItem'
import { NewsCardItem } from './components/NewsCardItem'
import { useNewsStore, type NewsPhase } from './store/useNewsStore'

const PHASE_STEPS: { phase: NewsPhase; label: string; icon: React.ReactNode }[] = [
    { phase: 'CONNECTING', label: 'Подключение', icon: <Wifi className="h-3.5 w-3.5" /> },
    { phase: 'START', label: 'Сбор данных', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    { phase: 'INDICATORS', label: 'Показатели', icon: <SearchIcon className="h-3.5 w-3.5" /> },
    { phase: 'PARSED', label: 'Парсинг источников', icon: <Newspaper className="h-3.5 w-3.5" /> },
    { phase: 'FOUND', label: 'Новости найдены', icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { phase: 'ANALYZING', label: 'AI-анализ', icon: <Brain className="h-3.5 w-3.5" /> },
]

const PHASE_ORDER: NewsPhase[] = ['CONNECTING', 'START', 'INDICATORS', 'PARSED', 'FOUND', 'ANALYZING', 'DONE']

const COUNT_OPTIONS = [
    { value: 3, label: '3' },
    { value: 5, label: '5' },
    { value: 10, label: '10' },
]

function NewsProgressBar({ phase, message }: { phase: NewsPhase; message: string }) {
    const currentIndex = PHASE_ORDER.indexOf(phase)
    const progress = phase === 'DONE' ? 100 : Math.max(5, (currentIndex / (PHASE_ORDER.length - 1)) * 100)

    return (
        <Card className="border-accent-green/20">
            <CardBody className="pt-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-green/10">
                        <Loader2 className="h-4 w-4 text-accent-green animate-spin" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">{message}</p>
                    </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-lime transition-all duration-500 ease-out"
                        style={{ width: progress + '%' }}
                    />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {PHASE_STEPS.map((step) => {
                        const stepIndex = PHASE_ORDER.indexOf(step.phase)
                        const isActive = step.phase === phase
                        const isDone = currentIndex > stepIndex
                        return (
                            <div
                                key={step.phase}
                                className={
                                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all duration-300 ' +
                                    (isActive
                                        ? 'bg-accent-green/15 text-accent-green font-medium'
                                        : isDone
                                            ? 'bg-surface-hover text-text-secondary'
                                            : 'text-text-muted')
                                }
                            >
                                {step.icon}
                                {step.label}
                            </div>
                        )
                    })}
                </div>
            </CardBody>
        </Card>
    )
}

export function AiInsightsPage() {
    const reduced = usePrefersReducedMotion()
    const { subjects, loadFacts } = useDatasetStore()
    const {
        news,
        anomalies,
        loadingNews,
        loadingAnomalies,
        refreshing,
        error,
        fetchAnomalies,
        fetchNews,
        showAnomalies,
        toggleShowAnomalies,
        newsPhase,
        newsPhaseMessage,
    } = useNewsStore()

    const [selectedSubject, setSelectedSubject] = useState<string>('')
    const [newsCount, setNewsCount] = useState<number>(5)
    const [threshold, setThreshold] = useState<number>(2.0)
    const [initialLoaded, setInitialLoaded] = useState(false)

    useEffect(() => {
        loadFacts()
    }, [])

    // Загружаем новости ТОЛЬКО ПРИ ПЕРВОМ РЕНДЕРЕ
    useEffect(() => {
        if (!initialLoaded && !loadingNews) {
            fetchNews(selectedSubject || undefined, newsCount, false)
            setInitialLoaded(true)
        }
    }, [initialLoaded, loadingNews])

    // Аномалии пересчитываем при изменении региона или порога
    useEffect(() => {
        if (initialLoaded) {
            fetchAnomalies(selectedSubject || undefined, threshold)
        }
    }, [selectedSubject, threshold, initialLoaded])

    const handleRefreshNews = () => {
        fetchNews(selectedSubject || undefined, newsCount, true)
    }

    const handleRecalcAnomalies = () => {
        fetchAnomalies(selectedSubject || undefined, threshold, true)
    }

    const motionProps = (i: number) =>
        reduced
            ? {}
            : {
                initial: { opacity: 0, y: 8 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.25, delay: i * 0.05 },
            }

    const anomaliesToShow = showAnomalies ? anomalies : []
    const hasNews = news.length > 0
    const isInProgress = loadingNews && newsPhase !== 'DONE' && newsPhase !== 'ERROR' && newsPhase !== 'IDLE'

    return (
        <div>
            <PageHeader
                title="AI-аналитика"
                subtitle="Актуальные новости по теме ваших данных и автоматически найденные аномалии"
            />

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-text-muted" />
                    <span className="text-sm text-text-secondary">Регион:</span>
                </div>

                <Select
                    value={selectedSubject}
                    onChange={e => {
                        setSelectedSubject(e.target.value)
                        // При смене региона автоматически обновляем аномалии, но НЕ новости
                    }}
                    className="w-52"
                >
                    <option value="">Все субъекты</option>
                    {subjects.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Колонка новостей */}
                <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-text-primary">
                            <Newspaper className="h-4 w-4 text-text-secondary" />
                            Новости ({news.length})
                            {isInProgress && <span className="ml-2 text-xs text-accent-green">{newsPhaseMessage}</span>}
                            {error && !hasNews && !isInProgress && <span className="ml-2 text-xs text-accent-red">(ошибка)</span>}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Select
                                value={newsCount}
                                onChange={e => setNewsCount(Number(e.target.value))}
                                className="w-20"
                            >
                                {COUNT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </Select>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleRefreshNews}
                                disabled={loadingNews}
                            >
                                <RefreshCw className={'h-4 w-4 ' + (loadingNews ? 'animate-spin' : '')} />
                                Обновить
                            </Button>
                        </div>
                    </div>

                    {isInProgress && (
                        <div className="mb-3">
                            <NewsProgressBar phase={newsPhase} message={newsPhaseMessage} />
                        </div>
                    )}

                    {loadingNews && !isInProgress && news.length === 0 ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-32 w-full" />
                            ))}
                        </div>
                    ) : news.length ? (
                        <div className="space-y-3">
                            {news.map((n, i) => (
                                <motion.div key={n.id} {...motionProps(i)}>
                                    <NewsCardItem news={n} />
                                </motion.div>
                            ))}
                            {error && hasNews && (
                                <p className="text-xs text-accent-amber">{error}</p>
                            )}
                        </div>
                    ) : !isInProgress ? (
                        <Card>
                            <CardBody className="pt-5">
                                <EmptyState
                                    icon={<Newspaper className="h-8 w-8" />}
                                    title="Новостей не найдено"
                                    description={error || 'Новости по вашей теме не найдены. Попробуйте обновить позже.'}
                                />
                            </CardBody>
                        </Card>
                    ) : null}
                </div>

                {/* Колонка аномалий */}
                <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-text-primary">
                            <AlertTriangle className="h-4 w-4 text-text-secondary" />
                            Аномалии ({anomaliesToShow.length})
                            {!showAnomalies && anomalies.length > 0 && (
                                <Tag tone="amber">показаны не все</Tag>
                            )}
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-text-secondary">σ:</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={4}
                                    step={0.1}
                                    value={threshold}
                                    onChange={e => setThreshold(Number(e.target.value))}
                                    className="w-20 accent-accent-green"
                                />
                                <Tag tone="neutral" className="text-xs">{threshold.toFixed(1)}</Tag>
                            </div>
                            <Button variant="secondary" size="sm" onClick={handleRecalcAnomalies} disabled={loadingAnomalies}>
                                <RotateCcw className={'h-4 w-4 ' + (loadingAnomalies ? 'animate-spin' : '')} />
                                Пересчитать
                            </Button>
                            <Toggle
                                checked={showAnomalies}
                                onChange={toggleShowAnomalies}
                                label=""
                            />
                        </div>
                    </div>

                    {loadingAnomalies && anomalies.length === 0 ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-24 w-full" />
                            ))}
                        </div>
                    ) : anomaliesToShow.length ? (
                        <div className="space-y-3">
                            {anomaliesToShow.map((a, i) => (
                                <motion.div key={a.id} {...motionProps(i)}>
                                    <AnomalyCardItem anomaly={a} />
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardBody className="pt-5">
                                <EmptyState
                                    icon={<AlertTriangle className="h-8 w-8" />}
                                    title={showAnomalies ? 'Аномалий не найдено' : 'Аномалии скрыты'}
                                    description={showAnomalies ? 'При пороге ' + threshold + 'σ отклонений не обнаружено' : 'Включите показ аномалий'}
                                />
                            </CardBody>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
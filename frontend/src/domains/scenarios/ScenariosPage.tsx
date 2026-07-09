// src/domains/scenarios/ScenariosPage.tsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { Button, Card, CardBody, Skeleton, EmptyState } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { useScenarioStore } from './store/useScenarioStore'
import { ScenarioForm } from './components/ScenarioForm'
import { ScenarioCard } from './components/ScenarioCard'
import { ScenarioDetailView } from './components/ScenarioDetailView'

export function ScenariosPage() {
    const reduced = usePrefersReducedMotion()
    const { loadFacts } = useDatasetStore()
    const {
        scenarios,
        loading,
        error,
        load,
        deleteScenario,
        toggleSelect,
        selectedIds,
        selectedScenarioId,
        setSelectedScenario
    } = useScenarioStore()
    const [showForm, setShowForm] = useState(false)
    const [initialized, setInitialized] = useState(false)

    useEffect(() => {
        loadFacts()
        load()
    }, [])

    // Автоматический выбор первого сценария при загрузке
    useEffect(() => {
        if (!initialized && !loading && scenarios.length > 0 && !selectedScenarioId) {
            const firstScenario = scenarios[0]
            setSelectedScenario(firstScenario.id)
            // Автоматически включаем галку на первом сценарии
            if (!selectedIds.includes(firstScenario.id)) {
                toggleSelect(firstScenario.id)
            }
            setInitialized(true)
        }
    }, [scenarios, loading, selectedScenarioId, selectedIds, setSelectedScenario, toggleSelect, initialized])

    // Сбрасываем инициализацию при изменении списка сценариев
    useEffect(() => {
        if (scenarios.length === 0) {
            setInitialized(false)
        }
    }, [scenarios.length])

    const handleDelete = async (id: string) => {
        if (!confirm('Удалить сценарий?')) return
        await deleteScenario(id)
    }

    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)

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

            {showForm && <ScenarioForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />}

            {error && (
                <Card><CardBody><EmptyState icon={<Plus />} title="Ошибка" description={error} /></CardBody></Card>
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
                                    onClick={() => setSelectedScenario(sc.id)}
                                    className="cursor-pointer"
                                >
                                    <ScenarioCard
                                        scenario={sc}
                                        selected={selectedIds.includes(sc.id)}
                                        onToggleSelect={() => toggleSelect(sc.id)}
                                        onDelete={() => handleDelete(sc.id)}
                                        isActive={selectedScenarioId === sc.id}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    {selectedScenario ? (
                        <ScenarioDetailView scenario={selectedScenario} />
                    ) : (
                        <Card>
                            <CardBody className="py-12 text-center text-text-muted">
                                {scenarios.length > 0 ? 'Выберите сценарий из списка слева для детального просмотра' : 'Создайте первый сценарий, нажав «Новый план»'}
                            </CardBody>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
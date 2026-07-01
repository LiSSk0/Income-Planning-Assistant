import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardBody, Select, Skeleton, EmptyState } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { SlidersHorizontal } from 'lucide-react'
import { ScenarioForm } from './components/ScenarioForm'
import { ScenarioCard } from './components/ScenarioCard'
import { ScenarioCompare } from './components/ScenarioCompare'
import { RussiaMap } from './components/RussiaMap'
import { YoYStdChart } from './components/YoYStdChart'
import { PlanIndicatorsView } from './components/PlanIndicatorsView'
import { useScenarioStore } from './store/useScenarioStore'

/* Экран «Сценарии планирования» (раздел 3.4).
   Главное по ТЗ — 3-4 варианта плана ПО ПЕРИОДАМ (метод расчёта).
   Тяжёлые пересчёты идут через лимитер 5 потоков; статусы «в очереди»/
   «считается» видны на карточках и в таблице сравнения. */
export function ScenariosPage() {
  const reduced = usePrefersReducedMotion()
  const { scenarios, loading, error, load } = useScenarioStore()
  const [mapScenarioId, setMapScenarioId] = useState<string>('')

  useEffect(() => {
    load()
  }, [load])

  const readyForMap = useMemo(
    () => scenarios.filter((s) => s.status === 'ready' && s.byRegion.length > 0),
    [scenarios],
  )

  // Выбранный для карты сценарий: явный выбор или первый готовый.
  const mapScenario = useMemo(() => {
    return readyForMap.find((s) => s.id === mapScenarioId) ?? readyForMap[0]
  }, [readyForMap, mapScenarioId])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Сценарии планирования"
        subtitle="План прогнозирует все доступные показатели. Чекбоксами в блоке «Прогноз по показателям» выбирайте, что показать на графике и диаграмме. Ниже — сравнение вариантов и распределение по регионам."
      />

      {error && (
        <Card>
          <CardBody>
            <EmptyState
              icon={<SlidersHorizontal className="h-8 w-8" />}
              title="Не удалось загрузить сценарии"
              description={error}
            />
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Левая колонка: форма генерации */}
        <div className="space-y-4">
          <ScenarioForm />
        </div>

        {/* Правая колонка: карточки сценариев */}
        <div>
          {loading && scenarios.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : scenarios.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<SlidersHorizontal className="h-8 w-8" />}
                  title="Пока нет сценариев"
                  description="Сгенерируйте первый вариант плана через форму слева, выбрав целевой показатель и метод расчёта."
                />
              </CardBody>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {scenarios.map((sc, i) => (
                <motion.div
                  key={sc.id}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : i * 0.04 }}
                >
                  <ScenarioCard scenario={sc} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Прогноз по показателям: план считает все показатели, чекбоксы
          настраивают и график, и диаграмму ниже. */}
      <PlanIndicatorsView scenarios={scenarios} />

      {/* Сравнение вариантов плана */}
      <ScenarioCompare />

      {/* Расчёт СКО для прогнозируемого дохода (YoY) — раздел «Аналитика» */}
      <YoYStdChart />

      {/* Карта регионов с переключателем сценария */}
      <div className="space-y-3">
        {readyForMap.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wide text-text-secondary">
              Сценарий для карты
            </span>
            <div className="w-64">
              <Select
                value={mapScenario?.id ?? ''}
                onChange={(e) => setMapScenarioId(e.target.value)}
                aria-label="Выбор сценария для карты регионов"
              >
                {readyForMap.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
        <RussiaMap scenario={mapScenario} />
      </div>
    </div>
  )
}

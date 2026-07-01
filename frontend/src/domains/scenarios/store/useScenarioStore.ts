import { create } from 'zustand'
import { api } from '@/shared/lib/api'
import type { Scenario, ScenarioParams } from '@/shared/lib/api-types'

/* ============================================================
   Состояние экрана «Сценарии планирования».
   compute() ставит временный сценарий со status 'queued'/'computing',
   пока идёт тяжёлый api.computeScenario (через лимитер 5 потоков),
   затем заменяет его готовым 'ready' (или 'failed' при ошибке).
   Несколько compute() могут идти параллельно — каждый трекается
   по собственному временному id, статусы видны в UI (StatusPill).
   ============================================================ */

interface ScenarioState {
  scenarios: Scenario[]
  loading: boolean
  error: string | null
  /** id сценариев, выбранных для сравнения на графике. */
  selectedIds: string[]
  load: () => Promise<void>
  compute: (params: ScenarioParams) => Promise<void>
  toggleSelected: (id: string) => void
}

let tempCounter = 0

/** Метка-заглушка во время пересчёта (статусы queued/computing). */
function makePending(id: string, params: ScenarioParams): Scenario {
  const method =
    params.method === 'growth-rate'
      ? 'по темпам роста'
      : params.method === 'avg-3m'
        ? 'среднее за 3 мес'
        : 'среднее за 6 мес'
  return {
    id,
    kind: 'custom',
    title: params.name?.trim() || 'Новый план',
    description: `Расчёт «${params.targetIndicator}» (${method})`,
    params,
    // Стартуем с 'queued'; как только задача стартует на лимитере —
    // переводим в 'computing' (см. compute ниже).
    status: 'queued',
    series: [],
    byRegion: [],
    growthRateStd: 0,
    drivers: [],
  }
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: [],
  loading: false,
  error: null,
  selectedIds: [],

  async load() {
    if (get().scenarios.length) return
    set({ loading: true, error: null })
    try {
      const scenarios = await api.getScenarios()
      set({
        scenarios,
        loading: false,
        // По умолчанию для сравнения выбираем первые 2 сценария.
        selectedIds: scenarios.slice(0, 2).map((s) => s.id),
      })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Не удалось загрузить сценарии',
      })
    }
  },

  async compute(params) {
    const tempId = `tmp-${Date.now()}-${tempCounter++}`
    const pending = makePending(tempId, params)

    // Сразу показываем «в очереди» — задача ждёт свободный слот лимитера.
    set((s) => ({ scenarios: [pending, ...s.scenarios] }))

    // Переводим в «считается» — фактический старт тяжёлой задачи.
    // Лимитер сам сериализует запуск (макс. 5 параллельно); пока слота
    // нет, карточка остаётся «в очереди».
    const markComputing = () =>
      set((s) => ({
        scenarios: s.scenarios.map((sc) =>
          sc.id === tempId ? { ...sc, status: 'computing' } : sc,
        ),
      }))

    try {
      // Небольшая задержка не нужна — лимитер уже даёт реалистичную
      // картину очереди; помечаем computing перед самим запросом.
      markComputing()
      const result = await api.computeScenario(params)
      // Заменяем заглушку готовым сценарием, сохраняя позицию.
      set((s) => ({
        scenarios: s.scenarios.map((sc) =>
          sc.id === tempId ? { ...result, id: tempId } : sc,
        ),
        // Новый план сразу попадает в сравнение.
        selectedIds: s.selectedIds.includes(tempId)
          ? s.selectedIds
          : [...s.selectedIds, tempId],
      }))
    } catch (e) {
      set((s) => ({
        scenarios: s.scenarios.map((sc) =>
          sc.id === tempId
            ? {
                ...sc,
                status: 'failed',
                description:
                  e instanceof Error ? e.message : 'Ошибка пересчёта',
              }
            : sc,
        ),
      }))
    }
  },

  toggleSelected(id) {
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    }))
  },
}))

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  StatusPill,
  EmptyState,
} from '@/shared/ui'
import { chartTheme } from '@/shared/ui/chartTheme'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatPeriod } from '@/shared/lib/format'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import type { CalcMethod, Scenario } from '@/shared/lib/api-types'
import { useScenarioStore } from '../store/useScenarioStore'

/* Сравнение вариантов плана: таблица + многолинейный график по периодам.
   Метрика качества — growthRateStd (СКО темпов роста по субъектам РФ). */

const METHOD_LABEL: Record<CalcMethod, string> = {
  'growth-rate': 'По темпам роста',
  'avg-3m': 'Среднее за 3 мес',
  'avg-6m': 'Среднее за 6 мес',
}

function lastValue(scenario: Scenario): number {
  return scenario.series.at(-1)?.value ?? 0
}

/** Сводим серии выбранных сценариев в общий массив точек по периодам. */
function buildChartData(scenarios: Scenario[]) {
  const periods: string[] = []
  scenarios.forEach((sc) =>
    sc.series.forEach((p) => {
      if (!periods.includes(p.period)) periods.push(p.period)
    }),
  )
  periods.sort()
  return periods.map((period) => {
    const row: Record<string, string | number> = { period: formatPeriod(period) }
    scenarios.forEach((sc) => {
      const pt = sc.series.find((p) => p.period === period)
      if (pt) row[sc.id] = pt.value
    })
    return row
  })
}

export function ScenarioCompare() {
  const scenarios = useScenarioStore((s) => s.scenarios)
  const selectedIds = useScenarioStore((s) => s.selectedIds)
  const toggleSelected = useScenarioStore((s) => s.toggleSelected)
  const reduced = usePrefersReducedMotion()

  const ready = useMemo(() => scenarios.filter((s) => s.status === 'ready'), [scenarios])
  const selectedReady = useMemo(
    () => ready.filter((s) => selectedIds.includes(s.id) && s.series.length > 0),
    [ready, selectedIds],
  )
  const chartData = useMemo(() => buildChartData(selectedReady), [selectedReady])

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>Сравнение вариантов плана</CardTitle>
        <span className="text-xs text-text-secondary">
          выбрано для графика: {selectedReady.length}
        </span>
      </CardHeader>
      <CardBody className="space-y-5">
        {/* Таблица сценариев */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="w-10 py-2 pr-2 font-medium" />
                <th className="py-2 pr-3 font-medium">Сценарий</th>
                <th className="py-2 pr-3 font-medium">Метод</th>
                <th className="py-2 pr-3 font-medium">Горизонт</th>
                <th className="py-2 pr-3 font-medium" title="СКО темпов роста по субъектам">
                  СКО темпов роста
                </th>
                <th className="py-2 pr-3 text-right font-medium">Последнее значение</th>
                <th className="py-2 pr-1 text-right font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-text-muted">
                    Нет сценариев
                  </td>
                </tr>
              )}
              {scenarios.map((sc) => {
                const selectable = sc.status === 'ready' && sc.series.length > 0
                const checked = selectedIds.includes(sc.id)
                return (
                  <tr
                    key={sc.id}
                    className="border-b border-border/60 last:border-0 hover:bg-surface-hover"
                  >
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`Показать «${sc.title}» на графике`}
                        className="h-4 w-4 accent-accent-green disabled:opacity-40"
                        checked={checked}
                        disabled={!selectable}
                        onChange={() => toggleSelected(sc.id)}
                      />
                    </td>
                    <td className="py-2 pr-3 text-text-primary">{sc.title}</td>
                    <td className="py-2 pr-3 text-text-secondary">{METHOD_LABEL[sc.params.method]}</td>
                    <td className="tabular py-2 pr-3 text-text-secondary">
                      {(sc.params.periodFrom ?? 1)}–{sc.params.horizonMonths} мес
                    </td>
                    <td className="tabular py-2 pr-3 text-text-secondary">
                      {sc.status === 'ready' ? formatNumber(sc.growthRateStd, 3) : '—'}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-text-primary">
                      {sc.status === 'ready' ? formatNumber(lastValue(sc), 0) : '—'}
                    </td>
                    <td className="py-2 pr-1 text-right">
                      <StatusPill status={sc.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* График сравнения по периодам */}
        {selectedReady.length === 0 ? (
          <EmptyState
            icon={<LineChartIcon className="h-8 w-8" />}
            title="Нет данных для графика"
            description="Отметьте чекбоксами готовые сценарии в таблице, чтобы сравнить их динамику по периодам."
          />
        ) : (
          <motion.div
            className="h-80"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.4, ease: 'easeOut' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="period" {...chartTheme.axis} />
                <YAxis {...chartTheme.axis} width={70} tickFormatter={(v) => formatNumber(v, 0)} />
                <Tooltip
                  {...chartTheme.tooltip}
                  formatter={(v: number, name: string) => [formatNumber(v, 0) + ' руб', name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: chartTheme.axis.tick.fill }}
                />
                {selectedReady.map((sc, i) => (
                  <Line
                    key={sc.id}
                    type="monotone"
                    dataKey={sc.id}
                    name={sc.title}
                    stroke={chartTheme.series[i % chartTheme.series.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={!reduced}
                    animationDuration={reduced ? 0 : 600}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </CardBody>
    </Card>
  )
}

// помечаем cn использованным в типичных случаях расширения стилей
void cn

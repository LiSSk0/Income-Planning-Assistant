import { useEffect, useMemo, useState } from 'react'
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
import { Card, CardBody, CardHeader, CardTitle, Skeleton, EmptyState } from '@/shared/ui'
import { chartTheme } from '@/shared/ui/chartTheme'
import { formatPeriod, formatNumber } from '@/shared/lib/format'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { api } from '@/shared/lib/api'
import type { DriverRow } from '@/shared/lib/api-types'

/* Блок 2 (task_week1): график драйверов по выбранному региону.
   X — reportPeriod, Y — линии avgArpu и marketPenetrationPct.
   У показателей разный масштаб (ARPU ~13–18, проникновение ~58–71%),
   поэтому используем две оси Y для читаемости. */

interface Props {
  subject: string
}

/** "2025-01-01" -> "янв 2025". */
function periodLabel(reportPeriod: string): string {
  return formatPeriod(reportPeriod.slice(0, 7))
}

export function DriversChart({ subject }: Props) {
  const reduced = usePrefersReducedMotion()
  const [rows, setRows] = useState<DriverRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    api
      .getDrivers(subject)
      .then((data) => {
        if (alive) setRows(data)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Не удалось загрузить драйверы.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [subject])

  const data = useMemo(
    () =>
      rows.map((r) => ({
        period: periodLabel(r.reportPeriod),
        'Средний ARPU': r.avgArpu,
        'Проникновение, %': r.marketPenetrationPct,
      })),
    [rows],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Драйверы по региону — {subject}</CardTitle>
      </CardHeader>
      <CardBody>
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : error ? (
          <EmptyState
            icon={<LineChartIcon className="h-8 w-8" />}
            title="График недоступен"
            description={error}
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<LineChartIcon className="h-8 w-8" />}
            title="Нет данных по региону"
            description="Для выбранного субъекта РФ драйверы не найдены. Выберите другой регион в списке выше."
          />
        ) : (
          <motion.div
            key={subject}
            className="h-72"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.4, ease: 'easeOut' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="period" {...chartTheme.axis} />
                <YAxis
                  yAxisId="arpu"
                  {...chartTheme.axis}
                  width={48}
                  tickFormatter={(v) => formatNumber(v, 1)}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  {...chartTheme.axis}
                  width={48}
                  tickFormatter={(v) => `${formatNumber(v, 0)}%`}
                />
                <Tooltip
                  {...chartTheme.tooltip}
                  formatter={(v: number, name: string) => [
                    name === 'Проникновение, %' ? `${formatNumber(v, 2)}%` : formatNumber(v, 2),
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: chartTheme.axis.tick.fill }} />
                <Line
                  yAxisId="arpu"
                  type="monotone"
                  dataKey="Средний ARPU"
                  stroke={chartTheme.lime}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  isAnimationActive={!reduced}
                  animationDuration={reduced ? 0 : 600}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="Проникновение, %"
                  stroke={chartTheme.blue}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  isAnimationActive={!reduced}
                  animationDuration={reduced ? 0 : 600}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </CardBody>
    </Card>
  )
}

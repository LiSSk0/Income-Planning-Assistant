import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { aggregateByPeriod } from '@/shared/lib/selectors'
import { formatNumber, formatPeriod } from '@/shared/lib/format'
import { chartTheme } from '@/shared/ui/chartTheme'
import type { FactRow } from '@/shared/lib/api-types'

interface Props {
  facts: FactRow[]
  indicator: string
  /** Периоды ("YYYY-MM"), где зафиксированы аномалии — рисуем маркеры. */
  anomalyPeriods: string[]
}

/** Компактная динамика показателя с вертикальными маркерами аномалий. */
export function RevenueSparkline({ facts, indicator, anomalyPeriods }: Props) {
  const data = useMemo(
    () =>
      aggregateByPeriod(facts, indicator).map((p) => ({
        period: p.period,
        label: formatPeriod(p.period),
        value: p.value,
      })),
    [facts, indicator],
  )

  const markers = useMemo(() => {
    const present = new Set(data.map((d) => d.period))
    return Array.from(new Set(anomalyPeriods)).filter((p) => present.has(p))
  }, [anomalyPeriods, data])

  const labelByPeriod = useMemo(
    () => new Map(data.map((d) => [d.period, d.label])),
    [data],
  )

  return (
    <div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="aiSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartTheme.lime} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartTheme.lime} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis dataKey="label" {...chartTheme.axis} />
            <YAxis {...chartTheme.axis} width={64} tickFormatter={(v) => formatNumber(v, 0)} />
            <Tooltip
              {...chartTheme.tooltip}
              formatter={(v: number) => [formatNumber(v), indicator]}
            />
            {markers.map((period) => (
              <ReferenceLine
                key={period}
                x={labelByPeriod.get(period)}
                stroke={chartTheme.red}
                strokeDasharray="4 3"
                strokeOpacity={0.7}
              />
            ))}
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartTheme.lime}
              strokeWidth={2}
              fill="url(#aiSparkFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-text-muted">маркеры — периоды с аномалиями</p>
    </div>
  )
}
